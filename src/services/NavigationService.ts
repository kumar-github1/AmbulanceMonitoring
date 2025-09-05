import { Location } from './HospitalService';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface TrafficSignal {
  id: string;
  location: Location;
  status: 'normal' | 'cleared' | 'pending';
  clearanceTime?: number;
  estimatedWait?: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: 'straight' | 'left' | 'right' | 'u-turn' | 'merge' | 'exit';
  location: Location;
  streetName?: string;
}

export interface NavigationRoute {
  points: RoutePoint[];
  steps: RouteStep[];
  totalDistance: number;
  totalDuration: number;
  trafficSignals: TrafficSignal[];
  polylineCoords: Location[];
  alternativeRoutes?: NavigationRoute[];
}

export interface NavigationOptions {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidTraffic?: boolean;
  optimizeFor?: 'time' | 'distance' | 'traffic';
  isEmergency?: boolean;
  vehicleType?: 'ambulance' | 'car';
}

export interface VoiceInstruction {
  text: string;
  distance: number;
  maneuver: string;
  nextInstruction?: string;
}

class NavigationService {
  private static instance: NavigationService;
  private currentRoute: NavigationRoute | null = null;
  private voiceEnabled: boolean = true;
  private currentStep: number = 0;
  private lastAnnouncedDistance: number = 0;

  public static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  private constructor() {}

  public async calculateRoute(
    start: Location,
    destination: Location,
    options: NavigationOptions = {}
  ): Promise<NavigationRoute> {
    try {
      // First try to get route from our Socket.io server
      const serverRoute = await this.getRouteFromServer(start, destination, options);
      if (serverRoute) {
        this.currentRoute = serverRoute;
        this.currentStep = 0;
        return serverRoute;
      }
    } catch (error) {
      console.log('Server route calculation failed, using mock route:', error);
    }

    // Fallback to mock route calculation
    return this.calculateMockRoute(start, destination, options);
  }

  private async getRouteFromServer(
    start: Location,
    destination: Location,
    options: NavigationOptions
  ): Promise<NavigationRoute | null> {
    try {
      const response = await fetch('http://10.144.117.52:3001/calculate-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start,
          destination,
          options,
        }),
      });

      if (response.ok) {
        const routeData = await response.json();
        return this.normalizeRouteData(routeData);
      }
    } catch (error) {
      console.error('Error fetching route from server:', error);
    }

    return null;
  }

  private calculateMockRoute(
    start: Location,
    destination: Location,
    options: NavigationOptions = {}
  ): NavigationRoute {
    const distance = this.calculateDistance(start, destination);
    const baseTime = options.isEmergency ? 25 : 40; // km/h
    const duration = Math.round((distance / baseTime) * 60); // minutes

    // Generate intermediate points for polyline
    const numPoints = Math.max(5, Math.floor(distance * 2));
    const polylineCoords: Location[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      const lat = start.latitude + (destination.latitude - start.latitude) * ratio;
      const lng = start.longitude + (destination.longitude - start.longitude) * ratio;
      polylineCoords.push({ latitude: lat, longitude: lng });
    }

    // Generate route steps
    const steps: RouteStep[] = this.generateMockSteps(start, destination, distance, duration);
    
    // Generate traffic signals
    const trafficSignals: TrafficSignal[] = this.generateMockTrafficSignals(start, destination);

    return {
      points: [
        { latitude: start.latitude, longitude: start.longitude, address: 'Starting Point' },
        { latitude: destination.latitude, longitude: destination.longitude, address: 'Destination' },
      ],
      steps,
      totalDistance: distance * 1000, // Convert to meters
      totalDuration: duration * 60, // Convert to seconds
      trafficSignals,
      polylineCoords,
    };
  }

  private generateMockSteps(
    start: Location,
    destination: Location,
    totalDistance: number,
    totalDuration: number
  ): RouteStep[] {
    const steps: RouteStep[] = [];
    const stepCount = Math.min(8, Math.max(3, Math.floor(totalDistance * 2)));
    
    const maneuvers: RouteStep['maneuver'][] = ['straight', 'left', 'right', 'merge'];
    const streets = [
      'Main Street', 'Oak Avenue', 'First Street', 'Hospital Drive',
      'Medical Center Blvd', 'Emergency Lane', 'Health Plaza', 'Center Street'
    ];

    for (let i = 0; i < stepCount; i++) {
      const ratio = (i + 1) / stepCount;
      const stepDistance = (totalDistance * 1000) / stepCount;
      const stepDuration = (totalDuration * 60) / stepCount;
      
      const stepLat = start.latitude + (destination.latitude - start.latitude) * ratio;
      const stepLng = start.longitude + (destination.longitude - start.longitude) * ratio;
      
      let instruction: string;
      let maneuver: RouteStep['maneuver'];

      if (i === 0) {
        instruction = `Head ${this.getDirection(start, destination)} on ${streets[0]}`;
        maneuver = 'straight';
      } else if (i === stepCount - 1) {
        instruction = `Destination will be on your right`;
        maneuver = 'right';
      } else {
        maneuver = maneuvers[i % maneuvers.length];
        const street = streets[i % streets.length];
        instruction = this.getManeuverInstruction(maneuver, street, stepDistance);
      }

      steps.push({
        instruction,
        distance: stepDistance,
        duration: stepDuration,
        maneuver,
        location: { latitude: stepLat, longitude: stepLng },
        streetName: streets[i % streets.length],
      });
    }

    return steps;
  }

  private generateMockTrafficSignals(start: Location, destination: Location): TrafficSignal[] {
    const signals: TrafficSignal[] = [];
    const signalCount = Math.floor(Math.random() * 4) + 2; // 2-5 signals

    for (let i = 0; i < signalCount; i++) {
      const ratio = (i + 1) / (signalCount + 1);
      const lat = start.latitude + (destination.latitude - start.latitude) * ratio;
      const lng = start.longitude + (destination.longitude - start.longitude) * ratio;

      signals.push({
        id: `signal_${Date.now()}_${i}`,
        location: { latitude: lat, longitude: lng },
        status: Math.random() > 0.3 ? 'cleared' : 'normal',
        clearanceTime: Math.random() > 0.5 ? Math.floor(Math.random() * 120) + 60 : undefined,
        estimatedWait: Math.random() > 0.7 ? Math.floor(Math.random() * 45) + 15 : undefined,
      });
    }

    return signals;
  }

  private getDirection(start: Location, destination: Location): string {
    const bearing = this.calculateBearing(start, destination);
    
    if (bearing >= 337.5 || bearing < 22.5) return 'north';
    if (bearing >= 22.5 && bearing < 67.5) return 'northeast';
    if (bearing >= 67.5 && bearing < 112.5) return 'east';
    if (bearing >= 112.5 && bearing < 157.5) return 'southeast';
    if (bearing >= 157.5 && bearing < 202.5) return 'south';
    if (bearing >= 202.5 && bearing < 247.5) return 'southwest';
    if (bearing >= 247.5 && bearing < 292.5) return 'west';
    return 'northwest';
  }

  private getManeuverInstruction(
    maneuver: RouteStep['maneuver'],
    street: string,
    distance: number
  ): string {
    const distanceKm = (distance / 1000).toFixed(1);
    
    switch (maneuver) {
      case 'left':
        return `Turn left onto ${street}`;
      case 'right':
        return `Turn right onto ${street}`;
      case 'straight':
        return `Continue straight on ${street} for ${distanceKm}km`;
      case 'merge':
        return `Merge onto ${street}`;
      case 'u-turn':
        return `Make a U-turn`;
      case 'exit':
        return `Take the exit toward ${street}`;
      default:
        return `Continue on ${street}`;
    }
  }

  private calculateBearing(start: Location, end: Location): number {
    const startLat = start.latitude * Math.PI / 180;
    const startLng = start.longitude * Math.PI / 180;
    const endLat = end.latitude * Math.PI / 180;
    const endLng = end.longitude * Math.PI / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  }

  private calculateDistance(start: Location, end: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (end.latitude - start.latitude) * Math.PI / 180;
    const dLon = (end.longitude - start.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(start.latitude * Math.PI / 180) * Math.cos(end.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private normalizeRouteData(routeData: any): NavigationRoute {
    return {
      points: routeData.points || [],
      steps: routeData.steps || [],
      totalDistance: routeData.totalDistance || 0,
      totalDuration: routeData.totalDuration || 0,
      trafficSignals: routeData.trafficSignals || [],
      polylineCoords: routeData.polylineCoords || routeData.points || [],
      alternativeRoutes: routeData.alternativeRoutes,
    };
  }

  public getCurrentRoute(): NavigationRoute | null {
    return this.currentRoute;
  }

  public getNextInstruction(currentLocation: Location): VoiceInstruction | null {
    if (!this.currentRoute || this.currentStep >= this.currentRoute.steps.length) {
      return null;
    }

    const currentStepData = this.currentRoute.steps[this.currentStep];
    const distanceToStep = this.calculateDistance(currentLocation, currentStepData.location);
    const distanceMeters = distanceToStep * 1000;

    // Check if we've passed this step
    if (distanceMeters < 25) {
      this.currentStep++;
      this.lastAnnouncedDistance = 0;
      
      if (this.currentStep >= this.currentRoute.steps.length) {
        return {
          text: "You have arrived at your destination",
          distance: 0,
          maneuver: 'straight',
        };
      }
    }

    const nextStep = this.currentRoute.steps[this.currentStep];
    const nextInstruction = this.currentStep < this.currentRoute.steps.length - 1
      ? this.currentRoute.steps[this.currentStep + 1]?.instruction
      : undefined;

    return {
      text: this.formatVoiceInstruction(nextStep, distanceMeters),
      distance: distanceMeters,
      maneuver: nextStep.maneuver,
      nextInstruction,
    };
  }

  private formatVoiceInstruction(step: RouteStep, distance: number): string {
    let distanceText: string;
    
    if (distance > 1000) {
      distanceText = `In ${Math.round(distance / 100) / 10} kilometers`;
    } else if (distance > 100) {
      distanceText = `In ${Math.round(distance / 10) * 10} meters`;
    } else {
      distanceText = `In ${Math.round(distance)} meters`;
    }

    return `${distanceText}, ${step.instruction}`;
  }

  public shouldAnnounceInstruction(currentLocation: Location): boolean {
    if (!this.voiceEnabled || !this.currentRoute) return false;

    const instruction = this.getNextInstruction(currentLocation);
    if (!instruction) return false;

    const distance = instruction.distance;
    const announcementDistances = [1000, 500, 100, 50]; // meters

    for (const announceDistance of announcementDistances) {
      if (distance <= announceDistance && this.lastAnnouncedDistance > announceDistance) {
        this.lastAnnouncedDistance = distance;
        return true;
      }
    }

    return false;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public getRouteProgress(currentLocation: Location): {
    remainingDistance: number;
    remainingTime: number;
    progress: number;
  } {
    if (!this.currentRoute) {
      return { remainingDistance: 0, remainingTime: 0, progress: 0 };
    }

    const totalDistance = this.currentRoute.totalDistance;
    const totalDuration = this.currentRoute.totalDuration;
    
    // Calculate distance to destination
    const destination = this.currentRoute.points[this.currentRoute.points.length - 1];
    const remainingDistance = this.calculateDistance(
      currentLocation,
      { latitude: destination.latitude, longitude: destination.longitude }
    ) * 1000; // Convert to meters

    const progress = Math.max(0, Math.min(1, (totalDistance - remainingDistance) / totalDistance));
    const remainingTime = Math.round(totalDuration * (1 - progress));

    return {
      remainingDistance,
      remainingTime,
      progress,
    };
  }

  public getTrafficSignalsAhead(
    currentLocation: Location,
    lookAheadDistance: number = 2000
  ): TrafficSignal[] {
    if (!this.currentRoute) return [];

    return this.currentRoute.trafficSignals.filter(signal => {
      const distance = this.calculateDistance(currentLocation, signal.location) * 1000;
      return distance <= lookAheadDistance;
    }).sort((a, b) => {
      const distA = this.calculateDistance(currentLocation, a.location);
      const distB = this.calculateDistance(currentLocation, b.location);
      return distA - distB;
    });
  }

  public formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  public formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  public clearRoute(): void {
    this.currentRoute = null;
    this.currentStep = 0;
    this.lastAnnouncedDistance = 0;
  }
}

export default NavigationService;