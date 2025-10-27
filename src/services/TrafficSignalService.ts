import { Location } from './HospitalService';
import { LocationData } from './GPSService';

// Enhanced traffic signal interface with RYG status
export interface TrafficSignal {
    id: string;
    location: Location;
    currentLight: 'red' | 'yellow' | 'green';
    emergencyOverride: boolean;
    normalCycle: {
        red: number;    // seconds
        yellow: number; // seconds
        green: number;  // seconds
    };
    countdown: number; // seconds remaining for current light
    type: 'intersection' | 'pedestrian' | 'highway_merge';
    direction: 'north_south' | 'east_west' | 'all_directions';
    ambulanceProximity?: number; // distance in meters
    status: 'normal' | 'emergency_mode' | 'cleared_for_ambulance';
}

export interface TrafficAPIResponse {
    success: boolean;
    signals?: TrafficSignal[];
    error?: string;
}

class TrafficSignalService {
    private static instance: TrafficSignalService;
    private signals: TrafficSignal[] = [];
    private updateInterval: NodeJS.Timeout | null = null;
    private onSignalsUpdatedCallback?: (signals: TrafficSignal[]) => void;

    // Mock traffic signals for realistic testing (positioned around a city area)
    private readonly MOCK_SIGNALS: TrafficSignal[] = [
        {
            id: 'signal_001',
            location: { latitude: 12.9716, longitude: 77.5946 }, // Bangalore
            currentLight: 'red',
            emergencyOverride: false,
            normalCycle: { red: 45, yellow: 5, green: 30 },
            countdown: 25,
            type: 'intersection',
            direction: 'north_south',
            status: 'normal'
        },
        {
            id: 'signal_002',
            location: { latitude: 12.9726, longitude: 77.5956 },
            currentLight: 'green',
            emergencyOverride: false,
            normalCycle: { red: 40, yellow: 5, green: 35 },
            countdown: 18,
            type: 'intersection',
            direction: 'east_west',
            status: 'normal'
        },
        {
            id: 'signal_003',
            location: { latitude: 12.9696, longitude: 77.5936 },
            currentLight: 'yellow',
            emergencyOverride: false,
            normalCycle: { red: 50, yellow: 4, green: 26 },
            countdown: 2,
            type: 'intersection',
            direction: 'all_directions',
            status: 'normal'
        },
        {
            id: 'signal_004',
            location: { latitude: 12.9756, longitude: 77.5976 },
            currentLight: 'red',
            emergencyOverride: false,
            normalCycle: { red: 35, yellow: 5, green: 30 },
            countdown: 12,
            type: 'pedestrian',
            direction: 'north_south',
            status: 'normal'
        },
        {
            id: 'signal_005',
            location: { latitude: 12.9686, longitude: 77.5986 },
            currentLight: 'green',
            emergencyOverride: false,
            normalCycle: { red: 42, yellow: 6, green: 32 },
            countdown: 8,
            type: 'highway_merge',
            direction: 'east_west',
            status: 'normal'
        }
    ];

    public static getInstance(): TrafficSignalService {
        if (!TrafficSignalService.instance) {
            TrafficSignalService.instance = new TrafficSignalService();
        }
        return TrafficSignalService.instance;
    }

    private constructor() {
        this.signals = [...this.MOCK_SIGNALS];
        this.startSimulation();
    }

    /**
     * Get nearby traffic signals within specified radius
     */
    public async getNearbySignals(
        location: LocationData,
        radiusKm: number = 2.0
    ): Promise<TrafficSignal[]> {
        try {
            // In a real app, this would call an API
            // For now, calculate distance to mock signals
            const nearbySignals = this.signals.filter(signal => {
                const distance = this.calculateDistance(
                    location.latitude,
                    location.longitude,
                    signal.location.latitude,
                    signal.location.longitude
                );

                // Update proximity for each signal
                signal.ambulanceProximity = distance * 1000; // convert to meters

                return distance <= radiusKm;
            });

            // Sort by distance
            nearbySignals.sort((a, b) => (a.ambulanceProximity || 0) - (b.ambulanceProximity || 0));

            return nearbySignals;
        } catch (error) {
            console.error('Error getting nearby signals:', error);
            return [];
        }
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Start traffic light simulation with realistic timing
     */
    private startSimulation(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.updateTrafficLights();
        }, 1000); // Update every second
    }

    /**
     * Update traffic light states and countdowns
     */
    private updateTrafficLights(): void {
        this.signals.forEach(signal => {
            if (signal.emergencyOverride) {
                // Keep signal green for ambulance
                signal.currentLight = 'green';
                signal.countdown = 60; // Extended green time
                return;
            }

            // Normal traffic light cycle
            signal.countdown--;

            if (signal.countdown <= 0) {
                this.transitionToNextLight(signal);
            }

            // Check if ambulance is approaching (within 200m) and switch to emergency mode
            if (signal.ambulanceProximity && signal.ambulanceProximity <= 200 && !signal.emergencyOverride) {
                this.activateEmergencyMode(signal);
            }
        });

        // Notify listeners
        if (this.onSignalsUpdatedCallback) {
            this.onSignalsUpdatedCallback([...this.signals]);
        }
    }

    /**
     * Transition to next light in the cycle
     */
    private transitionToNextLight(signal: TrafficSignal): void {
        switch (signal.currentLight) {
            case 'green':
                signal.currentLight = 'yellow';
                signal.countdown = signal.normalCycle.yellow;
                break;
            case 'yellow':
                signal.currentLight = 'red';
                signal.countdown = signal.normalCycle.red;
                break;
            case 'red':
                signal.currentLight = 'green';
                signal.countdown = signal.normalCycle.green;
                break;
        }
    }

    /**
     * Activate emergency mode for approaching ambulance
     */
    public activateEmergencyMode(signal: TrafficSignal): void {
        if (signal.emergencyOverride) return;

        signal.emergencyOverride = true;
        signal.status = 'emergency_mode';

        // Immediately switch to green for ambulance
        if (signal.currentLight !== 'green') {
            signal.currentLight = 'yellow';
            signal.countdown = 3; // Quick transition

            setTimeout(() => {
                signal.currentLight = 'green';
                signal.countdown = 60; // Extended green time
                signal.status = 'cleared_for_ambulance';
            }, 3000);
        } else {
            signal.countdown = Math.max(signal.countdown, 60); // Extend green time
            signal.status = 'cleared_for_ambulance';
        }

        console.log(`🚦 Emergency mode activated for signal ${signal.id}`);
    }

    /**
     * Deactivate emergency mode and return to normal cycle
     */
    public deactivateEmergencyMode(signalId: string): void {
        const signal = this.signals.find(s => s.id === signalId);
        if (!signal) return;

        signal.emergencyOverride = false;
        signal.status = 'normal';

        // Resume normal cycle
        signal.currentLight = 'yellow';
        signal.countdown = signal.normalCycle.yellow;

        console.log(`🚦 Emergency mode deactivated for signal ${signalId}`);
    }

    /**
     * Clear all emergency modes (when ambulance passes or emergency ends)
     */
    public clearAllEmergencyModes(): void {
        this.signals.forEach(signal => {
            if (signal.emergencyOverride) {
                this.deactivateEmergencyMode(signal.id);
            }
        });
    }

    /**
     * Manual signal override for emergency vehicles
     */
    public manualOverride(signalId: string): void {
        const signal = this.signals.find(s => s.id === signalId);
        if (!signal) return;

        this.activateEmergencyMode(signal);
    }

    /**
     * Get signal status by ID
     */
    public getSignalById(signalId: string): TrafficSignal | undefined {
        return this.signals.find(s => s.id === signalId);
    }

    /**
     * Subscribe to signal updates
     */
    public onSignalsUpdated(callback: (signals: TrafficSignal[]) => void): void {
        this.onSignalsUpdatedCallback = callback;
    }

    /**
     * Get all signals
     */
    public getAllSignals(): TrafficSignal[] {
        return [...this.signals];
    }

    /**
     * Stop the simulation
     */
    public stopSimulation(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * API call to get real traffic signals (for production)
     */
    private async fetchTrafficSignalsFromAPI(
        latitude: number,
        longitude: number,
        radius: number
    ): Promise<TrafficAPIResponse> {
        try {
            // This would be your actual API call
            const response = await fetch(`/api/traffic-signals?lat=${latitude}&lng=${longitude}&radius=${radius}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching traffic signals from API:', error);
            return { success: false, error: 'API call failed' };
        }
    }
}

export default TrafficSignalService;