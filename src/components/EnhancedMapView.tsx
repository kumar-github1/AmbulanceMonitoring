import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationData, GPSStatus } from '../services/GPSService';
import CONFIG from '../config/apiConfig';

interface Hospital {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface MapControls {
  showZoomControls: boolean;
  showCompass: boolean;
  showSpeedometer: boolean;
  showCoordinates: boolean;
}

interface TrafficSignal {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  currentLight: 'red' | 'yellow' | 'green';
  emergencyOverride: boolean;
}

interface Props {
  style: any;
  currentLocation?: LocationData | null;
  hospitals?: Hospital[];
  selectedHospital?: Hospital | null;
  onHospitalPress?: (hospital: Hospital) => void;
  mapControls?: MapControls;
  gpsStatus?: GPSStatus;
  onLocationPress?: () => void;
  followMode?: boolean; // New prop to control auto-following
  trafficSignals?: TrafficSignal[]; // Add trafficSignals prop
}

const { width, height } = Dimensions.get('window');

const EnhancedMapView: React.FC<Props> = ({
  style,
  currentLocation,
  hospitals = [],
  selectedHospital,
  onHospitalPress,
  mapControls = {
    showZoomControls: true,
    showCompass: true,
    showSpeedometer: true,
    showCoordinates: true,
  },
  gpsStatus,
  onLocationPress,
  followMode = false, // Default to not following
  trafficSignals = [], // Add trafficSignals with default empty array
}) => {
  const webViewRef = useRef<WebView>(null);
  const [mapZoom, setMapZoom] = useState(15);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);

  // Use fallback coordinates for initial HTML generation to prevent reloads
  const initialLat = CONFIG.FALLBACK_LOCATION.latitude;
  const initialLng = CONFIG.FALLBACK_LOCATION.longitude;
  const initialHeading = 0;
  const initialSpeed = 0;
  const initialAccuracy = 10;

  // Current location values for JavaScript injection
  const lat = currentLocation?.latitude || initialLat;
  const lng = currentLocation?.longitude || initialLng;
  const heading = currentLocation?.heading || 0;
  const speed = currentLocation?.speed || 0;
  const accuracy = currentLocation?.accuracy || 10;

  // Define generateMapHTML function BEFORE using it
  const generateMapHTML = (htmlLat: number, htmlLng: number, htmlHeading: number, htmlSpeed: number, htmlAccuracy: number) => {
    const hospitalMarkers = (hospitals || []).map(hospital => `
      {
        position: { lat: ${hospital.location.latitude}, lng: ${hospital.location.longitude} },
        title: "${hospital.name}",
        id: "${hospital.id}",
        icon: '🏥'
      }
    `).join(',');

    const signalMarkers = (trafficSignals || []).map((signal: TrafficSignal) => `
      {
        position: { lat: ${signal.location.latitude}, lng: ${signal.location.longitude} },
        title: "Signal ${signal.id}",
        id: "${signal.id}",
        icon: '🚦',
        status: "${signal.currentLight}",
        emergency: ${signal.emergencyOverride}
      }
    `).join(',');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=geometry,places"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
          .custom-marker {
            background: white;
            border: 2px solid #333;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ambulance-marker {
            background: linear-gradient(45deg, #ff0000, #ffffff);
            border: 3px solid #000;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          }
          .hospital-marker {
            background: #0066cc;
            color: white;
            border: 2px solid #004499;
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 14px;
          }
          .signal-marker {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          }
          .signal-red { background: #ff4444; }
          .signal-yellow { background: #ffaa00; }
          .signal-green { background: #44ff44; }
          .signal-emergency { border-color: #ff0000; animation: pulse 1s infinite; }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map;
          let ambulanceMarker;
          let hospitalMarkers = [];
          let signalMarkers = [];
          
          function initMap() {
            map = new google.maps.Map(document.getElementById('map'), {
              zoom: 15,
              center: { lat: ${htmlLat}, lng: ${htmlLng} },
              disableDefaultUI: ${!mapControls},
              gestureHandling: 'greedy',
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            });

            // Add ambulance marker
            ambulanceMarker = new google.maps.Marker({
              position: { lat: ${htmlLat}, lng: ${htmlLng} },
              map: map,
              title: 'Ambulance (Speed: ${htmlSpeed} km/h, Accuracy: ±${htmlAccuracy}m)',
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                rotation: ${htmlHeading}
              }
            });

            // Add hospital markers
            const hospitals = [${hospitalMarkers}];
            hospitals.forEach((hospital, index) => {
              const marker = new google.maps.Marker({
                position: hospital.position,
                map: map,
                title: hospital.title,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: index === ${hospitals.findIndex(h => h.id === selectedHospital?.id) || -1} ? '#FF6B6B' : '#0066cc',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }
              });
              hospitalMarkers.push(marker);
            });

            // Add traffic signal markers
            const signals = [${signalMarkers}];
            signals.forEach(signal => {
              let fillColor = '#ff4444'; // red
              if (signal.status === 'green') fillColor = '#44ff44';
              if (signal.status === 'yellow') fillColor = '#ffaa00';
              
              const marker = new google.maps.Marker({
                position: signal.position,
                map: map,
                title: signal.title,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: signal.emergency ? 10 : 8,
                  fillColor: fillColor,
                  fillOpacity: 1,
                  strokeColor: signal.emergency ? '#ff0000' : '#333333',
                  strokeWeight: signal.emergency ? 3 : 2
                }
              });
              signalMarkers.push(marker);
            });

            // Map interaction handlers
            map.addListener('dragstart', () => {
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'mapInteractionStart'
              }));
            });

            map.addListener('dragend', () => {
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'mapInteractionEnd'
              }));
            });
          }

          function updateAmbulanceLocation(lat, lng, heading) {
            if (ambulanceMarker) {
              ambulanceMarker.setPosition({ lat: lat, lng: lng });
              ambulanceMarker.setIcon({
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                rotation: heading
              });
              
              // Center map on ambulance if following mode
              if (window.followMode && map) {
                map.setCenter({ lat: lat, lng: lng });
              }
            }
          }

          function updateSpeed(speed) {
            if (ambulanceMarker) {
              const speedKmh = Math.round(speed * 3.6);
              ambulanceMarker.setTitle('Ambulance (Speed: ' + speedKmh + ' km/h)');
            }
          }

          function updateTrafficSignals(signals) {
            // Clear existing signal markers
            signalMarkers.forEach(marker => marker.setMap(null));
            signalMarkers = [];

            // Add updated signal markers
            signals.forEach(signal => {
              let fillColor = '#ff4444'; // red
              if (signal.status === 'green') fillColor = '#44ff44';
              if (signal.status === 'yellow') fillColor = '#ffaa00';
              
              const marker = new google.maps.Marker({
                position: { lat: signal.lat, lng: signal.lng },
                map: map,
                title: 'Signal ' + signal.id,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: signal.emergency ? 10 : 8,
                  fillColor: fillColor,
                  fillOpacity: 1,
                  strokeColor: signal.emergency ? '#ff0000' : '#333333',
                  strokeWeight: signal.emergency ? 3 : 2
                }
              });
              signalMarkers.push(marker);
            });
          }

          function setFollowMode(enabled) {
            window.followMode = enabled;
          }

          // Initialize map when page loads
          google.maps.event.addDomListener(window, 'load', initMap);
          
          // Global variables for React Native communication
          window.followMode = ${followMode};
          
          // Notify React Native that map is loaded
          setTimeout(() => {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'mapLoaded'
            }));
          }, 1000);
        </script>
      </body>
      </html>
    `;
  };

  // Memoize the HTML with static initial coordinates to prevent unnecessary WebView reloads
  const mapHTML = useMemo(() => {
    return generateMapHTML(initialLat, initialLng, initialHeading, initialSpeed, initialAccuracy);
  }, [hospitals, selectedHospital, mapControls, trafficSignals, CONFIG.GOOGLE_MAPS_API_KEY]);

  // Update map location when currentLocation changes
  useEffect(() => {
    if (isMapLoaded && currentLocation && webViewRef.current) {
      const updateScript = `
        if (typeof updateAmbulanceLocation !== 'undefined') {
          updateAmbulanceLocation(${currentLocation.latitude}, ${currentLocation.longitude}, ${currentLocation.heading || 0});
        }
        if (typeof updateSpeed !== 'undefined') {
          updateSpeed(${currentLocation.speed || 0});
        }
        if (typeof updateAccuracy !== 'undefined') {
          updateAccuracy(${currentLocation.accuracy || 0});
        }
        
        // NEVER auto-center the map - only update marker position
        // Let user control map position manually
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  }, [currentLocation, isMapLoaded]);

  // Initial location update when map first loads
  useEffect(() => {
    if (isMapLoaded && currentLocation && webViewRef.current) {
      // Inject initial location if it's different from fallback
      if (currentLocation.latitude !== initialLat || currentLocation.longitude !== initialLng) {
        const initialUpdateScript = `
          console.log('Setting initial ambulance location to current position');
          if (typeof updateAmbulanceLocation !== 'undefined') {
            updateAmbulanceLocation(${currentLocation.latitude}, ${currentLocation.longitude}, ${currentLocation.heading || 0});
          }
          if (typeof updateSpeed !== 'undefined') {
            updateSpeed(${currentLocation.speed || 0});
          }
          if (typeof updateAccuracy !== 'undefined') {
            updateAccuracy(${currentLocation.accuracy || 0});
          }
        `;
        webViewRef.current.injectJavaScript(initialUpdateScript);
      }
    }
  }, [isMapLoaded]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'map_loaded':
          setIsMapLoaded(true);
          break;

        case 'hospital_selected':
          if (onHospitalPress) {
            const hospital = hospitals.find(h => h.id === data.hospitalId);
            if (hospital) {
              onHospitalPress(hospital);
            }
          }
          break;

        case 'location_button_pressed':
          if (onLocationPress) {
            onLocationPress();
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const getGPSStatusColor = (): string => {
    if (!gpsStatus) return '#666';
    if (!gpsStatus.hasPermission) return '#F44336';
    if (!gpsStatus.locationServicesEnabled) return '#F44336';
    if (!gpsStatus.isTracking) return '#FF9800';
    if (gpsStatus.accuracy && gpsStatus.accuracy > 50) return '#FF9800';
    return '#4CAF50';
  };

  const formatLastUpdate = (): string => {
    if (!currentLocation?.timestamp) return 'No GPS';
    const diff = Date.now() - currentLocation.timestamp;
    if (diff < 5000) return 'Now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        overScrollMode="never"
      />

      {/* GPS Status Overlay */}
      {gpsStatus && (
        <View style={[styles.gpsStatusOverlay, { backgroundColor: getGPSStatusColor() }]}>
          <Text style={styles.gpsStatusText}>
            {!gpsStatus.hasPermission ? '🚫 No GPS Permission' :
              !gpsStatus.locationServicesEnabled ? '📵 GPS Disabled' :
                !gpsStatus.isTracking ? '⏸️ GPS Paused' :
                  '🛰️ GPS Active'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  gpsStatusOverlay: {
    position: 'absolute',
    top: 80,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  gpsStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default EnhancedMapView;