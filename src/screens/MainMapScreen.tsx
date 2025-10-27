import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedMapView from '../components/EnhancedMapView';
import MapDebugView from '../components/MapDebugView';
import GoogleMapsTestComponent from '../components/GoogleMapsTestComponent';
import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';
import PiConnectionIndicator from '../components/PiConnectionIndicator';
import HospitalSelectionBottomSheet from '../components/HospitalSelectionBottomSheet';
import NavigationPanel from '../components/NavigationPanel';
import EmergencyControls from '../components/EmergencyControls';
import EmergencyDashboard from '../components/EmergencyDashboard';
import EmergencyAlertBar from '../components/EmergencyAlertBar';
import TouchDebugger from '../components/TouchDebugger';
import TrafficSignalService, { TrafficSignal } from '../services/TrafficSignalService';
import TrafficSignalsPanel from '../components/TrafficSignalsPanel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { SERVER_CONFIG, getSocketUrl } from '../config/serverConfig';
import { RootStackParamList } from '../types/navigation';
import AdvancedSocketService, { ConnectionStatus, RouteCalculated, SignalCleared, ETAUpdate } from '../services/AdvancedSocketService';
import GPSService, { LocationData, GPSStatus } from '../services/GPSService';
import HospitalService, { Hospital, Location } from '../services/HospitalService';
import NavigationService, { NavigationRoute } from '../services/NavigationService';
import EmergencyService, {
  EmergencySession,
  EmergencyStats,
  TrafficSignalStatus,
  EmergencyEvent
} from '../services/EmergencyService';

type MainMapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainMap'>;

interface Props {
  navigation: MainMapScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const MainMapScreen: React.FC<Props> = ({ navigation }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GPSStatus | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [ambulanceId, setAmbulanceId] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [showHospitalSelection, setShowHospitalSelection] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showEmergencyDashboard, setShowEmergencyDashboard] = useState(false);
  const [showTrafficSignals, setShowTrafficSignals] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Emergency state
  const [emergencySession, setEmergencySession] = useState<EmergencySession | null>(null);
  const [emergencyStats, setEmergencyStats] = useState<EmergencyStats>({
    currentSpeed: 0,
    heading: 0,
    distanceToDestination: 0,
    estimatedArrival: 0,
    signalsCleared: 0,
    nextSignalDistance: null,
    routeProgress: 0,
    emergencyDuration: 0,
  });
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);

  // Service refs
  const socketService = useRef<AdvancedSocketService>(AdvancedSocketService.getInstance());
  const gpsService = useRef<GPSService>(GPSService.getInstance());
  const hospitalService = useRef<HospitalService>(HospitalService.getInstance());
  const navigationService = useRef<NavigationService>(NavigationService.getInstance());
  const emergencyService = useRef<EmergencyService>(EmergencyService.getInstance());
  const trafficSignalService = useRef<TrafficSignalService>(TrafficSignalService.getInstance());

  // Socket connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastSyncTime: null,
    queuedEvents: 0,
    serverLatency: null,
    lastConnected: null,
  });

  useEffect(() => {
    initializeApp();
    return cleanup;
  }, []);

  const initializeApp = async () => {
    try {
      setIsLoading(true);

      // Load ambulance ID
      const storedId = await AsyncStorage.getItem('ambulanceId');
      if (storedId) {
        setAmbulanceId(storedId);
      }

      // Initialize GPS
      await initializeGPS();

      // Initialize Socket connection
      await initializeSocket(storedId || 'AMB001');

      // Initialize Emergency Service
      await initializeEmergencyService();

      setIsLoading(false);
    } catch (error) {
      console.error('App initialization error:', error);
      Alert.alert('Initialization Error', 'Failed to initialize app. Please restart.');
      setIsLoading(false);
    }
  };

  const initializeGPS = async () => {
    try {
      // Throttle location updates to prevent excessive re-renders
      let lastLocationUpdate = 0;
      const LOCATION_UPDATE_THROTTLE = 1000; // 1 second minimum between updates

      gpsService.current.setLocationUpdateCallback(async (locationData) => {
        const now = Date.now();

        // Always update current location for precise tracking
        setCurrentLocation(prevLocation => {
          // Only trigger re-render if location changed significantly
          // Very sensitive threshold for mock location detection
          const latChanged = !prevLocation || Math.abs(prevLocation.latitude - locationData.latitude) > 0.0000001;
          const lngChanged = !prevLocation || Math.abs(prevLocation.longitude - locationData.longitude) > 0.0000001;
          const headingChanged = !prevLocation || Math.abs((prevLocation.heading || 0) - (locationData.heading || 0)) > 1;
          const speedChanged = !prevLocation || Math.abs((prevLocation.speed || 0) - (locationData.speed || 0)) > 0.5;

          if (latChanged || lngChanged || headingChanged || speedChanged) {
            console.log('Location updated:', {
              lat: locationData.latitude.toFixed(6),
              lng: locationData.longitude.toFixed(6),
              heading: locationData.heading?.toFixed(1),
              speed: locationData.speed?.toFixed(1),
              isNew: !prevLocation
            });
            return locationData;
          }
          return prevLocation;
        });

        // Throttle expensive operations
        if (now - lastLocationUpdate < LOCATION_UPDATE_THROTTLE) {
          return;
        }
        lastLocationUpdate = now;

        if (locationData.latitude && locationData.longitude) {
          const location = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          };

          // Update emergency service with current location and speed
          emergencyService.current.updateLocation(
            location,
            locationData.speed || 0,
            locationData.heading || 0
          );

          try {
            const nearbySignals = await trafficSignalService.current.getNearbySignals(locationData, 2.0);

            if (isEmergencyActive && locationData.heading !== undefined) {
              nearbySignals.forEach(signal => {
                if (signal.ambulanceProximity && signal.ambulanceProximity <= 500) {
                  trafficSignalService.current.activateEmergencyMode(signal, locationData.heading);
                }
              });
            }
          } catch (error) {
            console.warn('Error updating traffic signals:', error);
          }

          if (isNavigating && locationData.latitude && locationData.longitude) {
            // Update navigation progress
            // Navigation service will handle progress updates internally
          }
        }
      });

      gpsService.current.setStatusChangeCallback(setGpsStatus);

      // GPSService initializes itself in the constructor, so no need to call initialize()
      // If you need to re-request permissions or start tracking, call those methods instead
      await gpsService.current.requestPermissions();
      await gpsService.current.startTracking();

    } catch (error) {
      console.error('GPS initialization error:', error);
      Alert.alert('GPS Error', 'Unable to access location services');
    }
  };

  const initializeSocket = async (ambId: string) => {
    try {
      // Always initialize socket service (required even for offline mode)
      const socketUrl = getSocketUrl();

      // Initialize with empty URL for offline mode
      await socketService.current.initialize(socketUrl || 'offline', ambId);

      if (socketUrl && !SERVER_CONFIG.OFFLINE_MODE) {
        try {
          await socketService.current.connect();
        } catch (error) {
          console.warn('Socket server unavailable, continuing in offline mode:', error);
        }
      } else {
        console.log('Running in offline mode - socket connection skipped');
      }

      // Set up event listeners (always set up, even in offline mode)
      socketService.current.setOnConnectionChangeCallback(setConnectionStatus);

      socketService.current.setOnRouteCalculatedCallback((data: RouteCalculated) => {
        console.log('Route calculated:', data);
        // Handle route data from server
      });

      socketService.current.setOnSignalClearedCallback((data: SignalCleared) => {
        console.log('Signal cleared:', data);
        emergencyService.current.handleSignalCleared(data.signalId, data.clearanceDuration);
        Alert.alert('Traffic Signal Cleared', `Signal cleared for ${data.clearanceDuration}s`);
      });

      socketService.current.setOnETAUpdateCallback((data: ETAUpdate) => {
        console.log('ETA updated:', data);
        // Update navigation with new ETA
      });

      // Only connect if not in offline mode
      if (socketUrl && !SERVER_CONFIG.OFFLINE_MODE) {
        await socketService.current.connect();
      }

    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  };

  const initializeEmergencyService = async () => {
    try {
      // Set up emergency service listeners
      emergencyService.current.onEmergencyStateChanged((isActive, session) => {
        setIsEmergencyActive(isActive);
        setEmergencySession(session || null);
      });

      emergencyService.current.onStatsUpdated(setEmergencyStats);

      // Set up traffic signal monitoring with new service
      trafficSignalService.current.onSignalsUpdated(setTrafficSignals);

      emergencyService.current.onCriticalEventOccurred((event: EmergencyEvent) => {
        handleCriticalEvent(event);
      });

    } catch (error) {
      console.error('Emergency service initialization error:', error);
    }
  };

  const handleCriticalEvent = (event: EmergencyEvent) => {
    switch (event.type) {
      case 'stopped':
        Alert.alert(
          'Ambulance Stopped',
          `Vehicle has been stationary during emergency. Speed: ${event.data?.speed || 0} km/h`,
          [{ text: 'OK', style: 'default' }]
        );
        break;
      case 'speed_violation':
        Alert.alert(
          'Speed Warning',
          `High speed detected: ${event.data?.speed || 0} km/h. Drive safely.`,
          [{ text: 'OK', style: 'default' }]
        );
        break;
      case 'route_deviation':
        Alert.alert(
          'Route Deviation',
          'Vehicle has deviated from planned route. Recalculating...',
          [{ text: 'OK', style: 'default' }]
        );
        break;
    }
  };

  const cleanup = () => {
    gpsService.current?.dispose();
    socketService.current?.disconnect();
    navigationService.current?.clearRoute();
    emergencyService.current?.cleanup();
  };

  const handleStartEmergency = async (hospital?: Hospital) => {
    try {
      if (currentLocation == null || currentLocation.latitude == null || currentLocation.longitude == null) {
        Alert.alert('Error', 'Current location not available');
        return;
      }

      const destination = hospital ? {
        name: hospital.name,
        location: hospital.location,
      } : undefined;

      const location = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      };

      await emergencyService.current.startEmergency(ambulanceId, location, destination);

      if (hospital) {
        setSelectedHospital(hospital);
        emergencyService.current.setDestination(
          hospital.location,
          currentRoute?.totalDistance || 0
        );
      }

      // Update socket service emergency mode
      socketService.current.startEmergencyLocationSync(() => currentLocation);

      // Activate emergency mode for nearby traffic signals
      if (currentLocation) {
        const nearbySignals = await trafficSignalService.current.getNearbySignals(currentLocation, 2.0);
        nearbySignals.forEach(signal => {
          if (signal.ambulanceProximity && signal.ambulanceProximity <= 500) { // 500m activation range
            trafficSignalService.current.activateEmergencyMode(signal);
          }
        });
      }

      Alert.alert('Emergency Activated', 'Emergency mode is now active. All systems engaged.');

    } catch (error) {
      console.error('Emergency start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to start emergency: ${errorMessage}`);
    }
  };

  const handleEndEmergency = async () => {
    try {
      await emergencyService.current.endEmergency('manual');
      socketService.current.startNormalLocationSync(() => currentLocation);

      // Clear all emergency modes from traffic signals
      trafficSignalService.current.clearAllEmergencyModes();

      // Clear navigation state
      setCurrentRoute(null);
      setIsNavigating(false);
      setSelectedHospital(null);
      navigationService.current.clearRoute();

      Alert.alert('Emergency Ended', 'Emergency mode has been deactivated.');

    } catch (error) {
      console.error('Emergency end error:', error);
      Alert.alert('Error', 'Failed to end emergency mode');
    }
  };

  const handleManualSignalOverride = () => {
    // Get the nearest traffic signal
    const nearestSignal = trafficSignals
      .filter(s => s.ambulanceProximity && s.ambulanceProximity <= 1000)
      .sort((a, b) => (a.ambulanceProximity || 0) - (b.ambulanceProximity || 0))[0];

    if (nearestSignal) {
      trafficSignalService.current.manualOverride(nearestSignal.id);
      Alert.alert(
        'Signal Override',
        `Traffic signal ${nearestSignal.id} has been manually overridden to green.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'No Signal Found',
        'No traffic signals found within 1km range for manual override.',
        [{ text: 'OK' }]
      );
    }
  }; const handleHospitalSelect = async (hospital: Hospital) => {
    try {
      setSelectedHospital(hospital);

      // Add to recent hospitals
      await hospitalService.current.addToRecentHospitals(hospital);

      if (isEmergencyActive) {
        // If emergency is active, update destination
        emergencyService.current.setDestination(
          hospital.location,
          currentRoute?.totalDistance || 0
        );
      } else {
        // Show navigation panel
        setShowNavigation(true);
      }

    } catch (error) {
      console.error('Hospital selection error:', error);
      Alert.alert('Error', 'Failed to select hospital');
    }
  };

  const handleNearestHospital = async (hospital: Hospital | null) => {
    if (hospital) {
      await handleHospitalSelect(hospital);

      if (!isEmergencyActive) {
        // Start emergency with nearest hospital
        await handleStartEmergency(hospital);
      }

      Alert.alert('Nearest Hospital', `Selected: ${hospital.name}`);
    } else {
      Alert.alert('No Hospitals', 'No nearby emergency hospitals found');
    }
  };

  const handleRouteUpdate = (route: NavigationRoute | null) => {
    setCurrentRoute(route);

    if (route && selectedHospital && isEmergencyActive) {
      emergencyService.current.setDestination(
        selectedHospital.location,
        route.totalDistance
      );
    }
  };

  const handleNavigationStart = () => {
    setIsNavigating(true);
    setShowNavigation(false);

    // Update socket service with route information
    if (selectedHospital && currentLocation && currentLocation.latitude != null && currentLocation.longitude != null) {
      socketService.current.requestEmergencyRoute(
        {
          latitude: selectedHospital.location.latitude,
          longitude: selectedHospital.location.longitude,
          name: selectedHospital.name,
          type: 'hospital' as const
        },
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          timestamp: currentLocation.timestamp,
        },
        isEmergencyActive ? 'high' : 'medium'
      );
    }

    Alert.alert('Navigation Started', 'Following route to selected hospital');
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    setCurrentRoute(null);
    navigationService.current.clearRoute();
  };

  const handleManualReconnect = () => {
    socketService.current.connect();
  };

  const handleClearQueue = () => {
    socketService.current.clearEventQueue();
  };

  const convertLocationDataToLocation = (locationData: LocationData | null): Location | null => {
    if (!locationData || locationData.latitude == null || locationData.longitude == null) return null;
    return {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing Ambulance System...</Text>
        {connectionStatus && !connectionStatus.isConnected && (
          <Text style={{ color: 'red', marginTop: 16, textAlign: 'center' }}>
            Unable to connect to server. Running in offline mode.{'\n'}
            Some features may be unavailable.
          </Text>
        )}
        <Text style={{ color: 'gray', marginTop: 8, textAlign: 'center' }}>
          If the map does not load, check your Google Maps API key and internet connection.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Emergency Alert Bar */}
      <EmergencyAlertBar
        isVisible={isEmergencyActive}
        duration={emergencyStats.emergencyDuration}
        signalsCleared={emergencyStats.signalsCleared}
        onTap={() => setShowEmergencyDashboard(true)}
      />

      {/* Map View */}
      <EnhancedMapView
        style={styles.map}
        currentLocation={currentLocation}
        hospitals={selectedHospital ? [selectedHospital] : []}
        gpsStatus={gpsStatus || undefined}
      />

      {/* Loading overlay when no location */}
      {!currentLocation && (
        <View style={styles.loadingOverlay}>
          <Text style={{ color: '#666', fontSize: 18, marginBottom: 8 }}>🗺️ Loading Map...</Text>
          <Text style={{ color: 'gray', textAlign: 'center', paddingHorizontal: 20 }}>
            {gpsStatus?.isTracking ? 'GPS is active, waiting for location data...' : 'Initializing GPS services...'}
          </Text>
          <View style={{ marginTop: 20, padding: 20, backgroundColor: '#e3f2fd', borderRadius: 10, marginHorizontal: 20 }}>
            <Text style={{ color: '#1976d2', fontSize: 14, textAlign: 'center' }}>
              💡 If you don't have a Google Maps API key, the app will show a fallback map with your location.
            </Text>
          </View>
        </View>
      )}

      {/* Touch Debug Test - Temporary */}
      <View style={{ position: 'absolute', top: 100, right: 10, zIndex: 9999 }}>
        <TouchDebugger label="Debug Touch" testId="main-screen-touch-test" />
      </View>

      {/* Status Overlay */}
      <View style={[styles.statusContainer, { marginTop: isEmergencyActive ? 60 : 0 }]} pointerEvents="box-none">
        <ConnectionStatusIndicator
          connectionStatus={connectionStatus}
          onManualReconnect={handleManualReconnect}
          onClearQueue={handleClearQueue}
          style={styles.connectionStatus}
        />
      </View>

      {/* GPS Status */}
      {gpsStatus && (
        <View style={[styles.gpsContainer, { marginTop: isEmergencyActive ? 60 : 0 }]} pointerEvents="box-none">
          <View style={[styles.gpsStatus,
          { backgroundColor: gpsStatus.locationServicesEnabled ? '#4CAF50' : '#F44336' }
          ]}>
            <Ionicons
              name={gpsStatus.locationServicesEnabled ? "location" : "close-outline"}
              size={16}
              color="#fff"
            />
            <Text style={styles.gpsText}>
              {gpsStatus.locationServicesEnabled ?
                `GPS: ${gpsStatus.accuracy?.toFixed(0)}m` :
                'GPS Disabled'
              }
            </Text>
          </View>
        </View>
      )}

      {/* Raspberry Pi Connection Status */}
      <View style={[styles.piContainer, { marginTop: isEmergencyActive ? 60 : 0 }]} pointerEvents="box-none">
        <PiConnectionIndicator />
      </View>

      {/* Current Route Info */}
      {currentRoute && isNavigating && !isEmergencyActive && (
        <View style={styles.routeInfoContainer}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeText}>
              {navigationService.current.formatDistance(currentRoute.totalDistance)} • {navigationService.current.formatDuration(currentRoute.totalDuration)}
            </Text>
            <Text style={styles.destinationText}>
              To: {selectedHospital?.name || 'Hospital'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopNavigation}
          >
            <Ionicons name="stop" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        {!isEmergencyActive ? (
          <>
            {/* Hospital Selection Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.hospitalButton]}
              onPress={() => {
                console.log('Hospital button pressed');
                setShowHospitalSelection(true);
              }}
              disabled={!currentLocation}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="medical" size={24} color="#fff" />
              <Text style={styles.buttonText}>Hospitals</Text>
            </TouchableOpacity>

            {/* Settings Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.settingsButton]}
              onPress={() => {
                console.log('Settings button pressed');
                navigation.navigate('Settings');
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings" size={24} color="#fff" />
              <Text style={styles.buttonText}>Settings</Text>
            </TouchableOpacity>

            {/* Traffic Signals Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.hospitalButton]}
              onPress={() => {
                console.log('Traffic signals button pressed');
                setShowTrafficSignals(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="radio-button-off" size={24} color="#fff" />
              <Text style={styles.buttonText}>Traffic</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* Emergency Controls */}
      <View style={styles.emergencyControlsContainer} pointerEvents="box-none">
        <EmergencyControls
          isEmergencyActive={isEmergencyActive}
          emergencyDuration={emergencyStats.emergencyDuration}
          onStartEmergency={handleStartEmergency}
          onEndEmergency={handleEndEmergency}
          onManualOverride={handleManualSignalOverride}
          selectedHospital={selectedHospital || undefined}
          currentLocation={convertLocationDataToLocation(currentLocation) || undefined}
          disabled={!currentLocation}
        />
      </View>

      {/* Bottom Sheets and Modals */}
      <HospitalSelectionBottomSheet
        visible={showHospitalSelection}
        userLocation={convertLocationDataToLocation(currentLocation)}
        onClose={() => setShowHospitalSelection(false)}
        onHospitalSelect={handleHospitalSelect}
        onNearestHospital={handleNearestHospital}
        selectedHospitalId={selectedHospital?.id}
      />

      <NavigationPanel
        visible={showNavigation}
        currentLocation={convertLocationDataToLocation(currentLocation)}
        destination={selectedHospital}
        isEmergency={isEmergencyActive}
        onClose={() => setShowNavigation(false)}
        onRouteUpdate={handleRouteUpdate}
        onNavigationStart={handleNavigationStart}
      />

      <EmergencyDashboard
        visible={showEmergencyDashboard}
        stats={emergencyStats}
        signals={trafficSignals}
        destination={selectedHospital || undefined}
        onManualOverride={handleManualSignalOverride}
        onClose={() => setShowEmergencyDashboard(false)}
      />

      <TrafficSignalsPanel
        visible={showTrafficSignals}
        signals={trafficSignals}
        onClose={() => setShowTrafficSignals(false)}
        onManualOverride={(signalId) => trafficSignalService.current.manualOverride(signalId)}
      />

      {/* Temporary Google Maps Test Component */}
      <GoogleMapsTestComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  connectionStatus: {
    marginBottom: 8,
  },
  gpsContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
  },
  piContainer: {
    position: 'absolute',
    top: 110,
    right: 16,
  },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  gpsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  routeInfoContainer: {
    position: 'absolute',
    top: 160,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  destinationText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  stopButton: {
    backgroundColor: '#F44336',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 280,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  hospitalButton: {
    backgroundColor: '#4CAF50',
  },
  settingsButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  emergencyControlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
});

export default MainMapScreen;