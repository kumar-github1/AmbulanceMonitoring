import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Location {
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

class LocationService {
  private watchId: number | null = null;
  private lastKnownLocation: Location | null = null;
  private options: LocationServiceOptions = {};
  private onLocationUpdate?: (location: Location) => void;
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

  public setLocationUpdateCallback(callback: (location: Location) => void) {
    this.onLocationUpdate = callback;
  }

  public setLocationErrorCallback(callback: (error: any) => void) {
    this.onLocationError = callback;
  }

  public async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        (error) => {
          console.error('Location permission denied:', error);
          resolve(false);
        }
      );
    });
  }

  public getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          this.lastKnownLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Get current location error:', error);
          
          if (this.lastKnownLocation) {
            resolve(this.lastKnownLocation);
          } else {
            reject(error);
          }
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: this.options.timeout,
          maximumAge: this.options.maximumAge,
        }
      );
    });
  }

  public startTracking(): boolean {
    if (this.watchId !== null) {
      console.warn('Location tracking is already active');
      return false;
    }

    try {
      this.watchId = Geolocation.watchPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };

          this.lastKnownLocation = location;

          if (this.onLocationUpdate) {
            this.onLocationUpdate(location);
          }
        },
        (error) => {
          console.error('Location tracking error:', error);
          
          if (this.onLocationError) {
            this.onLocationError(error);
          }

          if (error.code === error.PERMISSION_DENIED) {
            this.stopTracking();
          }
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: this.options.timeout,
          maximumAge: this.options.maximumAge,
          distanceFilter: this.options.distanceFilter,
        }
      );

      console.log('Location tracking started with watch ID:', this.watchId);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  public stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('Location tracking stopped');
    }
  }

  public isTracking(): boolean {
    return this.watchId !== null;
  }

  public getLastKnownLocation(): Location | null {
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
      this.startTracking();
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

  public isLocationStale(location: Location, maxAgeMs: number = 30000): boolean {
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

export default LocationService;