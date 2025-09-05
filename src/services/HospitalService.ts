import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Hospital {
  id: string;
  name: string;
  location: Location;
  distance?: number;
  estimatedTime?: number;
  type: 'General' | 'Specialty' | 'Emergency' | 'Trauma Center';
  emergencyServices: boolean;
  facilities: string[];
  phoneNumber: string;
  address: string;
  capacity: number;
  currentLoad?: number;
  rating?: number;
  isOpen24Hours: boolean;
}

export interface HospitalSearchOptions {
  radius?: number;
  emergencyOnly?: boolean;
  sortBy?: 'distance' | 'time' | 'capacity' | 'rating';
  includePrivate?: boolean;
}

export interface RouteOptions {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  optimizeFor?: 'time' | 'distance' | 'traffic';
}

const STORAGE_KEYS = {
  RECENT_HOSPITALS: '@recent_hospitals',
  FAVORITE_HOSPITALS: '@favorite_hospitals',
  LAST_HOSPITAL_FETCH: '@last_hospital_fetch',
};

class HospitalService {
  private static instance: HospitalService;
  private cachedHospitals: Hospital[] = [];
  private recentHospitals: Hospital[] = [];
  private favoriteHospitals: string[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): HospitalService {
    if (!HospitalService.instance) {
      HospitalService.instance = new HospitalService();
    }
    return HospitalService.instance;
  }

  private constructor() {
    this.loadStoredData();
  }

  private async loadStoredData(): Promise<void> {
    try {
      const [recentData, favoriteData, lastFetchData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.RECENT_HOSPITALS),
        AsyncStorage.getItem(STORAGE_KEYS.FAVORITE_HOSPITALS),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_HOSPITAL_FETCH),
      ]);

      if (recentData) {
        this.recentHospitals = JSON.parse(recentData);
      }

      if (favoriteData) {
        this.favoriteHospitals = JSON.parse(favoriteData);
      }

      if (lastFetchData) {
        this.lastFetchTime = parseInt(lastFetchData, 10);
      }
    } catch (error) {
      console.error('Error loading hospital service data:', error);
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateEstimatedTime(distance: number, isEmergency: boolean = false): number {
    // Base speed calculations
    const baseSpeed = isEmergency ? 60 : 40; // km/h
    const trafficFactor = isEmergency ? 0.8 : 1.2; // Emergency gets traffic clearance
    
    return Math.round((distance / baseSpeed) * trafficFactor * 60); // minutes
  }

  private async fetchHospitalsFromServer(location: Location, radius: number): Promise<Hospital[]> {
    try {
      // Try to fetch from our Socket.io server first
      const response = await fetch(`http://10.144.117.52:3001/hospitals?lat=${location.latitude}&lng=${location.longitude}&radius=${radius}`);
      
      if (response.ok) {
        const hospitals = await response.json();
        return hospitals.map((hospital: any) => this.normalizeHospitalData(hospital));
      }
    } catch (error) {
      console.log('Server fetch failed, using mock data:', error);
    }
    
    // Fallback to mock data
    return this.getMockHospitals(location, radius);
  }

  private getMockHospitals(location: Location, radius: number): Hospital[] {
    const mockHospitals: Hospital[] = [
      {
        id: 'hospital_1',
        name: 'City General Hospital',
        location: { latitude: 37.7749, longitude: -122.4194 },
        type: 'General',
        emergencyServices: true,
        facilities: ['Emergency Room', 'ICU', 'Surgery', 'Cardiology', 'Neurology'],
        phoneNumber: '+1-555-0101',
        address: '123 Medical Center Dr, San Francisco, CA',
        capacity: 150,
        currentLoad: 85,
        rating: 4.2,
        isOpen24Hours: true,
      },
      {
        id: 'hospital_2',
        name: 'St. Mary Medical Center',
        location: { latitude: 37.7849, longitude: -122.4094 },
        type: 'General',
        emergencyServices: true,
        facilities: ['Emergency Room', 'ICU', 'Surgery', 'Pediatrics', 'Maternity'],
        phoneNumber: '+1-555-0102',
        address: '456 Healthcare Ave, San Francisco, CA',
        capacity: 200,
        currentLoad: 120,
        rating: 4.5,
        isOpen24Hours: true,
      },
      {
        id: 'hospital_3',
        name: 'Memorial Hospital',
        location: { latitude: 37.7649, longitude: -122.4294 },
        type: 'Specialty',
        emergencyServices: false,
        facilities: ['Surgery', 'Orthopedics', 'Rehabilitation'],
        phoneNumber: '+1-555-0103',
        address: '789 Wellness Blvd, San Francisco, CA',
        capacity: 120,
        currentLoad: 60,
        rating: 4.0,
        isOpen24Hours: false,
      },
      {
        id: 'hospital_4',
        name: 'University Trauma Center',
        location: { latitude: 37.7549, longitude: -122.4394 },
        type: 'Trauma Center',
        emergencyServices: true,
        facilities: ['Level 1 Trauma', 'Emergency Room', 'ICU', 'Surgery', 'Burn Unit'],
        phoneNumber: '+1-555-0104',
        address: '321 University Hospital Way, San Francisco, CA',
        capacity: 300,
        currentLoad: 180,
        rating: 4.7,
        isOpen24Hours: true,
      },
      {
        id: 'hospital_5',
        name: 'Mercy Emergency Hospital',
        location: { latitude: 37.7950, longitude: -122.3994 },
        type: 'Emergency',
        emergencyServices: true,
        facilities: ['Emergency Room', 'ICU', 'Fast Track', 'Ambulatory Surgery'],
        phoneNumber: '+1-555-0105',
        address: '654 Emergency Lane, San Francisco, CA',
        capacity: 80,
        currentLoad: 45,
        rating: 4.3,
        isOpen24Hours: true,
      },
    ];

    return mockHospitals.filter(hospital => {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        hospital.location.latitude,
        hospital.location.longitude
      );
      return distance <= radius;
    });
  }

  private normalizeHospitalData(hospitalData: any): Hospital {
    return {
      id: hospitalData.id || hospitalData._id || Math.random().toString(36),
      name: hospitalData.name || 'Unknown Hospital',
      location: hospitalData.location || hospitalData.coordinates,
      type: hospitalData.type || 'General',
      emergencyServices: hospitalData.emergencyServices !== false,
      facilities: hospitalData.facilities || ['General Care'],
      phoneNumber: hospitalData.phoneNumber || hospitalData.phone || 'Not available',
      address: hospitalData.address || 'Address not available',
      capacity: hospitalData.capacity || 100,
      currentLoad: hospitalData.currentLoad,
      rating: hospitalData.rating,
      isOpen24Hours: hospitalData.isOpen24Hours !== false,
    };
  }

  public async getNearbyHospitals(
    userLocation: Location,
    options: HospitalSearchOptions = {}
  ): Promise<Hospital[]> {
    const {
      radius = 25, // 25km default radius
      emergencyOnly = false,
      sortBy = 'distance',
      includePrivate = true,
    } = options;

    // Check cache validity
    const now = Date.now();
    const cacheExpired = now - this.lastFetchTime > this.CACHE_DURATION;

    let hospitals: Hospital[];

    if (cacheExpired || this.cachedHospitals.length === 0) {
      hospitals = await this.fetchHospitalsFromServer(userLocation, radius);
      this.cachedHospitals = hospitals;
      this.lastFetchTime = now;
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_HOSPITAL_FETCH, now.toString());
    } else {
      hospitals = this.cachedHospitals;
    }

    // Filter hospitals
    let filteredHospitals = hospitals;
    
    if (emergencyOnly) {
      filteredHospitals = filteredHospitals.filter(h => h.emergencyServices);
    }

    // Calculate distances and estimated times
    const hospitalsWithDistance = filteredHospitals.map(hospital => ({
      ...hospital,
      distance: this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        hospital.location.latitude,
        hospital.location.longitude
      ),
      estimatedTime: this.calculateEstimatedTime(
        this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          hospital.location.latitude,
          hospital.location.longitude
        )
      ),
    }));

    // Sort hospitals
    const sortedHospitals = this.sortHospitals(hospitalsWithDistance, sortBy);

    return sortedHospitals;
  }

  private sortHospitals(hospitals: Hospital[], sortBy: string): Hospital[] {
    switch (sortBy) {
      case 'distance':
        return hospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      case 'time':
        return hospitals.sort((a, b) => (a.estimatedTime || 0) - (b.estimatedTime || 0));
      
      case 'capacity':
        return hospitals.sort((a, b) => {
          const aAvailability = ((a.capacity - (a.currentLoad || 0)) / a.capacity) * 100;
          const bAvailability = ((b.capacity - (b.currentLoad || 0)) / b.capacity) * 100;
          return bAvailability - aAvailability;
        });
      
      case 'rating':
        return hospitals.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      default:
        return hospitals;
    }
  }

  public async searchHospitals(query: string, userLocation: Location): Promise<Hospital[]> {
    const allHospitals = await this.getNearbyHospitals(userLocation);
    
    const filteredHospitals = allHospitals.filter(hospital => 
      hospital.name.toLowerCase().includes(query.toLowerCase()) ||
      hospital.type.toLowerCase().includes(query.toLowerCase()) ||
      hospital.facilities.some(facility => 
        facility.toLowerCase().includes(query.toLowerCase())
      )
    );

    return filteredHospitals;
  }

  public async getNearestHospital(userLocation: Location, emergencyOnly: boolean = true): Promise<Hospital | null> {
    const hospitals = await this.getNearbyHospitals(userLocation, {
      emergencyOnly,
      sortBy: 'distance',
    });

    return hospitals.length > 0 ? hospitals[0] : null;
  }

  public async addToRecentHospitals(hospital: Hospital): Promise<void> {
    // Remove if already exists
    this.recentHospitals = this.recentHospitals.filter(h => h.id !== hospital.id);
    
    // Add to front
    this.recentHospitals.unshift(hospital);
    
    // Keep only last 5
    if (this.recentHospitals.length > 5) {
      this.recentHospitals = this.recentHospitals.slice(0, 5);
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.RECENT_HOSPITALS,
      JSON.stringify(this.recentHospitals)
    );
  }

  public getRecentHospitals(): Hospital[] {
    return [...this.recentHospitals];
  }

  public async addToFavorites(hospitalId: string): Promise<void> {
    if (!this.favoriteHospitals.includes(hospitalId)) {
      this.favoriteHospitals.push(hospitalId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.FAVORITE_HOSPITALS,
        JSON.stringify(this.favoriteHospitals)
      );
    }
  }

  public async removeFromFavorites(hospitalId: string): Promise<void> {
    this.favoriteHospitals = this.favoriteHospitals.filter(id => id !== hospitalId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.FAVORITE_HOSPITALS,
      JSON.stringify(this.favoriteHospitals)
    );
  }

  public isFavorite(hospitalId: string): boolean {
    return this.favoriteHospitals.includes(hospitalId);
  }

  public async getFavoriteHospitals(userLocation: Location): Promise<Hospital[]> {
    const allHospitals = await this.getNearbyHospitals(userLocation, { radius: 50 });
    return allHospitals.filter(hospital => this.isFavorite(hospital.id));
  }

  public getCapacityStatus(hospital: Hospital): 'low' | 'medium' | 'high' | 'unknown' {
    if (!hospital.currentLoad) return 'unknown';
    
    const utilization = (hospital.currentLoad / hospital.capacity) * 100;
    
    if (utilization < 70) return 'low';
    if (utilization < 90) return 'medium';
    return 'high';
  }

  public formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }

  public formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }
}

export default HospitalService;