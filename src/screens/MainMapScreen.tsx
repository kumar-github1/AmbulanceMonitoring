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
import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';
import HospitalSelectionBottomSheet from '../components/HospitalSelectionBottomSheet';
import NavigationPanel from '../components/NavigationPanel';
import EmergencyControls from '../components/EmergencyControls';
import EmergencyDashboard from '../components/EmergencyDashboard';
import EmergencyAlertBar from '../components/EmergencyAlertBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
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
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignalStatus[]>([]);

  // Service refs
  const socketService = useRef<AdvancedSocketService>(AdvancedSocketService.getInstance());
  const gpsService = useRef<GPSService>(GPSService.getInstance());
  const hospitalService = useRef<HospitalService>(HospitalService.getInstance());
  const navigationService = useRef<NavigationService>(NavigationService.getInstance());
  const emergencyService = useRef<EmergencyService>(EmergencyService.getInstance());

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
      gpsService.current.onLocationUpdate((locationData) => {
        setCurrentLocation(locationData);
        
        if (locationData.coords) {
          const location = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
          };
          
          // Update emergency service with current location and speed
          emergencyService.current.updateLocation(
            location, 
            locationData.coords.speed || 0,
            locationData.coords.heading || 0
          );

          if (isNavigating && locationData.coords) {
            // Update navigation progress
            // Navigation service will handle progress updates internally
          }
        }
      });

      gpsService.current.onStatusChange(setGpsStatus);

      await gpsService.current.initialize({
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });

    } catch (error) {
      console.error('GPS initialization error:', error);
      Alert.alert('GPS Error', 'Unable to access location services');
    }
  };

  const initializeSocket = async (ambId: string) => {
    try {
      // Initialize socket service
      await socketService.current.initialize('ws://10.144.117.52:3001', ambId);

      // Set up event listeners
      socketService.current.onConnectionStatusChange(setConnectionStatus);
      
      socketService.current.onRouteCalculated((data: RouteCalculated) => {
        console.log('Route calculated:', data);
        // Handle route data from server
      });

      socketService.current.onSignalCleared((data: SignalCleared) => {
        console.log('Signal cleared:', data);
        emergencyService.current.handleSignalCleared(data.signalId, data.clearanceDuration);
        Alert.alert('Traffic Signal Cleared', `Signal cleared for ${data.clearanceDuration}s`);
      });

      socketService.current.onETAUpdate((data: ETAUpdate) => {
        console.log('ETA updated:', data);
        // Update navigation with new ETA
      });

      // Connect
      await socketService.current.connect();

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
      emergencyService.current.onSignalsUpdated(setTrafficSignals);
      
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
    gpsService.current?.cleanup();
    socketService.current?.disconnect();
    navigationService.current?.clearRoute();
    emergencyService.current?.cleanup();
  };

  const handleStartEmergency = async (hospital?: Hospital) => {
    try {
      if (!currentLocation?.coords) {
        Alert.alert('Error', 'Current location not available');
        return;
      }

      const location = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      const destination = hospital ? {
        name: hospital.name,
        location: hospital.location,
      } : undefined;

      await emergencyService.current.startEmergency(ambulanceId, location, destination);
      
      if (hospital) {
        setSelectedHospital(hospital);
        emergencyService.current.setDestination(
          hospital.location, 
          currentRoute?.totalDistance || 0
        );
      }

      // Update socket service emergency mode
      await socketService.current.setEmergencyMode(true);
      
      Alert.alert('Emergency Activated', 'Emergency mode is now active. All systems engaged.');

    } catch (error) {
      console.error('Emergency start error:', error);
      Alert.alert('Error', `Failed to start emergency: ${error.message}`);
    }
  };

  const handleEndEmergency = async () => {
    try {
      await emergencyService.current.endEmergency('manual');
      await socketService.current.setEmergencyMode(false);
      
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

  const handleManualSignalOverride = async () => {
    try {
      if (!currentLocation?.coords) {
        Alert.alert('Error', 'Current location not available');
        return;
      }

      const location = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      await emergencyService.current.requestManualSignalClearance(location);
      Alert.alert('Signal Clearance', 'Manual signal clearance requested');

    } catch (error) {
      console.error('Manual override error:', error);
      Alert.alert('Error', 'Failed to request signal clearance');
    }
  };

  const handleHospitalSelect = async (hospital: Hospital) => {
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
    if (selectedHospital && currentLocation?.coords) {
      socketService.current.requestEmergencyRoute(
        selectedHospital.location,
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
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
    if (!locationData?.coords) return null;
    return {
      latitude: locationData.coords.latitude,
      longitude: locationData.coords.longitude,
    };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing Ambulance System...</Text>
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
        route={currentRoute}
        isEmergencyMode={isEmergencyActive}
        showTrafficSignals={isNavigating}
      />

      {/* Status Overlay */}
      <View style={[styles.statusContainer, { marginTop: isEmergencyActive ? 60 : 0 }]}>
        <ConnectionStatusIndicator
          connectionStatus={connectionStatus}
          onManualReconnect={handleManualReconnect}
          onClearQueue={handleClearQueue}
          style={styles.connectionStatus}
        />
      </View>

      {/* GPS Status */}
      {gpsStatus && (
        <View style={[styles.gpsContainer, { marginTop: isEmergencyActive ? 60 : 0 }]}>
          <View style={[styles.gpsStatus, 
            { backgroundColor: gpsStatus.isEnabled ? '#4CAF50' : '#F44336' }
          ]}>
            <Ionicons 
              name={gpsStatus.isEnabled ? "location" : "location-off"} 
              size={16} 
              color="#fff" 
            />
            <Text style={styles.gpsText}>
              {gpsStatus.isEnabled ? 
                `GPS: ${gpsStatus.accuracy?.toFixed(0)}m` : 
                'GPS Disabled'
              }
            </Text>
          </View>
        </View>
      )}

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
      <View style={styles.controlsContainer}>
        {!isEmergencyActive ? (
          <>
            {/* Hospital Selection Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.hospitalButton]}
              onPress={() => setShowHospitalSelection(true)}
              disabled={!currentLocation}
            >
              <Ionicons name="medical" size={24} color="#fff" />
              <Text style={styles.buttonText}>Hospitals</Text>
            </TouchableOpacity>

            {/* Settings Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.settingsButton]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings" size={24} color="#fff" />
              <Text style={styles.buttonText}>Settings</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* Emergency Controls */}
      <View style={styles.emergencyControlsContainer}>
        <EmergencyControls
          isEmergencyActive={isEmergencyActive}
          emergencyDuration={emergencyStats.emergencyDuration}
          onStartEmergency={handleStartEmergency}
          onEndEmergency={handleEndEmergency}
          onManualOverride={handleManualSignalOverride}
          selectedHospital={selectedHospital}
          currentLocation={convertLocationDataToLocation(currentLocation)}
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
        destination={selectedHospital}
        onManualOverride={handleManualSignalOverride}
        onClose={() => setShowEmergencyDashboard(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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