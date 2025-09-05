import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location } from './LocationService';

export interface Hospital {
  id: string;
  name: string;
  location: Location;
  distance?: number;
}

export interface EmergencyData {
  ambulanceId: string;
  isEmergency: boolean;
  location: Location | null;
  timestamp: number;
}

export interface LocationUpdateData {
  ambulanceId: string;
  location: Location;
  timestamp: number;
}

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private ambulanceId: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private autoReconnect: boolean = true;

  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onReconnectCallback?: () => void;
  private onHospitalsUpdateCallback?: (hospitals: Hospital[]) => void;
  private onEmergencyResponseCallback?: (response: any) => void;
  private onErrorCallback?: (error: any) => void;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const autoReconnectSetting = await AsyncStorage.getItem('autoReconnect');
      this.autoReconnect = autoReconnectSetting !== 'false';
    } catch (error) {
      console.error('Error loading socket settings:', error);
    }
  }

  public connect(ambulanceId: string): void {
    if (this.socket && this.socket.connected) {
      console.warn('Socket is already connected');
      return;
    }

    this.ambulanceId = ambulanceId;
    
    try {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: this.autoReconnect,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        query: {
          ambulanceId: ambulanceId,
          type: 'ambulance'
        }
      });

      this.setupEventListeners();
      console.log(`Attempting to connect to ${this.serverUrl} with ambulance ID: ${ambulanceId}`);
    } catch (error) {
      console.error('Error creating socket connection:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.reconnectAttempts = 0;
      
      this.socket?.emit('ambulance:register', {
        ambulanceId: this.ambulanceId,
        timestamp: Date.now()
      });

      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      
      if (this.onReconnectCallback) {
        this.onReconnectCallback();
      }
    });

    this.socket.on('hospitals:list', (hospitals: Hospital[]) => {
      console.log('Received hospitals list:', hospitals.length);
      
      if (this.onHospitalsUpdateCallback) {
        this.onHospitalsUpdateCallback(hospitals);
      }
    });

    this.socket.on('emergency:response', (response) => {
      console.log('Received emergency response:', response);
      
      if (this.onEmergencyResponseCallback) {
        this.onEmergencyResponseCallback(response);
      }
    });

    this.socket.on('traffic:clearance', (data) => {
      console.log('Received traffic clearance update:', data);
    });

    this.socket.on('server:message', (message) => {
      console.log('Server message:', message);
    });
  }

  public sendLocationUpdate(location: Location): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot send location update');
      return;
    }

    const locationData: LocationUpdateData = {
      ambulanceId: this.ambulanceId,
      location: location,
      timestamp: Date.now()
    };

    this.socket.emit('ambulance:location', locationData);
  }

  public sendEmergencyUpdate(isEmergency: boolean, location: Location | null): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot send emergency update');
      return;
    }

    const emergencyData: EmergencyData = {
      ambulanceId: this.ambulanceId,
      isEmergency: isEmergency,
      location: location,
      timestamp: Date.now()
    };

    this.socket.emit('ambulance:emergency', emergencyData);
    console.log(`Emergency mode ${isEmergency ? 'activated' : 'deactivated'}`);
  }

  public sendHospitalSelection(hospital: Hospital): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot send hospital selection');
      return;
    }

    const selectionData = {
      ambulanceId: this.ambulanceId,
      hospital: hospital,
      timestamp: Date.now()
    };

    this.socket.emit('ambulance:hospital_selected', selectionData);
    console.log('Hospital selected:', hospital.name);
  }

  public requestHospitalsList(location: Location): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot request hospitals list');
      return;
    }

    this.socket.emit('hospitals:request', {
      ambulanceId: this.ambulanceId,
      location: location,
      radius: 10,
      timestamp: Date.now()
    });
  }

  public sendHeartbeat(): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('ambulance:heartbeat', {
      ambulanceId: this.ambulanceId,
      timestamp: Date.now()
    });
  }

  public disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  public getConnectionState(): string {
    if (!this.socket) return 'Not initialized';
    if (this.socket.connected) return 'Connected';
    if (this.socket.disconnected) return 'Disconnected';
    return 'Connecting';
  }

  public onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  public onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  public onReconnect(callback: () => void): void {
    this.onReconnectCallback = callback;
  }

  public onHospitalsUpdate(callback: (hospitals: Hospital[]) => void): void {
    this.onHospitalsUpdateCallback = callback;
  }

  public onEmergencyResponse(callback: (response: any) => void): void {
    this.onEmergencyResponseCallback = callback;
  }

  public onError(callback: (error: any) => void): void {
    this.onErrorCallback = callback;
  }

  public updateServerUrl(newUrl: string): void {
    if (this.serverUrl !== newUrl) {
      this.serverUrl = newUrl;
      
      if (this.isConnected()) {
        this.disconnect();
        setTimeout(() => {
          this.connect(this.ambulanceId);
        }, 1000);
      }
    }
  }

  public async updateSettings(): Promise<void> {
    await this.loadSettings();
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getAmbulanceId(): string {
    return this.ambulanceId;
  }
}

export default SocketService;