import { Location } from './HospitalService';
import { LocationData } from './GPSService';
import { updateSignalDirection, getAmbulanceDirection, checkConnection } from './RaspberryPiService';
import { getApiBaseUrl } from '../config/piConfig';

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
    private apiBaseUrl: string = getApiBaseUrl();
    private useApiData: boolean = true;

    public static getInstance(): TrafficSignalService {
        if (!TrafficSignalService.instance) {
            TrafficSignalService.instance = new TrafficSignalService();
        }
        return TrafficSignalService.instance;
    }

    private constructor() {
        this.initializeSignals();
    }

    private async initializeSignals() {
        console.log('🔧 TrafficSignalService initializing...');
        const connected = await checkConnection();
        if (connected) {
            console.log('🔗 Raspberry Pi connected, fetching signals...');
            const apiSignals = await this.fetchSignalsFromAPI();
            if (apiSignals.length > 0) {
                this.signals = apiSignals;
                console.log(`✅ Loaded ${apiSignals.length} signals from Pi:`, apiSignals.map(s => s.id));
            } else {
                console.warn('⚠️  No signals returned from Pi API');
            }
        } else {
            console.warn('⚠️  Raspberry Pi not connected, using empty signal list');
        }
        this.startSimulation();
    }

    public async getNearbySignals(
        location: LocationData,
        radiusKm: number = 2.0
    ): Promise<TrafficSignal[]> {
        try {
            if (this.signals.length === 0) {
                const apiSignals = await this.fetchSignalsFromAPI();
                if (apiSignals.length > 0) {
                    this.signals = apiSignals;
                }
            }

            const nearbySignals = this.signals.filter(signal => {
                const distance = this.calculateDistance(
                    location.latitude,
                    location.longitude,
                    signal.location.latitude,
                    signal.location.longitude
                );

                signal.ambulanceProximity = distance * 1000;
                return distance <= radiusKm;
            });

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

    private updateTrafficLights(): void {
        this.signals.forEach(signal => {
            if (signal.emergencyOverride) {
                signal.currentLight = 'green';
                signal.countdown = 60;
                return;
            }

            signal.countdown--;

            if (signal.countdown <= 0) {
                this.transitionToNextLight(signal);
            }
        });

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

    public async activateEmergencyMode(signal: TrafficSignal, ambulanceHeading?: number): Promise<void> {
        if (signal.emergencyOverride) {
            console.log(`🚦 Signal ${signal.id} already in emergency mode`);
            return;
        }

        if (ambulanceHeading === undefined) {
            console.log(`🚦 Skipping signal ${signal.id} - no heading information`);
            return;
        }

        const ambulanceDirection = getAmbulanceDirection(ambulanceHeading);

        const shouldActivate = signal.direction === 'all_directions' ||
            signal.direction === ambulanceDirection;

        if (!shouldActivate) {
            console.log(`🚦 Signal ${signal.id} not in ambulance path (signal: ${signal.direction}, ambulance: ${ambulanceDirection})`);
            return;
        }

        signal.emergencyOverride = true;
        signal.status = 'emergency_mode';

        console.log(`🚨 Activating emergency mode for ${signal.id} [${ambulanceDirection}]`);

        if (signal.currentLight !== 'green') {
            signal.currentLight = 'yellow';
            signal.countdown = 3;

            const success = await updateSignalDirection(signal.id, ambulanceDirection, 'green');

            if (success) {
                setTimeout(() => {
                    signal.currentLight = 'green';
                    signal.countdown = 60;
                    signal.status = 'cleared_for_ambulance';
                    console.log(`✅ Signal ${signal.id} cleared for ambulance`);
                }, 3000);
            } else {
                console.error(`❌ Failed to activate signal ${signal.id}`);
                signal.emergencyOverride = false;
                signal.status = 'normal';
            }
        } else {
            signal.countdown = Math.max(signal.countdown, 60);
            signal.status = 'cleared_for_ambulance';
            const success = await updateSignalDirection(signal.id, ambulanceDirection, 'green');

            if (!success) {
                console.error(`❌ Failed to maintain green for signal ${signal.id}`);
            }
        }
    }

    /**
     * Deactivate emergency mode and return to normal cycle
     */
    public async deactivateEmergencyMode(signalId: string): Promise<void> {
        const signal = this.signals.find(s => s.id === signalId);
        if (!signal) return;

        signal.emergencyOverride = false;
        signal.status = 'normal';

        signal.currentLight = 'yellow';
        signal.countdown = signal.normalCycle.yellow;

        await updateSignalDirection(signal.id, signal.direction, 'red');

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

    public async manualOverride(signalId: string, ambulanceHeading?: number): Promise<void> {
        const signal = this.signals.find(s => s.id === signalId);
        if (!signal) return;

        await this.activateEmergencyMode(signal, ambulanceHeading);
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

    private async fetchSignalsFromAPI(): Promise<TrafficSignal[]> {
        if (!this.useApiData) {
            console.log('🔧 API data disabled, returning empty array');
            return [];
        }

        try {
            console.log(`🌐 Fetching signals from: ${this.apiBaseUrl}/signals`);
            const response = await fetch(`${this.apiBaseUrl}/signals`);
            if (!response.ok) throw new Error('API request failed');

            const data: TrafficAPIResponse = await response.json();
            console.log('📡 Raw API response:', data);
            return data.signals || [];
        } catch (error) {
            console.error('❌ Error fetching signals from API:', error);
            return [];
        }
    }
}

export default TrafficSignalService;