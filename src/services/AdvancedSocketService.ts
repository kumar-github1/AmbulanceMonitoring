import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationData } from './GPSService';

// Event Types
export interface AmbulanceRegistration {
  ambulanceId: string;
  initialLocation: LocationData;
  timestamp: number;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

export interface LocationUpdate {
  ambulanceId: string;
  location: LocationData;
  timestamp: number;
  isEmergency?: boolean;
  speed?: number;
  heading?: number;
}

export interface EmergencyRoute {
  ambulanceId: string;
  destination: {
    latitude: number;
    longitude: number;
    name: string;
    type: 'hospital' | 'emergency_location';
  };
  currentLocation: LocationData;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface RouteCalculated {
  ambulanceId: string;
  route: {
    points: Array<{ latitude: number; longitude: number }>;
    distance: number; // in meters
    duration: number; // in seconds
    instructions: string[];
  };
  trafficSignals: Array<{
    id: string;
    location: { latitude: number; longitude: number };
    status: 'cleared' | 'pending' | 'blocked';
    clearanceTime?: number;
  }>;
  eta: number; // timestamp
  timestamp: number;
}

export interface SignalCleared {
  signalId: string;
  ambulanceId: string;
  location: { latitude: number; longitude: number };
  clearanceDuration: number; // seconds
  timestamp: number;
}

export interface ETAUpdate {
  ambulanceId: string;
  newETA: number; // timestamp
  remainingDistance: number;
  estimatedDuration: number;
  delayReason?: string;
  timestamp: number;
}

// Connection Status
export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastConnected: number | null;
  lastSyncTime: number | null;
  serverLatency: number | null;
  queuedEvents: number;
}

// Offline Event Queue
interface QueuedEvent {
  id: string;
  eventName: string;
  data: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
}

export default class AdvancedSocketService {
  private static instance: AdvancedSocketService;
  
  private socket: Socket | null = null;
  private serverUrl: string;
  private ambulanceId: string = '';
  private isInitialized: boolean = false;
  
  // Connection management
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastConnected: null,
    lastSyncTime: null,
    serverLatency: null,
    queuedEvents: 0,
  };
  
  // Offline queue
  private eventQueue: QueuedEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  // Auto-sync timers
  private locationSyncInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private latencyCheckInterval: NodeJS.Timeout | null = null;
  
  // Event callbacks
  private onConnectionChangeCallback?: (status: ConnectionStatus) => void;
  private onRouteCalculatedCallback?: (route: RouteCalculated) => void;
  private onSignalClearedCallback?: (signal: SignalCleared) => void;
  private onETAUpdateCallback?: (eta: ETAUpdate) => void;
  private onErrorCallback?: (error: string, details?: any) => void;
  
  // Configuration
  private readonly EMERGENCY_SYNC_INTERVAL = 5000; // 5 seconds in emergency mode
  private readonly NORMAL_SYNC_INTERVAL = 30000; // 30 seconds in normal mode
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds
  private readonly LATENCY_CHECK_INTERVAL = 60000; // 1 minute
  private readonly RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Progressive delays
  
  // Storage keys
  private readonly STORAGE_KEYS = {
    EVENT_QUEUE: 'socket_event_queue',
    CONNECTION_STATE: 'socket_connection_state',
    SERVER_CONFIG: 'socket_server_config',
  };
  
  public static getInstance(): AdvancedSocketService {
    if (!AdvancedSocketService.instance) {
      AdvancedSocketService.instance = new AdvancedSocketService();
    }
    return AdvancedSocketService.instance;
  }
  
  private constructor() {
    this.serverUrl = '';
  }
  
  // Initialization
  public async initialize(serverUrl: string, ambulanceId: string): Promise<void> {
    try {
      this.serverUrl = serverUrl;
      this.ambulanceId = ambulanceId;
      
      // Load offline queue and connection state
      await this.loadOfflineQueue();
      await this.loadConnectionState();
      
      this.isInitialized = true;
      console.log('AdvancedSocketService initialized');
    } catch (error) {
      console.error('Failed to initialize AdvancedSocketService:', error);
      throw error;
    }
  }
  
  // Connection Management
  public async connect(initialLocation?: LocationData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SocketService not initialized. Call initialize() first.');
    }
    
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }
    
    try {
      console.log(`Connecting to ${this.serverUrl}...`);
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: this.RECONNECT_DELAYS[0],
        reconnectionDelayMax: 30000,
        maxReconnectionAttempts: 10,
        query: {
          ambulanceId: this.ambulanceId,
          type: 'ambulance',
          version: '2.0',
        }
      });
      
      this.setupEventListeners();
      
      // Register ambulance after connection
      if (initialLocation) {
        this.socket.on('connect', () => {
          this.registerAmbulance(initialLocation);
        });
      }
      
    } catch (error) {
      console.warn('Socket connection failed, continuing in offline mode:', error);
      this.handleError('Connection failed', error);
      // Don't throw error - allow app to continue in offline mode
    }
  }
  
  private setupEventListeners(): void {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.connectionStatus.isConnected = true;
      this.connectionStatus.isReconnecting = false;
      this.connectionStatus.reconnectAttempts = 0;
      this.connectionStatus.lastConnected = Date.now();
      
      this.startPeriodicTasks();
      this.processEventQueue();
      this.notifyConnectionChange();
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connectionStatus.isConnected = false;
      this.connectionStatus.isReconnecting = false;
      
      this.stopPeriodicTasks();
      this.notifyConnectionChange();
    });
    
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      this.connectionStatus.isReconnecting = true;
      this.connectionStatus.reconnectAttempts = attemptNumber;
      this.notifyConnectionChange();
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.connectionStatus.reconnectAttempts = 0;
      this.processEventQueue();
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleError('Connection error', error);
    });
    
    // Application events
    this.socket.on('route-calculated', (data: RouteCalculated) => {
      console.log('Route calculated received:', data);
      this.connectionStatus.lastSyncTime = Date.now();
      
      if (this.onRouteCalculatedCallback) {
        this.onRouteCalculatedCallback(data);
      }
    });
    
    this.socket.on('signal-cleared', (data: SignalCleared) => {
      console.log('Signal cleared:', data);
      this.connectionStatus.lastSyncTime = Date.now();
      
      if (this.onSignalClearedCallback) {
        this.onSignalClearedCallback(data);
      }
    });
    
    this.socket.on('eta-update', (data: ETAUpdate) => {
      console.log('ETA update:', data);
      this.connectionStatus.lastSyncTime = Date.now();
      
      if (this.onETAUpdateCallback) {
        this.onETAUpdateCallback(data);
      }
    });
    
    this.socket.on('server-message', (message) => {
      console.log('Server message:', message);
      this.connectionStatus.lastSyncTime = Date.now();
    });
    
    // Latency measurement
    this.socket.on('pong', (timestamp) => {
      const latency = Date.now() - timestamp;
      this.connectionStatus.serverLatency = latency;
      console.log(`Server latency: ${latency}ms`);
    });
    
    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.handleError('Socket error', error);
    });
  }
  
  // Event Emission Methods
  public async registerAmbulance(initialLocation: LocationData): Promise<void> {
    const registration: AmbulanceRegistration = {
      ambulanceId: this.ambulanceId,
      initialLocation,
      timestamp: Date.now(),
      deviceInfo: {
        platform: 'mobile',
        version: '2.0',
      },
    };
    
    await this.emit('register-ambulance', registration, 'high');
  }
  
  public async updateLocation(location: LocationData, isEmergency: boolean = false): Promise<void> {
    const update: LocationUpdate = {
      ambulanceId: this.ambulanceId,
      location,
      timestamp: Date.now(),
      isEmergency,
      speed: location.speed || undefined,
      heading: location.heading || undefined,
    };
    
    const priority = isEmergency ? 'high' : 'medium';
    await this.emit('update-location', update, priority);
  }
  
  public async requestEmergencyRoute(destination: EmergencyRoute['destination'], currentLocation: LocationData, priority: EmergencyRoute['priority'] = 'high'): Promise<void> {
    const request: EmergencyRoute = {
      ambulanceId: this.ambulanceId,
      destination,
      currentLocation,
      priority,
      timestamp: Date.now(),
    };
    
    await this.emit('emergency-route', request, 'high');
  }
  
  public async sendHeartbeat(): Promise<void> {
    const heartbeat = {
      ambulanceId: this.ambulanceId,
      timestamp: Date.now(),
      status: 'active',
    };
    
    await this.emit('heartbeat', heartbeat, 'low');
  }
  
  // Generic emit with offline queue support
  private async emit(eventName: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const event: QueuedEvent = {
      id: `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventName,
      data,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
    };
    
    if (this.socket?.connected) {
      try {
        this.socket.emit(eventName, data);
        console.log(`Emitted ${eventName}:`, data);
        
        // Update sync time for successful emissions
        this.connectionStatus.lastSyncTime = Date.now();
      } catch (error) {
        console.error(`Failed to emit ${eventName}:`, error);
        await this.queueEvent(event);
      }
    } else {
      console.log(`Queueing ${eventName} (offline)`);
      await this.queueEvent(event);
    }
  }
  
  // Offline Queue Management
  private async queueEvent(event: QueuedEvent): Promise<void> {
    try {
      // Add to queue with priority ordering
      this.eventQueue.push(event);
      this.eventQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.timestamp - b.timestamp;
      });
      
      // Limit queue size
      if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
        this.eventQueue = this.eventQueue.slice(0, this.MAX_QUEUE_SIZE);
        console.warn('Event queue size limit reached, oldest events removed');
      }
      
      this.connectionStatus.queuedEvents = this.eventQueue.length;
      await this.saveOfflineQueue();
      this.notifyConnectionChange();
      
    } catch (error) {
      console.error('Failed to queue event:', error);
    }
  }
  
  private async processEventQueue(): Promise<void> {
    if (!this.socket?.connected || this.eventQueue.length === 0) {
      return;
    }
    
    console.log(`Processing ${this.eventQueue.length} queued events...`);
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];
    
    for (const event of eventsToProcess) {
      try {
        if (event.retryCount < this.MAX_RETRY_ATTEMPTS) {
          this.socket.emit(event.eventName, event.data);
          console.log(`Processed queued ${event.eventName}`);
        } else {
          console.warn(`Max retries exceeded for ${event.eventName}, dropping event`);
        }
      } catch (error) {
        console.error(`Failed to process queued ${event.eventName}:`, error);
        event.retryCount++;
        this.eventQueue.push(event);
      }
    }
    
    this.connectionStatus.queuedEvents = this.eventQueue.length;
    await this.saveOfflineQueue();
    this.notifyConnectionChange();
  }
  
  // Periodic Tasks
  private startPeriodicTasks(): void {
    // Heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
    
    // Latency check
    this.latencyCheckInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', Date.now());
      }
    }, this.LATENCY_CHECK_INTERVAL);
  }
  
  private stopPeriodicTasks(): void {
    if (this.locationSyncInterval) {
      clearInterval(this.locationSyncInterval);
      this.locationSyncInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
      this.latencyCheckInterval = null;
    }
  }
  
  // Emergency Mode Location Sync
  public startEmergencyLocationSync(getCurrentLocation: () => LocationData | null): void {
    if (this.locationSyncInterval) {
      clearInterval(this.locationSyncInterval);
    }
    
    this.locationSyncInterval = setInterval(() => {
      const location = getCurrentLocation();
      if (location) {
        this.updateLocation(location, true);
      }
    }, this.EMERGENCY_SYNC_INTERVAL);
    
    console.log('Emergency location sync started (5s interval)');
  }
  
  public startNormalLocationSync(getCurrentLocation: () => LocationData | null): void {
    if (this.locationSyncInterval) {
      clearInterval(this.locationSyncInterval);
    }
    
    this.locationSyncInterval = setInterval(() => {
      const location = getCurrentLocation();
      if (location) {
        this.updateLocation(location, false);
      }
    }, this.NORMAL_SYNC_INTERVAL);
    
    console.log('Normal location sync started (30s interval)');
  }
  
  public stopLocationSync(): void {
    if (this.locationSyncInterval) {
      clearInterval(this.locationSyncInterval);
      this.locationSyncInterval = null;
      console.log('Location sync stopped');
    }
  }
  
  // Manual Controls
  public async manualReconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Wait a moment before reconnecting
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
  
  public async clearEventQueue(): Promise<void> {
    this.eventQueue = [];
    this.connectionStatus.queuedEvents = 0;
    await this.saveOfflineQueue();
    this.notifyConnectionChange();
    console.log('Event queue cleared');
  }
  
  // State Management
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }
  
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  public getServerUrl(): string {
    return this.serverUrl;
  }
  
  public getAmbulanceId(): string {
    return this.ambulanceId;
  }
  
  // Persistence
  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.EVENT_QUEUE,
        JSON.stringify(this.eventQueue)
      );
    } catch (error) {
      console.error('Failed to save event queue:', error);
    }
  }
  
  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEYS.EVENT_QUEUE);
      if (queueData) {
        this.eventQueue = JSON.parse(queueData);
        this.connectionStatus.queuedEvents = this.eventQueue.length;
        console.log(`Loaded ${this.eventQueue.length} queued events`);
      }
    } catch (error) {
      console.error('Failed to load event queue:', error);
      this.eventQueue = [];
    }
  }
  
  private async saveConnectionState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.CONNECTION_STATE,
        JSON.stringify({
          lastConnected: this.connectionStatus.lastConnected,
          lastSyncTime: this.connectionStatus.lastSyncTime,
        })
      );
    } catch (error) {
      console.error('Failed to save connection state:', error);
    }
  }
  
  private async loadConnectionState(): Promise<void> {
    try {
      const stateData = await AsyncStorage.getItem(this.STORAGE_KEYS.CONNECTION_STATE);
      if (stateData) {
        const state = JSON.parse(stateData);
        this.connectionStatus.lastConnected = state.lastConnected;
        this.connectionStatus.lastSyncTime = state.lastSyncTime;
      }
    } catch (error) {
      console.error('Failed to load connection state:', error);
    }
  }
  
  // Event Callbacks
  public setOnConnectionChangeCallback(callback: (status: ConnectionStatus) => void): void {
    this.onConnectionChangeCallback = callback;
  }
  
  public setOnRouteCalculatedCallback(callback: (route: RouteCalculated) => void): void {
    this.onRouteCalculatedCallback = callback;
  }
  
  public setOnSignalClearedCallback(callback: (signal: SignalCleared) => void): void {
    this.onSignalClearedCallback = callback;
  }
  
  public setOnETAUpdateCallback(callback: (eta: ETAUpdate) => void): void {
    this.onETAUpdateCallback = callback;
  }
  
  public setOnErrorCallback(callback: (error: string, details?: any) => void): void {
    this.onErrorCallback = callback;
  }
  
  // Internal Methods
  private notifyConnectionChange(): void {
    this.saveConnectionState();
    
    if (this.onConnectionChangeCallback) {
      this.onConnectionChangeCallback(this.getConnectionStatus());
    }
  }
  
  private handleError(error: string, details?: any): void {
    console.error('SocketService error:', error, details);
    
    if (this.onErrorCallback) {
      this.onErrorCallback(error, details);
    }
  }
  
  // Cleanup
  public async disconnect(): Promise<void> {
    console.log('Disconnecting socket service...');
    
    this.stopPeriodicTasks();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionStatus.isConnected = false;
    this.connectionStatus.isReconnecting = false;
    
    await this.saveConnectionState();
    await this.saveOfflineQueue();
    
    this.notifyConnectionChange();
  }
  
  public async dispose(): Promise<void> {
    await this.disconnect();
    
    // Clear callbacks
    this.onConnectionChangeCallback = undefined;
    this.onRouteCalculatedCallback = undefined;
    this.onSignalClearedCallback = undefined;
    this.onETAUpdateCallback = undefined;
    this.onErrorCallback = undefined;
    
    console.log('SocketService disposed');
  }
}