import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationServiceOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  interval?: number;
  fastestInterval?: number;
}

class ExpoLocationService {
  private watchId: Location.LocationSubscription | null = null;
  private lastKnownLocation: LocationData | null = null;
  private options: LocationServiceOptions = {};
  private onLocationUpdate?: (location: LocationData) => void;
  private onLocationError?: (error: any) => void;

  constructor() {
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const [highAccuracy, updateInterval] = await Promise.all([
        AsyncStorage.getItem('highAccuracy'),
        AsyncStorage.getItem('locationUpdateInterval'),
      ]);

      this.options = {
        enableHighAccuracy: highAccuracy !== 'false',
        timeout: 15000,
        maximumAge: 10000,
        distanceFilter: 10,
        interval: parseInt(updateInterval || '5') * 1000,
        fastestInterval: 2000,
      };
    } catch (error) {
      console.error('Error loading location settings:', error);
      this.setDefaultOptions();
    }
  }

  private setDefaultOptions() {
    this.options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
      distanceFilter: 10,
      interval: 5000,
      fastestInterval: 2000,
    };
  }

  public setLocationUpdateCallback(callback: (location: LocationData) => void) {
    this.onLocationUpdate = callback;
  }

  public setLocationErrorCallback(callback: (error: any) => void) {
    this.onLocationError = callback;
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  public async getCurrentLocation(): Promise<LocationData> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: this.options.enableHighAccuracy
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };

      this.lastKnownLocation = locationData;
      return locationData;
    } catch (error) {
      console.error('Get current location error:', error);
      
      if (this.lastKnownLocation) {
        return this.lastKnownLocation;
      } else {
        throw error;
      }
    }
  }

  public async startTracking(): Promise<boolean> {
    if (this.watchId !== null) {
      console.warn('Location tracking is already active');
      return false;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: this.options.enableHighAccuracy 
            ? Location.Accuracy.High 
            : Location.Accuracy.Balanced,
          timeInterval: this.options.interval,
          distanceInterval: this.options.distanceFilter || 10,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          };

          this.lastKnownLocation = locationData;

          if (this.onLocationUpdate) {
            this.onLocationUpdate(locationData);
          }
        }
      );

      console.log('Location tracking started successfully');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      
      if (this.onLocationError) {
        this.onLocationError(error);
      }
      
      return false;
    }
  }

  public stopTracking(): void {
    if (this.watchId !== null) {
      this.watchId.remove();
      this.watchId = null;
      console.log('Location tracking stopped');
    }
  }

  public isTracking(): boolean {
    return this.watchId !== null;
  }

  public getLastKnownLocation(): LocationData | null {
    return this.lastKnownLocation;
  }

  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) *
        Math.cos(this.degreesToRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  public async updateSettings(): Promise<void> {
    await this.loadSettings();
    
    if (this.isTracking()) {
      this.stopTracking();
      await this.startTracking();
    }
  }

  public getLocationAccuracyText(accuracy?: number): string {
    if (!accuracy) return 'Unknown';
    
    if (accuracy <= 5) return 'Excellent';
    if (accuracy <= 10) return 'Good';
    if (accuracy <= 25) return 'Fair';
    if (accuracy <= 50) return 'Poor';
    return 'Very Poor';
  }

  public isLocationStale(location: LocationData, maxAgeMs: number = 30000): boolean {
    if (!location.timestamp) return true;
    
    const now = Date.now();
    return (now - location.timestamp) > maxAgeMs;
  }

  public cleanup(): void {
    this.stopTracking();
    this.lastKnownLocation = null;
    this.onLocationUpdate = undefined;
    this.onLocationError = undefined;
  }
}

export default ExpoLocationService;