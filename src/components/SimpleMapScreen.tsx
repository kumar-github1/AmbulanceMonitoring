import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedMapView from './EnhancedMapView';
import GPSService, { LocationData, GPSStatus } from '../services/GPSService';

const { width, height } = Dimensions.get('window');

interface Props {
  onPickupSelect?: () => void;
}

const SimpleMapScreen: React.FC<Props> = ({ onPickupSelect }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GPSStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const gpsService = useRef<GPSService>(GPSService.getInstance());

  useEffect(() => {
    initializeGPS();
    return () => {
      gpsService.current?.dispose();
    };
  }, []);

  const initializeGPS = async () => {
    try {
      gpsService.current.setLocationUpdateCallback((locationData) => {
        setCurrentLocation(locationData);
        setIsLoading(false);
      });

      gpsService.current.setStatusChangeCallback(setGpsStatus);

      await gpsService.current.requestPermissions();
      await gpsService.current.startTracking();
    } catch (error) {
      console.error('GPS initialization error:', error);
      setIsLoading(false);
    }
  };

  const handlePickupSelect = () => {
    if (onPickupSelect) {
      onPickupSelect();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Map View */}
      <EnhancedMapView
        style={styles.map}
        currentLocation={currentLocation}
        hospitals={[]}
        gpsStatus={gpsStatus || undefined}
      />

      {/* Center Pin */}
      <View style={styles.centerPin}>
        <View style={styles.pinIcon}>
          <Ionicons name="location" size={30} color="#4CAF50" />
        </View>
      </View>

      {/* Location Card */}
      <View style={styles.locationCard}>
        <View style={styles.locationInfo}>
          <View style={styles.locationDot} />
          <View style={styles.locationText}>
            <Text style={styles.locationName}>
              {currentLocation ? 'Current Location' : 'Locating...'}
            </Text>
            <Text style={styles.locationAddress}>
              {currentLocation
                ? `${currentLocation.latitude?.toFixed(6)}, ${currentLocation.longitude?.toFixed(6)}`
                : 'Getting your location...'
              }
            </Text>
          </View>
        </View>
      </View>

      {/* Select Pickup Button */}
      <TouchableOpacity
        style={styles.selectButton}
        onPress={handlePickupSelect}
        disabled={!currentLocation}
      >
        <Text style={styles.selectButtonText}>Select Pickup</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -15,
    zIndex: 100,
  },
  pinIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCard: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  locationText: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  selectButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FFC107',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  selectButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});

export default SimpleMapScreen;