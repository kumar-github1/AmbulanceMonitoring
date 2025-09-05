import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Shift, Driver } from './DriverService';

export interface TripRecord {
  id: string;
  driverId: string;
  emergencyId: string;
  startTime: number;
  endTime: number;
  duration: number;
  startLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  endLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  hospitalId?: string;
  hospitalName?: string;
  distance: number;
  averageSpeed: number;
  maxSpeed: number;
  responseTime: number;
  signalsCleared: number;
  routePoints: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    speed?: number;
  }>;
  patientInfo?: {
    condition: string;
    vitals?: string;
  };
  outcome: 'successful' | 'cancelled' | 'redirected';
  rating?: number;
  notes?: string;
}

export interface AnalyticsPeriod {
  start: number;
  end: number;
  label: string;
}

export interface PerformanceReport {
  period: AnalyticsPeriod;
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
  averageResponseTime: number;
  averageSpeed: number;
  maxSpeed: number;
  signalsCleared: number;
  successfulTrips: number;
  cancelledTrips: number;
  averageRating: number;
  hospitalVisits: { [hospitalName: string]: number };
  timeDistribution: {
    morning: number;   // 6-12
    afternoon: number; // 12-18
    evening: number;   // 18-24
    night: number;     // 0-6
  };
  speedDistribution: {
    slow: number;      // 0-40 km/h
    normal: number;    // 40-80 km/h
    fast: number;      // 80+ km/h
  };
  responseTimeDistribution: {
    excellent: number; // < 2 min
    good: number;      // 2-4 min
    average: number;   // 4-6 min
    poor: number;      // > 6 min
  };
}

export interface MapReplayData {
  tripId: string;
  routePoints: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    speed?: number;
  }>;
  events: Array<{
    timestamp: number;
    type: 'start' | 'hospital_arrived' | 'patient_pickup' | 'destination_reached' | 'signal_cleared';
    location: { latitude: number; longitude: number };
    description: string;
  }>;
  duration: number;
  distance: number;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private tripRecords: TripRecord[] = [];

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public async loadTripRecords(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('tripRecords');
      if (stored) {
        this.tripRecords = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load trip records:', error);
    }
  }

  public async recordTrip(trip: Omit<TripRecord, 'id'>): Promise<TripRecord> {
    const tripRecord: TripRecord = {
      ...trip,
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.tripRecords.push(tripRecord);
    await this.saveTripRecords();

    return tripRecord;
  }

  public getTripHistory(limit?: number): TripRecord[] {
    const sorted = this.tripRecords.sort((a, b) => b.startTime - a.startTime);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  public getTripById(tripId: string): TripRecord | undefined {
    return this.tripRecords.find(trip => trip.id === tripId);
  }

  public getTripsForPeriod(start: number, end: number): TripRecord[] {
    return this.tripRecords.filter(trip => 
      trip.startTime >= start && trip.startTime <= end
    );
  }

  public generatePerformanceReport(period: AnalyticsPeriod): PerformanceReport {
    const trips = this.getTripsForPeriod(period.start, period.end);

    if (trips.length === 0) {
      return this.getEmptyReport(period);
    }

    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalDuration = trips.reduce((sum, trip) => sum + trip.duration, 0);
    const totalResponseTime = trips.reduce((sum, trip) => sum + trip.responseTime, 0);
    const totalSpeed = trips.reduce((sum, trip) => sum + trip.averageSpeed, 0);
    const signalsCleared = trips.reduce((sum, trip) => sum + trip.signalsCleared, 0);
    const successfulTrips = trips.filter(trip => trip.outcome === 'successful').length;
    const cancelledTrips = trips.filter(trip => trip.outcome === 'cancelled').length;
    const ratedTrips = trips.filter(trip => trip.rating !== undefined);
    const totalRating = ratedTrips.reduce((sum, trip) => sum + (trip.rating || 0), 0);

    // Hospital visits
    const hospitalVisits: { [hospitalName: string]: number } = {};
    trips.forEach(trip => {
      if (trip.hospitalName) {
        hospitalVisits[trip.hospitalName] = (hospitalVisits[trip.hospitalName] || 0) + 1;
      }
    });

    // Time distribution
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    trips.forEach(trip => {
      const hour = new Date(trip.startTime).getHours();
      if (hour >= 6 && hour < 12) timeDistribution.morning++;
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon++;
      else if (hour >= 18 && hour < 24) timeDistribution.evening++;
      else timeDistribution.night++;
    });

    // Speed distribution
    const speedDistribution = { slow: 0, normal: 0, fast: 0 };
    trips.forEach(trip => {
      if (trip.averageSpeed < 40) speedDistribution.slow++;
      else if (trip.averageSpeed < 80) speedDistribution.normal++;
      else speedDistribution.fast++;
    });

    // Response time distribution (in minutes)
    const responseTimeDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    trips.forEach(trip => {
      const responseTimeMinutes = trip.responseTime / 60;
      if (responseTimeMinutes < 2) responseTimeDistribution.excellent++;
      else if (responseTimeMinutes < 4) responseTimeDistribution.good++;
      else if (responseTimeMinutes < 6) responseTimeDistribution.average++;
      else responseTimeDistribution.poor++;
    });

    return {
      period,
      totalTrips: trips.length,
      totalDistance,
      totalDuration,
      averageResponseTime: totalResponseTime / trips.length,
      averageSpeed: totalSpeed / trips.length,
      maxSpeed: Math.max(...trips.map(trip => trip.maxSpeed)),
      signalsCleared,
      successfulTrips,
      cancelledTrips,
      averageRating: ratedTrips.length > 0 ? totalRating / ratedTrips.length : 0,
      hospitalVisits,
      timeDistribution,
      speedDistribution,
      responseTimeDistribution,
    };
  }

  public getMapReplayData(tripId: string): MapReplayData | null {
    const trip = this.getTripById(tripId);
    if (!trip) return null;

    const events = [
      {
        timestamp: trip.startTime,
        type: 'start' as const,
        location: trip.startLocation,
        description: 'Emergency call received',
      },
      {
        timestamp: trip.endTime,
        type: 'destination_reached' as const,
        location: trip.endLocation,
        description: 'Arrived at destination',
      },
    ];

    // Add hospital visit if applicable
    if (trip.hospitalName) {
      events.splice(1, 0, {
        timestamp: trip.startTime + (trip.responseTime * 1000),
        type: 'hospital_arrived',
        location: trip.endLocation, // Simplified - would be hospital location
        description: `Arrived at ${trip.hospitalName}`,
      });
    }

    return {
      tripId: trip.id,
      routePoints: trip.routePoints,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      duration: trip.duration,
      distance: trip.distance,
    };
  }

  public async exportReportAsPDF(report: PerformanceReport): Promise<string> {
    try {
      const htmlContent = this.generateHTMLReport(report);
      const fileName = `ambulance_report_${Date.now()}.html`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, htmlContent);
      
      // In a real implementation, you'd use a library like react-native-html-to-pdf
      // For now, we'll just return the HTML file path
      return fileUri;
    } catch (error) {
      console.error('Failed to export report:', error);
      throw error;
    }
  }

  public async shareReport(report: PerformanceReport): Promise<void> {
    try {
      const filePath = await this.exportReportAsPDF(report);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/html',
          dialogTitle: 'Share Performance Report',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Failed to share report:', error);
      throw error;
    }
  }

  public getPredefinedPeriods(): AnalyticsPeriod[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    return [
      {
        start: today.getTime(),
        end: now.getTime(),
        label: 'Today',
      },
      {
        start: weekAgo.getTime(),
        end: now.getTime(),
        label: 'Last 7 Days',
      },
      {
        start: monthAgo.getTime(),
        end: now.getTime(),
        label: 'Last 30 Days',
      },
      {
        start: yearAgo.getTime(),
        end: now.getTime(),
        label: 'Last Year',
      },
    ];
  }

  private async saveTripRecords(): Promise<void> {
    try {
      await AsyncStorage.setItem('tripRecords', JSON.stringify(this.tripRecords));
    } catch (error) {
      console.error('Failed to save trip records:', error);
    }
  }

  private getEmptyReport(period: AnalyticsPeriod): PerformanceReport {
    return {
      period,
      totalTrips: 0,
      totalDistance: 0,
      totalDuration: 0,
      averageResponseTime: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      signalsCleared: 0,
      successfulTrips: 0,
      cancelledTrips: 0,
      averageRating: 0,
      hospitalVisits: {},
      timeDistribution: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      speedDistribution: { slow: 0, normal: 0, fast: 0 },
      responseTimeDistribution: { excellent: 0, good: 0, average: 0, poor: 0 },
    };
  }

  private generateHTMLReport(report: PerformanceReport): string {
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    const formatDistance = (meters: number): string => {
      return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ambulance Performance Report - ${report.period.label}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 5px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #2196F3; }
            .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
            .chart { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            th { background: #f8f9fa; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Ambulance Driver Performance Report</h1>
            <p>Period: ${report.period.label}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="section">
            <h2>Overview</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${report.totalTrips}</div>
                    <div class="stat-label">Total Trips</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatDistance(report.totalDistance)}</div>
                    <div class="stat-label">Distance Covered</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatDuration(report.totalDuration / 1000)}</div>
                    <div class="stat-label">Total Duration</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.averageResponseTime.toFixed(1)}min</div>
                    <div class="stat-label">Avg Response Time</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${report.averageSpeed.toFixed(1)} km/h</div>
                    <div class="stat-label">Average Speed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.maxSpeed} km/h</div>
                    <div class="stat-label">Max Speed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.signalsCleared}</div>
                    <div class="stat-label">Signals Cleared</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.averageRating.toFixed(1)}/5</div>
                    <div class="stat-label">Average Rating</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Trip Distribution</h2>
            <div class="chart">
                <h3>Time of Day</h3>
                <p>Morning (6-12): ${report.timeDistribution.morning} trips</p>
                <p>Afternoon (12-18): ${report.timeDistribution.afternoon} trips</p>
                <p>Evening (18-24): ${report.timeDistribution.evening} trips</p>
                <p>Night (0-6): ${report.timeDistribution.night} trips</p>
            </div>
        </div>

        <div class="section">
            <h2>Hospital Visits</h2>
            <table>
                <tr><th>Hospital</th><th>Visits</th></tr>
                ${Object.entries(report.hospitalVisits).map(([hospital, visits]) => 
                    `<tr><td>${hospital}</td><td>${visits}</td></tr>`
                ).join('')}
            </table>
        </div>
    </body>
    </html>`;
  }
}

export default AnalyticsService;