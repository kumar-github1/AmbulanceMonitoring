import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface GPSStatus {
  isTracking: boolean;
  hasPermission: boolean;
  locationServicesEnabled: boolean;
  lastUpdate: number | null;
  accuracy: number | null;
  provider: string | null;
}

interface LocationHistoryEntry {
  location: LocationData;
  timestamp: number;
}

export default class GPSService {
  private static instance: GPSService;
  
  private isTracking: boolean = false;
  private hasPermission: boolean = false;
  private locationServicesEnabled: boolean = false;
  private watchSubscription: Location.LocationSubscription | null = null;
  private backgroundSubscription: Location.LocationSubscription | null = null;
  
  private currentLocation: LocationData | null = null;
  private lastKnownLocation: LocationData | null = null;
  private locationHistory: LocationHistoryEntry[] = [];
  
  // Callbacks
  private onLocationUpdateCallback?: (location: LocationData) => void;
  private onLocationErrorCallback?: (error: string) => void;
  private onStatusChangeCallback?: (status: GPSStatus) => void;
  
  // Configuration
  private readonly HIGH_ACCURACY_CONFIG = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
  };
  
  private readonly BACKGROUND_CONFIG = {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000, // 15 seconds for background
    distanceInterval: 25, // 25 meters for background
  };
  
  private readonly STORAGE_KEYS = {
    LAST_LOCATION: 'gps_last_location',
    LOCATION_HISTORY: 'gps_location_history',
    GPS_SETTINGS: 'gps_settings',
  };
  
  private readonly HISTORY_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private retryCount = 0;
  
  public static getInstance(): GPSService {
    if (!GPSService.instance) {
      GPSService.instance = new GPSService();
    }
    return GPSService.instance;
  }
  
  private constructor() {
    this.initializeService();
  }
  
  private async initializeService(): Promise<void> {
    try {
      // Load last known location
      await this.loadLastKnownLocation();
      
      // Check if location services are enabled
      this.locationServicesEnabled = await Location.hasServicesEnabledAsync();
      
      // Load location history
      await this.loadLocationHistory();
      
      console.log('GPS Service initialized');
      this.notifyStatusChange();
    } catch (error) {
      console.error('Failed to initialize GPS Service:', error);
      this.handleError('Failed to initialize GPS service');
    }
  }
  
  // Permission Management
  public async requestPermissions(): Promise<boolean> {
    try {
      console.log('Requesting location permissions...');
      
      // Request foreground permissions first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        this.hasPermission = false;
        this.handleError('Location permission denied');
        this.notifyStatusChange();
        return false;
      }
      
      // Request background permissions for continuous tracking
      if (Platform.OS === 'android') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        console.log('Background permission status:', backgroundStatus);
      }
      
      this.hasPermission = true;
      this.notifyStatusChange();
      console.log('Location permissions granted');
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      this.hasPermission = false;
      this.handleError('Permission request failed');
      this.notifyStatusChange();
      return false;
    }
  }
  
  // Location Tracking
  public async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      console.log('GPS tracking already active');
      return true;
    }
    
    try {
      // Check permissions
      if (!this.hasPermission) {
        const permissionGranted = await this.requestPermissions();
        if (!permissionGranted) {
          return false;
        }
      }
      
      // Check if location services are enabled
      this.locationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!this.locationServicesEnabled) {
        this.handleError('Location services are disabled. Please enable GPS.');
        return false;
      }
      
      // Get initial location
      await this.getCurrentLocationOnce();
      
      // Start foreground tracking with high accuracy
      console.log('Starting high-accuracy GPS tracking...');
      this.watchSubscription = await Location.watchPositionAsync(
        this.HIGH_ACCURACY_CONFIG,
        this.handleLocationUpdate.bind(this)
      );
      
      // Start background tracking
      await this.startBackgroundTracking();
      
      this.isTracking = true;
      this.retryCount = 0;
      this.notifyStatusChange();
      console.log('GPS tracking started successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to start GPS tracking:', error);
      this.handleError(`Failed to start GPS tracking: ${error}`);
      await this.retryTracking();
      return false;
    }
  }
  
  private async startBackgroundTracking(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Register background location task
        await Location.startLocationUpdatesAsync('background-location-task', {
          ...this.BACKGROUND_CONFIG,
          foregroundService: {
            notificationTitle: '🚑 Ambulance Tracking',
            notificationBody: 'Location tracking is active for emergency response',
          },
        });
      }
    } catch (error) {
      console.warn('Background tracking setup failed:', error);
    }
  }
  
  private async getCurrentLocationOnce(): Promise<LocationData | null> {
    try {
      console.log('Getting current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 10000, // Accept location up to 10 seconds old
      });
      
      const locationData = this.processLocationData(location);
      await this.updateCurrentLocation(locationData);
      return locationData;
    } catch (error) {
      console.warn('Failed to get current location:', error);
      
      // Fallback to last known location
      if (this.lastKnownLocation) {
        console.log('Using last known location as fallback');
        await this.updateCurrentLocation(this.lastKnownLocation);
        return this.lastKnownLocation;
      }
      
      return null;
    }
  }
  
  private handleLocationUpdate = async (location: Location.LocationObject): Promise<void> => {
    try {
      const locationData = this.processLocationData(location);
      await this.updateCurrentLocation(locationData);
      
      console.log(`Location updated: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)} (±${locationData.accuracy?.toFixed(0)}m)`);
    } catch (error) {
      console.error('Error processing location update:', error);
    }
  };
  
  private processLocationData(location: Location.LocationObject): LocationData {
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed ? location.coords.speed * 3.6 : null, // Convert m/s to km/h
      timestamp: location.timestamp,
    };
  }
  
  private async updateCurrentLocation(locationData: LocationData): Promise<void> {
    this.currentLocation = locationData;
    
    // Save to persistent storage
    await this.saveLastKnownLocation(locationData);
    
    // Add to history
    await this.addToLocationHistory(locationData);
    
    // Notify listeners
    if (this.onLocationUpdateCallback) {
      this.onLocationUpdateCallback(locationData);
    }
    
    this.notifyStatusChange();
  }
  
  // Location History Management
  private async addToLocationHistory(location: LocationData): Promise<void> {
    try {
      const historyEntry: LocationHistoryEntry = {
        location,
        timestamp: Date.now(),
      };
      
      this.locationHistory.push(historyEntry);
      
      // Clean old entries (keep only last 30 minutes)
      const cutoffTime = Date.now() - this.HISTORY_DURATION_MS;
      this.locationHistory = this.locationHistory.filter(
        entry => entry.timestamp > cutoffTime
      );
      
      // Save to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LOCATION_HISTORY,
        JSON.stringify(this.locationHistory)
      );
    } catch (error) {
      console.error('Failed to add location to history:', error);
    }
  }
  
  private async loadLocationHistory(): Promise<void> {
    try {
      const historyJson = await AsyncStorage.getItem(this.STORAGE_KEYS.LOCATION_HISTORY);
      if (historyJson) {
        const history: LocationHistoryEntry[] = JSON.parse(historyJson);
        
        // Clean old entries
        const cutoffTime = Date.now() - this.HISTORY_DURATION_MS;
        this.locationHistory = history.filter(
          entry => entry.timestamp > cutoffTime
        );
        
        console.log(`Loaded ${this.locationHistory.length} location history entries`);
      }
    } catch (error) {
      console.error('Failed to load location history:', error);
      this.locationHistory = [];
    }
  }
  
  // Persistence
  private async saveLastKnownLocation(location: LocationData): Promise<void> {
    try {
      this.lastKnownLocation = location;
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(location)
      );
    } catch (error) {
      console.error('Failed to save last known location:', error);
    }
  }
  
  private async loadLastKnownLocation(): Promise<void> {
    try {
      const locationJson = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_LOCATION);
      if (locationJson) {
        this.lastKnownLocation = JSON.parse(locationJson);
        this.currentLocation = this.lastKnownLocation;
        console.log('Loaded last known location from storage');
      }
    } catch (error) {
      console.error('Failed to load last known location:', error);
    }
  }
  
  // Error Handling and Retry Logic
  private async retryTracking(): Promise<void> {
    if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
      this.handleError('Max retry attempts reached. GPS tracking failed.');
      return;
    }
    
    this.retryCount++;
    console.log(`Retrying GPS tracking (attempt ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS})...`);
    
    setTimeout(async () => {
      await this.startTracking();
    }, 5000 * this.retryCount); // Exponential backoff
  }
  
  private handleError(error: string): void {
    console.error('GPS Service Error:', error);
    if (this.onLocationErrorCallback) {
      this.onLocationErrorCallback(error);
    }
  }
  
  // Status Management
  private notifyStatusChange(): void {
    if (this.onStatusChangeCallback) {
      const status: GPSStatus = {
        isTracking: this.isTracking,
        hasPermission: this.hasPermission,
        locationServicesEnabled: this.locationServicesEnabled,
        lastUpdate: this.currentLocation?.timestamp || null,
        accuracy: this.currentLocation?.accuracy || null,
        provider: Platform.OS === 'android' ? 'Android GPS' : 'iOS Location Services',
      };
      
      this.onStatusChangeCallback(status);
    }
  }
  
  // Control Methods
  public async stopTracking(): Promise<void> {
    console.log('Stopping GPS tracking...');
    
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    
    if (this.backgroundSubscription) {
      this.backgroundSubscription.remove();
      this.backgroundSubscription = null;
    }
    
    try {
      await Location.stopLocationUpdatesAsync('background-location-task');
    } catch (error) {
      console.warn('Failed to stop background location updates:', error);
    }
    
    this.isTracking = false;
    this.notifyStatusChange();
    console.log('GPS tracking stopped');
  }
  
  public getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }
  
  public getLastKnownLocation(): LocationData | null {
    return this.lastKnownLocation;
  }
  
  public getLocationHistory(): LocationHistoryEntry[] {
    return [...this.locationHistory];
  }
  
  public getStatus(): GPSStatus {
    return {
      isTracking: this.isTracking,
      hasPermission: this.hasPermission,
      locationServicesEnabled: this.locationServicesEnabled,
      lastUpdate: this.currentLocation?.timestamp || null,
      accuracy: this.currentLocation?.accuracy || null,
      provider: Platform.OS === 'android' ? 'Android GPS' : 'iOS Location Services',
    };
  }
  
  // Calculate distance between two locations
  public static calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // Calculate bearing between two locations
  public static calculateBearing(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  // Event Listeners
  public setLocationUpdateCallback(callback: (location: LocationData) => void): void {
    this.onLocationUpdateCallback = callback;
  }
  
  public setLocationErrorCallback(callback: (error: string) => void): void {
    this.onLocationErrorCallback = callback;
  }
  
  public setStatusChangeCallback(callback: (status: GPSStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }
  
  // Cleanup
  public async dispose(): Promise<void> {
    await this.stopTracking();
    this.onLocationUpdateCallback = undefined;
    this.onLocationErrorCallback = undefined;
    this.onStatusChangeCallback = undefined;
  }
}