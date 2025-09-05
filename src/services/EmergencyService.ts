import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Location } from './HospitalService';
import AdvancedSocketService from './AdvancedSocketService';

export interface EmergencySession {
  id: string;
  ambulanceId: string;
  startTime: number;
  endTime?: number;
  startLocation: Location;
  endLocation?: Location;
  destination?: {
    name: string;
    location: Location;
  };
  totalDistance?: number;
  averageSpeed?: number;
  signalsCleared: number;
  criticalEvents: EmergencyEvent[];
  status: 'active' | 'completed' | 'cancelled';
}

export interface EmergencyEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'signal_cleared' | 'stopped' | 'speed_violation' | 'route_deviation' | 'manual_override';
  location: Location;
  data?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface EmergencyStats {
  currentSpeed: number;
  heading: number;
  distanceToDestination: number;
  estimatedArrival: number;
  signalsCleared: number;
  nextSignalDistance: number | null;
  routeProgress: number; // 0-1
  emergencyDuration: number; // seconds
}

export interface TrafficSignalStatus {
  id: string;
  location: Location;
  status: 'normal' | 'pending' | 'cleared';
  clearanceTime?: number;
  countdownTimer?: number;
  distance: number;
}

const STORAGE_KEYS = {
  EMERGENCY_SESSIONS: '@emergency_sessions',
  EMERGENCY_SETTINGS: '@emergency_settings',
  EMERGENCY_LOGS: '@emergency_logs',
};

class EmergencyService {
  private static instance: EmergencyService;
  private currentSession: EmergencySession | null = null;
  private emergencyTimer: NodeJS.Timeout | null = null;
  private locationTimer: NodeJS.Timeout | null = null;
  private speedMonitorTimer: NodeJS.Timeout | null = null;
  private soundObject: Audio.Sound | null = null;
  
  // Callbacks
  private onEmergencyStateChange?: (isActive: boolean, session?: EmergencySession) => void;
  private onStatsUpdate?: (stats: EmergencyStats) => void;
  private onSignalUpdate?: (signals: TrafficSignalStatus[]) => void;
  private onCriticalEvent?: (event: EmergencyEvent) => void;

  // Emergency settings
  private settings = {
    minSpeedThreshold: 20, // km/h - below this triggers stopped event
    maxSpeedThreshold: 120, // km/h - above this triggers speed violation
    locationUpdateInterval: 1000, // 1 second
    speedMonitorInterval: 5000, // 5 seconds
    autoEndOnArrival: true,
    soundEnabled: true,
    criticalAreaOfflineMode: true,
  };

  // Current tracking data
  private currentLocation: Location | null = null;
  private currentSpeed: number = 0;
  private currentHeading: number = 0;
  private destination: Location | null = null;
  private routeDistance: number = 0;
  private trafficSignals: TrafficSignalStatus[] = [];

  public static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  private constructor() {
    this.loadSettings();
    this.loadEmergencySessions();
  }

  private async loadSettings(): Promise<void> {
    try {
      const storedSettings = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_SETTINGS);
      if (storedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
      }
    } catch (error) {
      console.error('Failed to load emergency settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save emergency settings:', error);
    }
  }

  private async loadEmergencySessions(): Promise<void> {
    try {
      const sessions = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_SESSIONS);
      // Load historical sessions for analytics if needed
    } catch (error) {
      console.error('Failed to load emergency sessions:', error);
    }
  }

  public async startEmergency(
    ambulanceId: string,
    currentLocation: Location,
    destination?: { name: string; location: Location }
  ): Promise<EmergencySession> {
    if (this.currentSession) {
      throw new Error('Emergency session already active');
    }

    const sessionId = `emergency_${Date.now()}_${ambulanceId}`;
    
    this.currentSession = {
      id: sessionId,
      ambulanceId,
      startTime: Date.now(),
      startLocation: currentLocation,
      destination,
      signalsCleared: 0,
      criticalEvents: [],
      status: 'active',
    };

    this.currentLocation = currentLocation;
    if (destination) {
      this.destination = destination.location;
      this.routeDistance = this.calculateDistance(currentLocation, destination.location) * 1000;
    }

    // Start monitoring systems
    this.startLocationTracking();
    this.startSpeedMonitoring();
    
    // Notify server
    const socketService = AdvancedSocketService.getInstance();
    await socketService.setEmergencyMode(true);
    
    // Start continuous location streaming
    socketService.startEmergencyLocationSync(() => this.currentLocation);

    // Save session
    await this.saveCurrentSession();

    // Play start sound
    await this.playEmergencySound('start');

    // Log emergency start
    await this.logEmergencyEvent({
      type: 'manual_override',
      location: currentLocation,
      data: { action: 'emergency_started', destination: destination?.name },
      severity: 'high',
    });

    // Notify listeners
    this.onEmergencyStateChange?.(true, this.currentSession);

    return this.currentSession;
  }

  public async endEmergency(reason: 'manual' | 'arrived' | 'cancelled'): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // Stop all monitoring
    this.stopLocationTracking();
    this.stopSpeedMonitoring();

    // Update session
    this.currentSession.endTime = Date.now();
    this.currentSession.status = reason === 'cancelled' ? 'cancelled' : 'completed';
    
    if (this.currentLocation) {
      this.currentSession.endLocation = this.currentLocation;
      
      if (this.currentSession.startLocation) {
        this.currentSession.totalDistance = this.calculateDistance(
          this.currentSession.startLocation,
          this.currentLocation
        ) * 1000;
      }
    }

    const duration = (this.currentSession.endTime - this.currentSession.startTime) / 1000;
    if (duration > 0 && this.currentSession.totalDistance) {
      this.currentSession.averageSpeed = (this.currentSession.totalDistance / 1000) / (duration / 3600);
    }

    // Notify server
    const socketService = AdvancedSocketService.getInstance();
    await socketService.setEmergencyMode(false);
    socketService.stopEmergencyLocationSync();

    // Save completed session
    await this.saveCompletedSession(this.currentSession);

    // Play end sound
    await this.playEmergencySound('end');

    // Log emergency end
    await this.logEmergencyEvent({
      type: 'manual_override',
      location: this.currentLocation!,
      data: { action: 'emergency_ended', reason },
      severity: 'medium',
    });

    const completedSession = this.currentSession;
    this.currentSession = null;
    this.destination = null;
    this.routeDistance = 0;
    this.trafficSignals = [];

    // Notify listeners
    this.onEmergencyStateChange?.(false, completedSession);
  }

  private startLocationTracking(): void {
    this.locationTimer = setInterval(() => {
      this.updateLocationData();
    }, this.settings.locationUpdateInterval);
  }

  private stopLocationTracking(): void {
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
      this.locationTimer = null;
    }
  }

  private startSpeedMonitoring(): void {
    this.speedMonitorTimer = setInterval(() => {
      this.monitorSpeed();
    }, this.settings.speedMonitorInterval);
  }

  private stopSpeedMonitoring(): void {
    if (this.speedMonitorTimer) {
      clearInterval(this.speedMonitorTimer);
      this.speedMonitorTimer = null;
    }
  }

  private async updateLocationData(): Promise<void> {
    if (!this.currentSession || !this.currentLocation) return;

    // Update emergency statistics
    const stats = this.calculateEmergencyStats();
    this.onStatsUpdate?.(stats);

    // Check for arrival at destination
    if (this.destination && this.settings.autoEndOnArrival) {
      const distanceToDestination = this.calculateDistance(this.currentLocation, this.destination) * 1000;
      
      if (distanceToDestination < 100) { // Within 100 meters
        await this.endEmergency('arrived');
        return;
      }
    }

    // Update traffic signals
    await this.updateTrafficSignals();
  }

  private async monitorSpeed(): Promise<void> {
    if (!this.currentSession || !this.currentLocation) return;

    // Check for stopped ambulance
    if (this.currentSpeed < this.settings.minSpeedThreshold) {
      await this.logEmergencyEvent({
        type: 'stopped',
        location: this.currentLocation,
        data: { speed: this.currentSpeed, duration: this.settings.speedMonitorInterval },
        severity: 'medium',
      });
    }

    // Check for excessive speed
    if (this.currentSpeed > this.settings.maxSpeedThreshold) {
      await this.logEmergencyEvent({
        type: 'speed_violation',
        location: this.currentLocation,
        data: { speed: this.currentSpeed, threshold: this.settings.maxSpeedThreshold },
        severity: 'high',
      });
    }
  }

  private calculateEmergencyStats(): EmergencyStats {
    if (!this.currentSession || !this.currentLocation) {
      return {
        currentSpeed: 0,
        heading: 0,
        distanceToDestination: 0,
        estimatedArrival: 0,
        signalsCleared: 0,
        nextSignalDistance: null,
        routeProgress: 0,
        emergencyDuration: 0,
      };
    }

    const emergencyDuration = (Date.now() - this.currentSession.startTime) / 1000;
    
    let distanceToDestination = 0;
    let estimatedArrival = 0;
    let routeProgress = 0;

    if (this.destination) {
      distanceToDestination = this.calculateDistance(this.currentLocation, this.destination) * 1000;
      
      if (this.currentSpeed > 0) {
        estimatedArrival = Date.now() + (distanceToDestination / (this.currentSpeed / 3.6)) * 1000;
      }

      if (this.routeDistance > 0) {
        routeProgress = Math.max(0, Math.min(1, 1 - (distanceToDestination / this.routeDistance)));
      }
    }

    const nextSignal = this.trafficSignals
      .filter(s => s.distance > 0)
      .sort((a, b) => a.distance - b.distance)[0];

    return {
      currentSpeed: this.currentSpeed,
      heading: this.currentHeading,
      distanceToDestination,
      estimatedArrival,
      signalsCleared: this.currentSession.signalsCleared,
      nextSignalDistance: nextSignal ? nextSignal.distance : null,
      routeProgress,
      emergencyDuration,
    };
  }

  private async updateTrafficSignals(): Promise<void> {
    // In a real implementation, this would fetch from the server
    // For now, simulate signal updates
    this.trafficSignals = this.trafficSignals.map(signal => {
      if (signal.status === 'cleared' && signal.countdownTimer) {
        signal.countdownTimer = Math.max(0, signal.countdownTimer - 1);
        
        if (signal.countdownTimer <= 0) {
          signal.status = 'normal';
          signal.countdownTimer = undefined;
          signal.clearanceTime = undefined;
        }
      }
      
      return signal;
    });

    this.onSignalUpdate?.(this.trafficSignals);
  }

  public async requestManualSignalClearance(location?: Location): Promise<void> {
    const currentLoc = location || this.currentLocation;
    if (!currentLoc) return;

    const socketService = AdvancedSocketService.getInstance();
    
    // Request immediate signal clearance
    await socketService.requestEmergencyRoute(
      currentLoc,
      currentLoc,
      'high'
    );

    // Find nearest signal and mark as pending
    const nearestSignal = this.trafficSignals
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestSignal) {
      nearestSignal.status = 'pending';
      this.onSignalUpdate?.(this.trafficSignals);
    }

    // Log manual override
    await this.logEmergencyEvent({
      type: 'manual_override',
      location: currentLoc,
      data: { action: 'signal_clearance_requested', signalId: nearestSignal?.id },
      severity: 'medium',
    });

    // Play request sound
    await this.playEmergencySound('request');
  }

  public handleSignalCleared(signalId: string, clearanceTime: number): void {
    const signal = this.trafficSignals.find(s => s.id === signalId);
    if (signal) {
      signal.status = 'cleared';
      signal.clearanceTime = clearanceTime;
      signal.countdownTimer = clearanceTime;
      
      if (this.currentSession) {
        this.currentSession.signalsCleared++;
      }
      
      this.playEmergencySound('cleared');
      this.onSignalUpdate?.(this.trafficSignals);
    }
  }

  private async logEmergencyEvent(
    eventData: Omit<EmergencyEvent, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<void> {
    if (!this.currentSession) return;

    const event: EmergencyEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      ...eventData,
    };

    this.currentSession.criticalEvents.push(event);
    await this.saveCurrentSession();

    // Notify listeners for critical events
    if (event.severity === 'high' || event.severity === 'critical') {
      this.onCriticalEvent?.(event);
    }
  }

  private async playEmergencySound(type: 'start' | 'end' | 'cleared' | 'request'): Promise<void> {
    if (!this.settings.soundEnabled) return;

    try {
      // In a real implementation, you would have actual sound files
      // For now, we'll simulate with different beep patterns
      console.log(`🔊 Emergency sound: ${type}`);
      
      // You would implement actual audio playback here using expo-av
      // const soundFile = require(`../assets/sounds/emergency_${type}.mp3`);
      // if (this.soundObject) {
      //   await this.soundObject.unloadAsync();
      // }
      // this.soundObject = new Audio.Sound();
      // await this.soundObject.loadAsync(soundFile);
      // await this.soundObject.playAsync();
      
    } catch (error) {
      console.error('Failed to play emergency sound:', error);
    }
  }

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sessions = await this.getStoredSessions();
      const existingIndex = sessions.findIndex(s => s.id === this.currentSession!.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = this.currentSession;
      } else {
        sessions.push(this.currentSession);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save emergency session:', error);
    }
  }

  private async saveCompletedSession(session: EmergencySession): Promise<void> {
    try {
      const sessions = await this.getStoredSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // Keep only last 50 sessions
      if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save completed session:', error);
    }
  }

  private async getStoredSessions(): Promise<EmergencySession[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_SESSIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored sessions:', error);
      return [];
    }
  }

  private calculateDistance(location1: Location, location2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (location2.latitude - location1.latitude) * Math.PI / 180;
    const dLon = (location2.longitude - location1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(location1.latitude * Math.PI / 180) * Math.cos(location2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Public methods for updating location data
  public updateLocation(location: Location, speed: number, heading: number): void {
    this.currentLocation = location;
    this.currentSpeed = speed;
    this.currentHeading = heading;
  }

  public setDestination(destination: Location, routeDistance: number): void {
    this.destination = destination;
    this.routeDistance = routeDistance;
  }

  public updateTrafficSignalList(signals: TrafficSignalStatus[]): void {
    this.trafficSignals = signals;
    this.onSignalUpdate?.(signals);
  }

  // Event listeners
  public onEmergencyStateChanged(callback: (isActive: boolean, session?: EmergencySession) => void): void {
    this.onEmergencyStateChange = callback;
  }

  public onStatsUpdated(callback: (stats: EmergencyStats) => void): void {
    this.onStatsUpdate = callback;
  }

  public onSignalsUpdated(callback: (signals: TrafficSignalStatus[]) => void): void {
    this.onSignalUpdate = callback;
  }

  public onCriticalEventOccurred(callback: (event: EmergencyEvent) => void): void {
    this.onCriticalEvent = callback;
  }

  // Getters
  public getCurrentSession(): EmergencySession | null {
    return this.currentSession;
  }

  public isEmergencyActive(): boolean {
    return this.currentSession !== null;
  }

  public getCurrentStats(): EmergencyStats {
    return this.calculateEmergencyStats();
  }

  public getTrafficSignals(): TrafficSignalStatus[] {
    return this.trafficSignals;
  }

  public async getEmergencyHistory(): Promise<EmergencySession[]> {
    return await this.getStoredSessions();
  }

  // Settings management
  public getSettings() {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<typeof this.settings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  // Cleanup
  public cleanup(): void {
    if (this.currentSession) {
      this.endEmergency('cancelled');
    }
    
    this.stopLocationTracking();
    this.stopSpeedMonitoring();
    
    if (this.soundObject) {
      this.soundObject.unloadAsync();
    }
  }
}

export default EmergencyService;