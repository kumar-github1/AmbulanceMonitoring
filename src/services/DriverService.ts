import AsyncStorage from '@react-native-async-storage/async-storage';
import { SocketService } from './SocketService';

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phoneNumber: string;
  ambulanceId: string;
  isActive: boolean;
  currentShift?: Shift;
  totalEmergencies: number;
  totalDistance: number;
  avgResponseTime: number;
  rating: number;
  certifications: string[];
}

export interface Shift {
  id: string;
  driverId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  emergencies: number;
  distanceCovered: number;
  isActive: boolean;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface LoginCredentials {
  driverId: string;
  password: string;
}

export interface PerformanceMetrics {
  totalShifts: number;
  totalHours: number;
  totalEmergencies: number;
  avgResponseTime: number;
  totalDistance: number;
  rating: number;
  emergenciesThisMonth: number;
  hoursThisMonth: number;
}

class DriverService {
  private static instance: DriverService;
  private currentDriver: Driver | null = null;
  private socketService: SocketService;

  private constructor() {
    this.socketService = SocketService.getInstance();
  }

  public static getInstance(): DriverService {
    if (!DriverService.instance) {
      DriverService.instance = new DriverService();
    }
    return DriverService.instance;
  }

  public async login(credentials: LoginCredentials): Promise<Driver> {
    try {
      // Try server login first
      const response = await fetch('http://10.0.2.2:3000/driver/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const driver = await response.json();
        this.currentDriver = driver;
        await this.saveDriverLocally(driver);
        await this.socketService.authenticateDriver(driver.id);
        return driver;
      }
    } catch (error) {
      console.warn('Server login failed, using offline mode:', error);
    }

    // Fallback to local storage or mock data
    return this.mockLogin(credentials);
  }

  private async mockLogin(credentials: LoginCredentials): Promise<Driver> {
    // Mock driver data for development
    const mockDriver: Driver = {
      id: credentials.driverId,
      name: 'John Smith',
      licenseNumber: 'DL12345',
      phoneNumber: '+1234567890',
      ambulanceId: 'AMB-001',
      isActive: true,
      totalEmergencies: 127,
      totalDistance: 15420,
      avgResponseTime: 3.2,
      rating: 4.8,
      certifications: ['EMT-B', 'CPR', 'First Aid'],
    };

    this.currentDriver = mockDriver;
    await this.saveDriverLocally(mockDriver);
    return mockDriver;
  }

  public async logout(): Promise<void> {
    if (this.currentDriver?.currentShift?.isActive) {
      await this.endShift();
    }
    
    this.currentDriver = null;
    await AsyncStorage.removeItem('currentDriver');
    await this.socketService.disconnect();
  }

  public async startShift(location: { latitude: number; longitude: number }): Promise<Shift> {
    if (!this.currentDriver) {
      throw new Error('No driver logged in');
    }

    const shift: Shift = {
      id: `shift_${Date.now()}`,
      driverId: this.currentDriver.id,
      startTime: Date.now(),
      duration: 0,
      emergencies: 0,
      distanceCovered: 0,
      isActive: true,
      location,
    };

    this.currentDriver.currentShift = shift;
    this.currentDriver.isActive = true;

    await this.saveDriverLocally(this.currentDriver);
    await this.saveShift(shift);

    // Notify server
    try {
      await fetch('http://10.0.2.2:3000/driver/start-shift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: this.currentDriver.id,
          shift,
        }),
      });
    } catch (error) {
      console.warn('Failed to notify server of shift start:', error);
    }

    return shift;
  }

  public async endShift(): Promise<Shift> {
    if (!this.currentDriver?.currentShift) {
      throw new Error('No active shift');
    }

    const shift = this.currentDriver.currentShift;
    shift.endTime = Date.now();
    shift.duration = shift.endTime - shift.startTime;
    shift.isActive = false;

    this.currentDriver.isActive = false;
    this.currentDriver.currentShift = undefined;

    await this.saveDriverLocally(this.currentDriver);
    await this.saveShift(shift);

    // Notify server
    try {
      await fetch('http://10.0.2.2:3000/driver/end-shift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: this.currentDriver.id,
          shift,
        }),
      });
    } catch (error) {
      console.warn('Failed to notify server of shift end:', error);
    }

    return shift;
  }

  public async updateShiftLocation(location: { latitude: number; longitude: number }): Promise<void> {
    if (this.currentDriver?.currentShift?.isActive) {
      this.currentDriver.currentShift.location = location;
      await this.saveDriverLocally(this.currentDriver);
    }
  }

  public async recordEmergency(emergencyId: string, responseTime: number, distance: number): Promise<void> {
    if (!this.currentDriver) return;

    // Update shift metrics
    if (this.currentDriver.currentShift?.isActive) {
      this.currentDriver.currentShift.emergencies++;
      this.currentDriver.currentShift.distanceCovered += distance;
    }

    // Update driver metrics
    this.currentDriver.totalEmergencies++;
    this.currentDriver.totalDistance += distance;
    
    // Calculate new average response time
    const totalResponseTime = this.currentDriver.avgResponseTime * (this.currentDriver.totalEmergencies - 1);
    this.currentDriver.avgResponseTime = (totalResponseTime + responseTime) / this.currentDriver.totalEmergencies;

    await this.saveDriverLocally(this.currentDriver);

    // Save emergency record
    const emergencyRecord = {
      id: emergencyId,
      driverId: this.currentDriver.id,
      timestamp: Date.now(),
      responseTime,
      distance,
    };

    await this.saveEmergencyRecord(emergencyRecord);
  }

  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    if (!this.currentDriver) {
      throw new Error('No driver logged in');
    }

    const shifts = await this.getShiftHistory();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonthShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear;
    });

    const totalHours = shifts.reduce((sum, shift) => sum + (shift.duration / (1000 * 60 * 60)), 0);
    const hoursThisMonth = thisMonthShifts.reduce((sum, shift) => sum + (shift.duration / (1000 * 60 * 60)), 0);
    const emergenciesThisMonth = thisMonthShifts.reduce((sum, shift) => sum + shift.emergencies, 0);

    return {
      totalShifts: shifts.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalEmergencies: this.currentDriver.totalEmergencies,
      avgResponseTime: this.currentDriver.avgResponseTime,
      totalDistance: this.currentDriver.totalDistance,
      rating: this.currentDriver.rating,
      emergenciesThisMonth,
      hoursThisMonth: Math.round(hoursThisMonth * 100) / 100,
    };
  }

  public async getShiftHistory(): Promise<Shift[]> {
    try {
      const shifts = await AsyncStorage.getItem('shiftHistory');
      return shifts ? JSON.parse(shifts) : [];
    } catch (error) {
      console.error('Failed to load shift history:', error);
      return [];
    }
  }

  public getCurrentDriver(): Driver | null {
    return this.currentDriver;
  }

  public async loadStoredDriver(): Promise<Driver | null> {
    try {
      const stored = await AsyncStorage.getItem('currentDriver');
      if (stored) {
        this.currentDriver = JSON.parse(stored);
        return this.currentDriver;
      }
    } catch (error) {
      console.error('Failed to load stored driver:', error);
    }
    return null;
  }

  private async saveDriverLocally(driver: Driver): Promise<void> {
    try {
      await AsyncStorage.setItem('currentDriver', JSON.stringify(driver));
    } catch (error) {
      console.error('Failed to save driver locally:', error);
    }
  }

  private async saveShift(shift: Shift): Promise<void> {
    try {
      const shifts = await this.getShiftHistory();
      const existingIndex = shifts.findIndex(s => s.id === shift.id);
      
      if (existingIndex >= 0) {
        shifts[existingIndex] = shift;
      } else {
        shifts.push(shift);
      }

      await AsyncStorage.setItem('shiftHistory', JSON.stringify(shifts));
    } catch (error) {
      console.error('Failed to save shift:', error);
    }
  }

  private async saveEmergencyRecord(record: any): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('emergencyRecords');
      const records = existing ? JSON.parse(existing) : [];
      records.push(record);
      await AsyncStorage.setItem('emergencyRecords', JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save emergency record:', error);
    }
  }
}

export default DriverService;