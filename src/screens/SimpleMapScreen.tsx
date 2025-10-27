import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as RaspberryPiService from '../services/RaspberryPiService';

interface LocationData {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
}

interface Hospital {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance?: number;
  specialties: string[];
}

interface TrafficSignal {
  id: string;
  latitude: number;
  longitude: number;
  status: 'red' | 'green' | 'yellow' | 'unknown';
  lastUpdated: number;
  distanceFromStart: number;
  isControlled?: boolean; // Whether this signal is being controlled by emergency system
}

interface SimulationState {
  isSimulating: boolean;
  currentRouteIndex: number;
  progress: number; // 0 to 1
  distanceTraveled: number; // in km
  estimatedTimeArrival: number; // in minutes
  simulatedSpeed: number; // in km/h
}

const SimpleMapScreen: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [nearbyHospitals, setNearbyHospitals] = useState<Hospital[]>([]);
  const [hospitalCache, setHospitalCache] = useState<{ [key: string]: Hospital[] }>({});
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number, longitude: number }[]>([]);
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isSimulating: false,
    currentRouteIndex: 0,
    progress: 0,
    distanceTraveled: 0,
    estimatedTimeArrival: 0,
    simulatedSpeed: 80, // 80 km/h emergency speed
  });
  const [simulatedLocation, setSimulatedLocation] = useState<{ latitude: number, longitude: number } | null>(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      loadNearbyHospitals();
    }
  }, [currentLocation]);

  // Google Places API configuration
  const GOOGLE_PLACES_API_KEY = 'AIzaSyDiw_O1PqliBRrbAaosnsMK_VXnzNt-m60'; // Using the API key from .env
  const PLACES_API_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const generateCacheKey = (latitude: number, longitude: number, radius: number = 10000): string => {
    // Round to 2 decimal places for caching (roughly 1km grid)
    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLng = Math.round(longitude * 100) / 100;
    return `nearby_${roundedLat}_${roundedLng}_${radius}`;
  };

  const loadCachedHospitals = async (cacheKey: string): Promise<Hospital[] | null> => {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { hospitals, timestamp } = JSON.parse(cached);
        // Cache expires after 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          console.log('Loading hospitals from cache');
          return hospitals;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Error loading cached hospitals:', error);
    }
    return null;
  };

  const saveCachedHospitals = async (cacheKey: string, hospitals: Hospital[]) => {
    try {
      const cacheData = {
        hospitals,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('Hospitals cached successfully');
    } catch (error) {
      console.error('Error caching hospitals:', error);
    }
  };

  const loadNearbyHospitals = async () => {
    if (!currentLocation) return;

    try {
      const { latitude, longitude } = currentLocation;
      const cacheKey = generateCacheKey(latitude, longitude);

      // Try to load from cache first
      const cachedHospitals = await loadCachedHospitals(cacheKey);
      if (cachedHospitals) {
        // Recalculate distances for cached hospitals
        const hospitalsWithDistance = cachedHospitals.map(hospital => ({
          ...hospital,
          distance: calculateDistance(latitude, longitude, hospital.latitude, hospital.longitude)
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));

        setNearbyHospitals(hospitalsWithDistance);
        return;
      }

      // If no cache, fetch from API
      const nearbyUrl = `${PLACES_API_BASE_URL}/nearbysearch/json?` +
        `location=${latitude},${longitude}&` +
        `radius=10000&` + // 10km radius
        `type=hospital&` +
        `key=${GOOGLE_PLACES_API_KEY}`;

      console.log('Fetching nearby hospitals from API...');
      const response = await fetch(nearbyUrl);
      const data = await response.json();

      if (data.status === 'OK') {
        const hospitals: Hospital[] = data.results.map((place: any) => ({
          id: place.place_id,
          name: place.name,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          distance: calculateDistance(
            latitude,
            longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          ),
          specialties: place.types?.filter((type: string) =>
            ['hospital', 'health', 'doctor', 'pharmacy'].includes(type)
          ) || ['Hospital']
        }));

        // Sort by distance
        hospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        const limitedHospitals = hospitals.slice(0, 20);

        setNearbyHospitals(limitedHospitals);

        // Cache the results
        await saveCachedHospitals(cacheKey, limitedHospitals);

        console.log(`Found ${limitedHospitals.length} nearby hospitals`);
      } else {
        console.error('Google Places API error:', data.status, data.error_message);
        // Fallback to mock data if API fails
        loadMockHospitals();
      }
    } catch (error) {
      console.error('Error fetching nearby hospitals:', error);
      // Fallback to mock data if network fails
      loadMockHospitals();
    }
  };

  const loadMockHospitals = () => {
    if (!currentLocation) return;

    const mockHospitals: Hospital[] = [
      { id: '1', name: 'City General Hospital', latitude: currentLocation.latitude + 0.001, longitude: currentLocation.longitude + 0.001, specialties: ['Emergency', 'Cardiology'] },
      { id: '2', name: 'Emergency Medical Center', latitude: currentLocation.latitude + 0.002, longitude: currentLocation.longitude - 0.001, specialties: ['Emergency', 'Trauma'] },
      { id: '3', name: 'Regional Health Hospital', latitude: currentLocation.latitude - 0.001, longitude: currentLocation.longitude + 0.002, specialties: ['Emergency', 'Pediatrics'] },
    ];

    const hospitalsWithDistance = mockHospitals.map(hospital => ({
      ...hospital,
      distance: calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        hospital.latitude,
        hospital.longitude
      )
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0));

    setNearbyHospitals(hospitalsWithDistance);
  };

  const searchHospitals = async (query: string) => {
    if (!currentLocation || !query.trim()) {
      loadNearbyHospitals();
      return;
    }

    try {
      const { latitude, longitude } = currentLocation;

      // Google Places Text Search for hospitals
      const searchUrl = `${PLACES_API_BASE_URL}/textsearch/json?` +
        `query=${encodeURIComponent(query + ' hospital')}&` +
        `location=${latitude},${longitude}&` +
        `radius=20000&` + // 20km radius for search
        `key=${GOOGLE_PLACES_API_KEY}`;

      console.log('Searching hospitals for:', query);
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.status === 'OK') {
        const hospitals: Hospital[] = data.results
          .filter((place: any) =>
            place.types?.includes('hospital') ||
            place.name.toLowerCase().includes('hospital') ||
            place.name.toLowerCase().includes('medical') ||
            place.name.toLowerCase().includes('clinic')
          )
          .map((place: any) => ({
            id: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            distance: calculateDistance(
              latitude,
              longitude,
              place.geometry.location.lat,
              place.geometry.location.lng
            ),
            specialties: place.types?.filter((type: string) =>
              ['hospital', 'health', 'doctor', 'pharmacy'].includes(type)
            ) || ['Hospital']
          }));

        // Sort by distance
        hospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        setNearbyHospitals(hospitals.slice(0, 15)); // Limit to 15 search results
        console.log(`Found ${hospitals.length} hospitals for "${query}"`);
      } else {
        console.error('Google Places search error:', data.status);
      }
    } catch (error) {
      console.error('Error searching hospitals:', error);
    }
  };

  const handleEmergencyPress = () => {
    if (isEmergencyActive) {
      // Stop emergency
      setIsEmergencyActive(false);
      setSelectedHospital(null);
      setRouteCoordinates([]);
      setTrafficSignals([]);
      setSimulationState({
        isSimulating: false,
        currentRouteIndex: 0,
        progress: 0,
        distanceTraveled: 0,
        estimatedTimeArrival: 0,
        simulatedSpeed: 80,
      });
      setSimulatedLocation(null);
      Alert.alert('Emergency Deactivated', '🚨 Emergency simulation stopped.\nAll systems returned to normal.');
    } else {
      // Start emergency - show hospital selection
      setShowHospitalModal(true);
    }
  };

  const getRoute = async (destination: Hospital) => {
    if (!currentLocation) return;

    try {
      const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
      const dest = `${destination.latitude},${destination.longitude}`;

      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin}&` +
        `destination=${dest}&` +
        `key=${GOOGLE_PLACES_API_KEY}`;

      const response = await fetch(directionsUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        // Find traffic signals along the route
        await findTrafficSignalsAlongRoute(points);

        console.log('Route loaded successfully');
      } else {
        console.error('Directions API error:', data.status);
        // Fallback to straight line
        setRouteCoordinates([
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          { latitude: destination.latitude, longitude: destination.longitude }
        ]);
      }
    } catch (error) {
      console.error('Error getting route:', error);
      // Fallback to straight line
      setRouteCoordinates([
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: destination.latitude, longitude: destination.longitude }
      ]);
    }
  };

  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  const findTrafficSignalsAlongRoute = async (route: { latitude: number, longitude: number }[]) => {
    if (route.length === 0) return;

    try {
      const signals: TrafficSignal[] = [];

      // Sample points along the route (every 500m approximately)
      const samplePoints = sampleRoutePoints(route, 500);

      for (const point of samplePoints) {
        // Search for intersections and traffic lights near each point
        const nearbyUrl = `${PLACES_API_BASE_URL}/nearbysearch/json?` +
          `location=${point.latitude},${point.longitude}&` +
          `radius=200&` + // 200m radius around each point
          `keyword=traffic light intersection&` +
          `key=${GOOGLE_PLACES_API_KEY}`;

        try {
          const response = await fetch(nearbyUrl);
          const data = await response.json();

          if (data.status === 'OK') {
            data.results.forEach((place: any) => {
              // Check if we already have this signal
              const existingSignal = signals.find(s =>
                calculateDistance(s.latitude, s.longitude, place.geometry.location.lat, place.geometry.location.lng) < 0.05 // 50m threshold
              );

              if (!existingSignal) {
                const distanceFromStart = calculateRouteDistanceToPoint(route, place.geometry.location);
                signals.push({
                  id: place.place_id || `signal_${signals.length}`,
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng,
                  status: 'red', // Start all signals as RED
                  lastUpdated: Date.now(),
                  distanceFromStart,
                  isControlled: false
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching signals for point:', error);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Add some mock signals if we don't find enough real ones
      if (signals.length < 3) {
        const mockSignals = generateMockSignalsAlongRoute(route);
        signals.push(...mockSignals);
      }

      // Sort by distance from start
      signals.sort((a, b) => a.distanceFromStart - b.distanceFromStart);

      setTrafficSignals(signals);
      console.log(`Found ${signals.length} traffic signals along route`);

    } catch (error) {
      console.error('Error finding traffic signals:', error);
      // Fallback to mock signals
      const mockSignals = generateMockSignalsAlongRoute(route);
      setTrafficSignals(mockSignals);
    }
  };

  const sampleRoutePoints = (route: { latitude: number, longitude: number }[], intervalMeters: number) => {
    const points: { latitude: number, longitude: number }[] = [];
    let accumulatedDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const currentPoint = route[i];
      const nextPoint = route[i + 1];
      const segmentDistance = calculateDistance(
        currentPoint.latitude, currentPoint.longitude,
        nextPoint.latitude, nextPoint.longitude
      ) * 1000; // Convert to meters

      if (accumulatedDistance + segmentDistance >= intervalMeters) {
        points.push(currentPoint);
        accumulatedDistance = 0;
      } else {
        accumulatedDistance += segmentDistance;
      }
    }

    return points;
  };

  const calculateRouteDistanceToPoint = (route: { latitude: number, longitude: number }[], targetPoint: { lat: number, lng: number }) => {
    let minDistance = Infinity;
    let routeDistance = 0;
    let bestRouteDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const currentPoint = route[i];
      const distanceToTarget = calculateDistance(
        currentPoint.latitude, currentPoint.longitude,
        targetPoint.lat, targetPoint.lng
      );

      if (distanceToTarget < minDistance) {
        minDistance = distanceToTarget;
        bestRouteDistance = routeDistance;
      }

      if (i < route.length - 1) {
        const nextPoint = route[i + 1];
        routeDistance += calculateDistance(
          currentPoint.latitude, currentPoint.longitude,
          nextPoint.latitude, nextPoint.longitude
        );
      }
    }

    return bestRouteDistance;
  };

  const generateMockSignalsAlongRoute = (route: { latitude: number, longitude: number }[]): TrafficSignal[] => {
    const signals: TrafficSignal[] = [];
    const routeLength = route.length;

    // Place signals at strategic points along the route
    const signalPositions = [0.25, 0.5, 0.75]; // 25%, 50%, 75% along route

    signalPositions.forEach((position, index) => {
      const routeIndex = Math.floor(position * (routeLength - 1));
      const point = route[routeIndex];

      if (point) {
        signals.push({
          id: `mock_signal_${index}`,
          latitude: point.latitude + (Math.random() - 0.5) * 0.001, // Small offset
          longitude: point.longitude + (Math.random() - 0.5) * 0.001,
          status: 'red', // Start all signals as RED
          lastUpdated: Date.now(),
          distanceFromStart: position * calculateTotalRouteDistance(route),
          isControlled: false
        });
      }
    });

    return signals;
  };

  const calculateTotalRouteDistance = (route: { latitude: number, longitude: number }[]): number => {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(
        route[i].latitude, route[i].longitude,
        route[i + 1].latitude, route[i + 1].longitude
      );
    }
    return totalDistance;
  };

  // Pi Signal Integration: Map simulation signals to real Pi signals
  const mapToPiSignal = (simulationSignalId: string): string | null => {
    // Map simulation mock signals to Pi signal IDs
    if (simulationSignalId.includes('mock_signal_0') || simulationSignalId.includes('NORTH')) {
      return 'NORTH';
    }
    if (simulationSignalId.includes('mock_signal_1') || simulationSignalId.includes('EAST')) {
      return 'EAST';
    }
    if (simulationSignalId.includes('mock_signal_2') || simulationSignalId.includes('SOUTH')) {
      return 'SOUTH';
    }
    // Direct mapping for Pi signals
    if (['NORTH', 'EAST', 'SOUTH'].includes(simulationSignalId)) {
      return simulationSignalId;
    }
    return null; // Unknown signal
  };

  // Send signal control command to Raspberry Pi
  const controlPiSignal = async (simulationSignalId: string, status: 'green' | 'red') => {
    const piSignalId = mapToPiSignal(simulationSignalId);
    if (!piSignalId) {
      console.log(`⚠️  No Pi mapping for signal: ${simulationSignalId}`);
      return false;
    }

    try {
      const success = await RaspberryPiService.updateSignal(piSignalId, status);
      if (success) {
        console.log(`🔗 Pi signal ${piSignalId} → ${status.toUpperCase()} (triggered by ${simulationSignalId})`);
      } else {
        console.log(`❌ Pi signal ${piSignalId} control failed`);
      }
      return success;
    } catch (error) {
      console.error(`❌ Pi signal ${piSignalId} error:`, error);
      return false;
    }
  };

  const getRandomSignalStatus = (): 'red' | 'green' | 'yellow' | 'unknown' => {
    const statuses: ('red' | 'green' | 'yellow' | 'unknown')[] = ['red', 'green', 'yellow', 'unknown'];
    const weights = [0.4, 0.3, 0.2, 0.1]; // 40% red, 30% green, 20% yellow, 10% unknown

    const random = Math.random();
    let accumulator = 0;

    for (let i = 0; i < weights.length; i++) {
      accumulator += weights[i];
      if (random < accumulator) {
        return statuses[i];
      }
    }

    return 'unknown';
  };

  // Ambulance simulation movement
  useEffect(() => {
    if (simulationState.isSimulating && routeCoordinates.length > 0) {
      const interval = setInterval(() => {
        setSimulationState(prevState => {
          const { currentRouteIndex, simulatedSpeed } = prevState;
          const totalDistance = calculateTotalRouteDistance(routeCoordinates);

          // Calculate distance increment based on speed (distance = speed * time)
          // Update every 1 second, so distance = speed(km/h) * (1/3600)h = speed/3600 km
          const distanceIncrement = simulatedSpeed / 3600; // km per second
          const newDistanceTraveled = prevState.distanceTraveled + distanceIncrement;

          // Calculate progress (0 to 1)
          const newProgress = Math.min(newDistanceTraveled / totalDistance, 1);

          // Find current position on route based on distance traveled
          let accumulatedDistance = 0;
          let newRouteIndex = currentRouteIndex;

          for (let i = 0; i < routeCoordinates.length - 1; i++) {
            const segmentDistance = calculateDistance(
              routeCoordinates[i].latitude, routeCoordinates[i].longitude,
              routeCoordinates[i + 1].latitude, routeCoordinates[i + 1].longitude
            );

            if (accumulatedDistance + segmentDistance >= newDistanceTraveled) {
              newRouteIndex = i;

              // Interpolate position between two points
              const segmentProgress = (newDistanceTraveled - accumulatedDistance) / segmentDistance;
              const lat1 = routeCoordinates[i].latitude;
              const lng1 = routeCoordinates[i].longitude;
              const lat2 = routeCoordinates[i + 1].latitude;
              const lng2 = routeCoordinates[i + 1].longitude;

              const newLat = lat1 + (lat2 - lat1) * segmentProgress;
              const newLng = lng1 + (lng2 - lng1) * segmentProgress;

              setSimulatedLocation({ latitude: newLat, longitude: newLng });
              break;
            }

            accumulatedDistance += segmentDistance;
          }

          // Calculate ETA
          const remainingDistance = totalDistance - newDistanceTraveled;
          const etaMinutes = (remainingDistance / simulatedSpeed) * 60;

          // Check if reached destination
          if (newProgress >= 1) {
            setSimulatedLocation(routeCoordinates[routeCoordinates.length - 1]);
            return {
              ...prevState,
              progress: 1,
              distanceTraveled: totalDistance,
              estimatedTimeArrival: 0,
              currentRouteIndex: routeCoordinates.length - 1,
              isSimulating: false,
            };
          }

          return {
            ...prevState,
            currentRouteIndex: newRouteIndex,
            progress: newProgress,
            distanceTraveled: newDistanceTraveled,
            estimatedTimeArrival: etaMinutes,
          };
        });
      }, 1000); // Update every second

      return () => clearInterval(interval);
    }
  }, [simulationState.isSimulating, routeCoordinates.length]);

  // Smart traffic signal control with Pi integration
  useEffect(() => {
    if (simulationState.isSimulating && simulatedLocation && trafficSignals.length > 0) {
      setTrafficSignals(prevSignals =>
        prevSignals.map(signal => {
          const distanceToSignal = calculateDistance(
            simulatedLocation.latitude,
            simulatedLocation.longitude,
            signal.latitude,
            signal.longitude
          ) * 1000; // Convert to meters

          // If ambulance is within 300m of signal, turn it green
          if (distanceToSignal <= 300 && !signal.isControlled) {
            console.log(`🚦 Signal ${signal.id} turned GREEN - Ambulance approaching (${distanceToSignal.toFixed(0)}m away)`);

            // 🔗 Send GREEN command to Raspberry Pi
            controlPiSignal(signal.id, 'green');

            return {
              ...signal,
              status: 'green' as const,
              isControlled: true,
              lastUpdated: Date.now()
            };
          }

          // If ambulance has passed the signal (more than 150m behind), release control and turn red
          if (signal.isControlled && distanceToSignal > 150) {
            console.log(`🚦 Signal ${signal.id} turned RED - Ambulance passed (${distanceToSignal.toFixed(0)}m away)`);

            // 🔗 Send RED command to Raspberry Pi
            controlPiSignal(signal.id, 'red');

            return {
              ...signal,
              status: 'red' as const, // Turn back to RED after ambulance passes
              isControlled: false,
              lastUpdated: Date.now()
            };
          }

          return signal;
        })
      );
    }
  }, [simulatedLocation, simulationState.isSimulating]);

  // Emergency completion - Reset Pi signals when simulation ends
  useEffect(() => {
    if (isEmergencyActive && !simulationState.isSimulating && simulationState.progress >= 1) {
      console.log('🎯 Emergency simulation completed - Resetting Pi signals to normal');

      // Reset all Pi signals to red (normal state)
      Promise.all([
        controlPiSignal('NORTH', 'red'),
        controlPiSignal('EAST', 'red'),
        controlPiSignal('SOUTH', 'red')
      ]).then(() => {
        console.log('✅ All Pi signals reset to normal state');

        // Show completion alert
        Alert.alert(
          'Emergency Complete',
          `🎯 Ambulance arrived at ${selectedHospital?.name}!\n🔗 Pi signals returned to normal operation`,
          [{ text: 'OK', style: 'default' }]
        );

        // Reset emergency state after delay
        setTimeout(() => {
          setIsEmergencyActive(false);
          setSelectedHospital(null);
        }, 3000);
      });
    }
  }, [isEmergencyActive, simulationState.isSimulating, simulationState.progress, selectedHospital?.name]);

  // Keep non-controlled signals mostly red (like real traffic lights during emergency)
  useEffect(() => {
    if (isEmergencyActive && trafficSignals.length > 0) {
      const interval = setInterval(() => {
        setTrafficSignals(prevSignals =>
          prevSignals.map(signal => {
            // Non-controlled signals stay red unless randomly changed (10% chance)
            if (!signal.isControlled && Math.random() > 0.9) {
              return {
                ...signal,
                status: Math.random() > 0.7 ? 'red' : getRandomSignalStatus(), // Prefer red
                lastUpdated: Date.now()
              };
            }
            return signal;
          })
        );
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isEmergencyActive, trafficSignals.length]);

  const openInMaps = (hospital: Hospital) => {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q=',
    });
    const latLng = `${hospital.latitude},${hospital.longitude}`;
    const label = hospital.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${hospital.id}`;
        Linking.openURL(googleMapsUrl);
      });
    }
  };

  const selectHospital = async (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setIsEmergencyActive(true);
    setShowHospitalModal(false);

    // Get route to hospital
    await getRoute(hospital);

    // 🔗 Initialize Pi signals to RED for emergency mode
    console.log('🚨 Emergency mode activated - Setting all Pi signals to RED');
    await Promise.all([
      controlPiSignal('NORTH', 'red'),
      controlPiSignal('EAST', 'red'),
      controlPiSignal('SOUTH', 'red')
    ]);

    // Start simulation
    const totalDistance = hospital.distance || 0;
    setSimulationState({
      isSimulating: true,
      currentRouteIndex: 0,
      progress: 0,
      distanceTraveled: 0,
      estimatedTimeArrival: (totalDistance / 80) * 60, // ETA based on 80 km/h
      simulatedSpeed: 80,
    });

    // Set initial simulated location to current location
    if (currentLocation) {
      setSimulatedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      });
    }

    Alert.alert(
      'Emergency Activated',
      `🚨 Emergency simulation started!\nDestination: ${hospital.name}\nDistance: ${hospital.distance?.toFixed(1)} km\n\n📍 Ambulance speed: 80 km/h\n🚦 Signals: RED → GREEN at 300m → RED after passing\n🔗 Pi signals synchronized`,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Open in Maps',
          style: 'default',
          onPress: () => openInMaps(hospital)
        }
      ]
    );
  };

  // Debounced search effect
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.trim()) {
        searchHospitals(searchQuery);
      } else {
        loadNearbyHospitals();
      }
    }, 500); // 500ms delay for search

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const filteredHospitals = nearbyHospitals;

  const initializeLocation = async () => {
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location on the map.');
        setIsLoading(false);
        return;
      }

      setHasPermission(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        accuracy: location.coords.accuracy || 0,
        timestamp: Date.now(),
      };

      setCurrentLocation(locationData);

      // Start watching location
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          const newLocationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: location.coords.speed || 0,
            heading: location.coords.heading || 0,
            accuracy: location.coords.accuracy || 0,
            timestamp: Date.now(),
          };
          setCurrentLocation(newLocationData);
        }
      );

      setIsLoading(false);
    } catch (error) {
      console.error('Location initialization error:', error);
      Alert.alert('Location Error', 'Unable to get your location. Please check your location settings.');
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>📍</Text>
        <Text style={styles.errorTitle}>Location Permission Required</Text>
        <Text style={styles.errorMessage}>
          Please enable location permissions to see your current location on the map.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
        region={currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        } : undefined}
      >
        {(simulatedLocation || currentLocation) && (
          <Marker
            coordinate={{
              latitude: simulatedLocation?.latitude || currentLocation!.latitude,
              longitude: simulatedLocation?.longitude || currentLocation!.longitude,
            }}
            title={simulationState.isSimulating ? "Ambulance (Simulated)" : "Ambulance Location"}
            description={simulationState.isSimulating
              ? `Speed: ${simulationState.simulatedSpeed} km/h (Simulated)`
              : `Speed: ${((currentLocation?.speed || 0) * 3.6).toFixed(0)} km/h`
            }
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={currentLocation?.heading || 0}
          >
            <View style={[
              styles.ambulanceMarker,
              isEmergencyActive && styles.emergencyActive,
              simulationState.isSimulating && styles.simulatingMarker
            ]}>
              <Text style={styles.ambulanceIcon}>🚑</Text>
              <View style={styles.directionArrow} />
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF4444"
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Traffic Signal Markers */}
        {trafficSignals.map((signal) => (
          <Marker
            key={signal.id}
            coordinate={{
              latitude: signal.latitude,
              longitude: signal.longitude,
            }}
            title={`Traffic Signal - ${signal.status.toUpperCase()}`}
            description={`Distance: ${signal.distanceFromStart.toFixed(1)} km from start`}
          >
            <View style={[
              styles.trafficSignalMarker,
              styles[`signal${signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}`]
            ]}>
              <Text style={styles.trafficSignalIcon}>🚦</Text>
            </View>
          </Marker>
        ))}

        {/* Hospital Markers */}
        {nearbyHospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            coordinate={{
              latitude: hospital.latitude,
              longitude: hospital.longitude,
            }}
            title={hospital.name}
            description={`${hospital.distance?.toFixed(1)} km away`}
          >
            <View style={[
              styles.hospitalMarker,
              selectedHospital?.id === hospital.id && styles.selectedHospital
            ]}>
              <Text style={styles.hospitalIcon}>🏥</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Location Info Overlay */}
      {currentLocation && (
        <View style={styles.infoPanel}>
          <Text style={styles.speedDisplay}>
            {simulationState.isSimulating
              ? `${simulationState.simulatedSpeed} km/h`
              : `${((currentLocation.speed || 0) * 3.6).toFixed(0)} km/h`
            }
          </Text>
          <Text style={styles.infoText}>
            📍 {simulationState.isSimulating ? 'Simulated' : 'Real'} Location
          </Text>
          <View style={styles.coordinates}>
            <Text style={styles.coordinateText}>
              Lat: {(simulatedLocation?.latitude || currentLocation.latitude).toFixed(6)}
            </Text>
            <Text style={styles.coordinateText}>
              Lng: {(simulatedLocation?.longitude || currentLocation.longitude).toFixed(6)}
            </Text>
          </View>
          <Text style={styles.infoText}>⏰ Just now</Text>
        </View>
      )}

      {/* Emergency Progress Panel */}
      {isEmergencyActive && simulationState.isSimulating && (
        <View style={styles.progressPanel}>
          <Text style={styles.progressTitle}>🚨 Emergency Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${simulationState.progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {(simulationState.progress * 100).toFixed(1)}% Complete
          </Text>
          <Text style={styles.progressStats}>
            📏 {simulationState.distanceTraveled.toFixed(2)} km traveled
          </Text>
          <Text style={styles.progressStats}>
            ⏱️ ETA: {simulationState.estimatedTimeArrival.toFixed(1)} min
          </Text>
          <Text style={styles.progressStats}>
            🏥 Destination: {selectedHospital?.name}
          </Text>
        </View>
      )}

      {/* Traffic Signals Info Panel */}
      {isEmergencyActive && trafficSignals.length > 0 && (
        <View style={styles.signalsPanel}>
          <Text style={styles.signalsPanelTitle}>🚦 Traffic Signals</Text>
          {trafficSignals.slice(0, 3).map((signal, index) => (
            <View key={signal.id} style={styles.signalItem}>
              <View style={[
                styles.signalStatusDot,
                styles[`signal${signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}`]
              ]} />
              <Text style={styles.signalText}>
                {signal.distanceFromStart.toFixed(1)}km - {signal.status.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Emergency Button */}
      <TouchableOpacity
        style={[
          styles.emergencyButton,
          isEmergencyActive && styles.emergencyButtonActive
        ]}
        onPress={handleEmergencyPress}
      >
        <Text style={styles.emergencyIcon}>🚨</Text>
        <Text style={styles.emergencyText}>
          {isEmergencyActive ? 'STOP EMERGENCY' : 'EMERGENCY'}
        </Text>
      </TouchableOpacity>

      {/* Hospital Selection Modal */}
      <Modal
        visible={showHospitalModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Hospital</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHospitalModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search hospitals..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.hospitalsList}>
            <Text style={styles.sectionTitle}>
              {searchQuery.trim()
                ? `Search Results for "${searchQuery}"`
                : 'Nearby Hospitals (sorted by distance)'
              }
            </Text>

            {filteredHospitals.map((hospital) => (
              <TouchableOpacity
                key={hospital.id}
                style={styles.hospitalItem}
                onPress={() => selectHospital(hospital)}
              >
                <View style={styles.hospitalInfo}>
                  <View style={styles.hospitalHeader}>
                    <Text style={styles.hospitalName}>{hospital.name}</Text>
                    <Text style={styles.hospitalDistance}>
                      {hospital.distance?.toFixed(1)} km
                    </Text>
                  </View>
                  <Text style={styles.hospitalSpecialties}>
                    Specialties: {hospital.specialties.join(', ')}
                  </Text>
                </View>
                <Text style={styles.hospitalIcon}>🏥</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 40,
  },
  errorText: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoPanel: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 12,
    maxWidth: 280,
  },
  speedDisplay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff00',
    textAlign: 'center',
    marginBottom: 10,
  },
  infoText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  coordinates: {
    marginVertical: 4,
  },
  coordinateText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
    opacity: 0.8,
  },
  ambulanceMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  ambulanceIcon: {
    fontSize: 28,
    textAlign: 'center',
  },
  directionArrow: {
    position: 'absolute',
    top: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF4444',
  },
  emergencyActive: {
    backgroundColor: '#FF4444',
    borderColor: 'white',
  },
  hospitalMarker: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedHospital: {
    backgroundColor: '#FF9800',
    transform: [{ scale: 1.2 }],
  },
  hospitalIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
  emergencyButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#FF4444',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  emergencyButtonActive: {
    backgroundColor: '#388E3C',
  },
  emergencyIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  emergencyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  searchContainer: {
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hospitalsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  hospitalItem: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  hospitalDistance: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  hospitalSpecialties: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  trafficSignalMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    padding: 4,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  trafficSignalIcon: {
    fontSize: 16,
    textAlign: 'center',
  },
  signalRed: {
    backgroundColor: '#FF4444',
  },
  signalGreen: {
    backgroundColor: '#4CAF50',
  },
  signalYellow: {
    backgroundColor: '#FFC107',
  },
  signalUnknown: {
    backgroundColor: '#9E9E9E',
  },
  signalsPanel: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 12,
    maxWidth: 200,
  },
  signalsPanelTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  signalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    color: 'white',
    fontSize: 12,
    flex: 1,
  },
  simulatingMarker: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  progressPanel: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  progressTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressStats: {
    color: 'white',
    fontSize: 12,
    marginBottom: 3,
  },
});

export default SimpleMapScreen;