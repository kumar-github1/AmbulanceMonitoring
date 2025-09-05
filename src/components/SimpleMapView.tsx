import React from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';

interface Location {
  latitude: number;
  longitude: number;
}

interface Hospital {
  id: string;
  name: string;
  location: Location;
}

interface Props {
  style: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

const SimpleMapView: React.FC<Props> = ({ style, initialRegion, showsUserLocation, children }) => {
  return (
    <View style={[styles.mapContainer, style]}>
      <Text style={styles.mapTitle}>🗺️ GPS Location View</Text>
      
      {initialRegion && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            📍 Current Location:
          </Text>
          <Text style={styles.coordinates}>
            Lat: {initialRegion.latitude.toFixed(6)}
          </Text>
          <Text style={styles.coordinates}>
            Lng: {initialRegion.longitude.toFixed(6)}
          </Text>
        </View>
      )}

      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>🚑</Text>
        <Text style={styles.placeholderSubtext}>You Are Here</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          📱 This is a simplified view for Expo Go testing.
        </Text>
        <Text style={styles.infoText}>
          🗺️ Full interactive maps will work in production builds.
        </Text>
        <Text style={styles.infoText}>
          🏥 Hospital markers and navigation ready for deployment.
        </Text>
      </View>

      {children}
    </View>
  );
};

// Simple marker component for compatibility
export const Marker: React.FC<{
  coordinate: Location;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}> = ({ coordinate, title, pinColor = 'red', onPress }) => {
  return (
    <View style={styles.marker}>
      <Text style={styles.markerText}>
        {pinColor === 'blue' ? '🏥' : '📍'}
      </Text>
      {title && (
        <Text style={styles.markerTitle}>{title}</Text>
      )}
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 20,
  },
  locationInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 8,
  },
  coordinates: {
    fontSize: 16,
    color: '#388E3C',
    fontFamily: 'monospace',
  },
  mapPlaceholder: {
    width: width * 0.7,
    height: width * 0.5,
    backgroundColor: '#C8E6C9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  info: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 12,
    maxWidth: width * 0.9,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 4,
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerText: {
    fontSize: 24,
  },
  markerTitle: {
    fontSize: 12,
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default SimpleMapView;