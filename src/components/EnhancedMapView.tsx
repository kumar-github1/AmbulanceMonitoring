import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationData, GPSStatus } from '../services/GPSService';

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

interface Props {
  style: any;
  currentLocation?: LocationData | null;
  hospitals?: Hospital[];
  selectedHospital?: Hospital | null;
  onHospitalPress?: (hospital: Hospital) => void;
  mapControls?: MapControls;
  gpsStatus?: GPSStatus;
  onLocationPress?: () => void;
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
  onLocationPress
}) => {
  const webViewRef = useRef<WebView>(null);
  const [mapZoom, setMapZoom] = useState(15);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const lat = currentLocation?.latitude || 37.7749;
  const lng = currentLocation?.longitude || -122.4194;
  const heading = currentLocation?.heading || 0;
  const speed = currentLocation?.speed || 0;
  const accuracy = currentLocation?.accuracy || 0;

  // Update map location when currentLocation changes
  useEffect(() => {
    if (isMapLoaded && currentLocation && webViewRef.current) {
      const updateScript = `
        if (typeof updateAmbulanceLocation !== 'undefined') {
          updateAmbulanceLocation(${currentLocation.latitude}, ${currentLocation.longitude}, ${currentLocation.heading || 0});
        }
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  }, [currentLocation, isMapLoaded]);

  const generateMapHTML = () => {
    const hospitalMarkers = hospitals.map(hospital => `
      {
        position: { lat: ${hospital.location.latitude}, lng: ${hospital.location.longitude} },
        title: "${hospital.name}",
        id: "${hospital.id}",
        icon: '🏥'
      }
    `).join(',');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <style>
        body, html { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        #map { height: 100%; width: 100%; }
        
        .map-controls {
          position: absolute;
          top: 20px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 1000;
        }
        
        .control-button {
          width: 50px;
          height: 50px;
          border-radius: 25px;
          background: rgba(255, 255, 255, 0.95);
          border: 2px solid #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        
        .control-button:hover {
          background: rgba(255, 255, 255, 1);
          transform: scale(1.05);
        }
        
        .info-panel {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 15px;
          border-radius: 12px;
          font-size: 14px;
          max-width: 280px;
          z-index: 1000;
          backdrop-filter: blur(10px);
        }
        
        .speed-display {
          font-size: 24px;
          font-weight: bold;
          color: #00ff00;
          text-align: center;
          margin-bottom: 10px;
        }
        
        .coordinates {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          opacity: 0.8;
        }
        
        .compass {
          position: absolute;
          bottom: 100px;
          right: 20px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.95);
          border: 3px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          z-index: 1000;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        
        .compass-needle {
          width: 4px;
          height: 30px;
          background: linear-gradient(to top, #ff0000 0%, #ff0000 50%, #ffffff 50%, #ffffff 100%);
          transform-origin: bottom center;
          border-radius: 2px;
        }
        
        .location-button {
          position: absolute;
          bottom: 30px;
          right: 20px;
          width: 60px;
          height: 60px;
          border-radius: 30px;
          background: #FF6B6B;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
          z-index: 1000;
          transition: all 0.2s ease;
        }
        
        .location-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
        }
        
        .ambulance-marker {
          width: 40px;
          height: 40px;
          position: relative;
          transform-origin: center;
        }
        
        .accuracy-circle {
          position: absolute;
          border: 2px solid rgba(0, 150, 255, 0.3);
          border-radius: 50%;
          background: rgba(0, 150, 255, 0.1);
          z-index: 1;
        }
        
        .status-indicator {
          position: absolute;
          top: 20px;
          right: 90px;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          z-index: 1000;
        }
        
        .status-good { background: #4CAF50; color: white; }
        .status-warning { background: #FF9800; color: white; }
        .status-error { background: #F44336; color: white; }
        
        .info-window {
          font-family: Arial, sans-serif;
          max-width: 250px;
        }
        
        .hospital-info {
          text-align: center;
        }
        
        .select-hospital-btn {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
          font-weight: bold;
        }
        
        .select-hospital-btn:hover {
          background: #45a049;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <div class="map-controls">
        <div class="control-button" onclick="zoomIn()" title="Zoom In">+</div>
        <div class="control-button" onclick="zoomOut()" title="Zoom Out">−</div>
      </div>
      
      <div class="info-panel">
        <div class="speed-display" id="speedDisplay">${speed.toFixed(0)} km/h</div>
        <div>📍 <strong>GPS Status:</strong> <span id="gpsStatus">Active</span></div>
        <div>🎯 <strong>Accuracy:</strong> <span id="accuracyDisplay">±${accuracy.toFixed(0)}m</span></div>
        <div class="coordinates">
          <div>Lat: <span id="latDisplay">${lat.toFixed(6)}</span></div>
          <div>Lng: <span id="lngDisplay">${lng.toFixed(6)}</span></div>
        </div>
        <div>⏰ <span id="lastUpdate">Now</span></div>
      </div>
      
      <div class="compass" title="Compass">
        <div class="compass-needle" id="compassNeedle" style="transform: rotate(${heading}deg)"></div>
      </div>
      
      <div class="status-indicator status-good" id="statusIndicator">
        🛰️ GPS
      </div>
      
      <button class="location-button" onclick="centerOnLocation()" title="Center on Location">
        📍
      </button>
      
      <script>
        let map;
        let ambulanceMarker;
        let accuracyCircle;
        let hospitalMarkers = [];
        let currentZoom = ${mapZoom};

        function initMap() {
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: currentZoom,
            center: { lat: ${lat}, lng: ${lng} },
            mapTypeId: 'roadmap',
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'simplified' }]
              },
              {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [{ color: '#ffffff' }]
              },
              {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#ffeb3b' }]
              }
            ]
          });

          // Create ambulance marker
          createAmbulanceMarker(${lat}, ${lng}, ${heading});

          // Add hospital markers
          const hospitals = [${hospitalMarkers}];
          hospitals.forEach(hospital => {
            createHospitalMarker(hospital);
          });
          
          // Map event listeners
          map.addListener('zoom_changed', () => {
            currentZoom = map.getZoom();
            updateAccuracyCircle();
          });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'map_loaded'
          }));
        }

        function createAmbulanceMarker(lat, lng, heading) {
          if (ambulanceMarker) {
            ambulanceMarker.setMap(null);
          }
          
          if (accuracyCircle) {
            accuracyCircle.setMap(null);
          }

          // Create accuracy circle
          accuracyCircle = new google.maps.Circle({
            center: { lat: lat, lng: lng },
            radius: ${accuracy} || 10,
            fillColor: '#0096FF',
            fillOpacity: 0.1,
            strokeColor: '#0096FF',
            strokeOpacity: 0.3,
            strokeWeight: 2,
            map: map
          });

          // Create ambulance marker with rotation
          ambulanceMarker = new google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: map,
            title: 'Ambulance Location',
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">' +
                  '<defs>' +
                    '<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">' +
                      '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.3"/>' +
                    '</filter>' +
                  '</defs>' +
                  '<g transform="rotate(' + heading + ' 25 25)">' +
                    '<circle cx="25" cy="25" r="22" fill="#FF6B6B" stroke="white" stroke-width="4" filter="url(#shadow)"/>' +
                    '<text x="25" y="32" font-size="24" text-anchor="middle" fill="white">🚑</text>' +
                    '<polygon points="25,8 30,18 20,18" fill="white" opacity="0.9"/>' +
                  '</g>' +
                '</svg>'
              ),
              scaledSize: new google.maps.Size(50, 50),
              anchor: new google.maps.Point(25, 25)
            },
            zIndex: 1000
          });
        }

        function createHospitalMarker(hospital) {
          const marker = new google.maps.Marker({
            position: hospital.position,
            map: map,
            title: hospital.title,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
                  '<circle cx="20" cy="20" r="18" fill="#4CAF50" stroke="white" stroke-width="3"/>' +
                  '<text x="20" y="27" font-size="18" text-anchor="middle" fill="white">🏥</text>' +
                '</svg>'
              ),
              scaledSize: new google.maps.Size(40, 40)
            }
          });

          const infoWindow = new google.maps.InfoWindow({
            content: 
              '<div class="info-window">' +
                '<div class="hospital-info">' +
                  '<h3>' + hospital.title + '</h3>' +
                  '<p><strong>Emergency Services:</strong> Available 24/7</p>' +
                  '<p><strong>Distance:</strong> ' + calculateDistance(' + lat + ', ' + lng + ', hospital.position.lat, hospital.position.lng).toFixed(1) + ' km</p>' +
                  '<button class="select-hospital-btn" onclick="selectHospital(\\'' + hospital.id + '\\\')">' +
                    'Set as Destination' +
                  '</button>' +
                '</div>' +
              '</div>'
          });

          marker.addListener('click', () => {
            // Close other info windows
            hospitalMarkers.forEach(m => {
              if (m.infoWindow) m.infoWindow.close();
            });
            infoWindow.open(map, marker);
          });

          hospitalMarkers.push({ marker, infoWindow });
        }

        function updateAmbulanceLocation(lat, lng, heading) {
          if (ambulanceMarker) {
            ambulanceMarker.setPosition({ lat: lat, lng: lng });
          }
          
          if (accuracyCircle) {
            accuracyCircle.setCenter({ lat: lat, lng: lng });
          }
          
          // Update displays
          document.getElementById('latDisplay').textContent = lat.toFixed(6);
          document.getElementById('lngDisplay').textContent = lng.toFixed(6);
          document.getElementById('compassNeedle').style.transform = 'rotate(' + heading + 'deg)';
          document.getElementById('lastUpdate').textContent = 'Just now';
        }
        
        function updateSpeed(speed) {
          document.getElementById('speedDisplay').textContent = speed.toFixed(0) + ' km/h';
        }
        
        function updateAccuracy(accuracy) {
          document.getElementById('accuracyDisplay').textContent = '±' + accuracy.toFixed(0) + 'm';
          if (accuracyCircle) {
            accuracyCircle.setRadius(accuracy);
          }
        }
        
        function updateAccuracyCircle() {
          if (accuracyCircle) {
            // Adjust circle size based on zoom level
            const baseRadius = ${accuracy} || 10;
            const zoomFactor = Math.pow(2, (15 - currentZoom));
            accuracyCircle.setRadius(baseRadius * Math.max(0.5, zoomFactor));
          }
        }

        function zoomIn() {
          const zoom = map.getZoom();
          map.setZoom(zoom + 1);
        }

        function zoomOut() {
          const zoom = map.getZoom();
          map.setZoom(zoom - 1);
        }

        function centerOnLocation() {
          if (ambulanceMarker) {
            map.setCenter(ambulanceMarker.getPosition());
            map.setZoom(16);
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'location_button_pressed'
          }));
        }

        function selectHospital(hospitalId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'hospital_selected',
            hospitalId: hospitalId
          }));
        }
        
        function calculateDistance(lat1, lon1, lat2, lon2) {
          const R = 6371; // Earth's radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        }

        // Initialize map when Google Maps API is loaded
        function loadMap() {
          if (typeof google !== 'undefined' && google.maps) {
            initMap();
          } else {
            // Fallback to enhanced static view
            initStaticMap();
          }
        }
        
        function initStaticMap() {
          let mapHTML = \`
            <div style="display: flex; flex-direction: column; height: 100%; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        justify-content: center; align-items: center; color: white; text-align: center;">
              <div style="background: rgba(0,0,0,0.8); padding: 30px; border-radius: 20px; 
                          backdrop-filter: blur(10px); max-width: 90%; margin: 20px;">
                <h1 style="margin: 0 0 20px 0; font-size: 28px;">🚑 Emergency GPS</h1>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                  <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 12px;">
                    <div style="font-size: 32px; font-weight: bold; color: #00ff00;">\${speed.toFixed(0)} km/h</div>
                    <div style="font-size: 14px; opacity: 0.8;">Current Speed</div>
                  </div>
                  
                  <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 12px;">
                    <div style="font-size: 32px; font-weight: bold; color: #00d4ff;">±\${accuracy.toFixed(0)}m</div>
                    <div style="font-size: 14px; opacity: 0.8;">GPS Accuracy</div>
                  </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">📍 Current Position</div>
                  <div style="font-family: 'Courier New', monospace; font-size: 16px;">
                    <div>Latitude: \${lat.toFixed(6)}</div>
                    <div>Longitude: \${lng.toFixed(6)}</div>
                  </div>
                  <div style="margin-top: 10px; font-size: 14px; opacity: 0.8;">
                    Heading: \${heading.toFixed(0)}° | Last Update: Just now
                  </div>
                </div>
          \`;
          
          if (hospitals.length > 0) {
            mapHTML += \`
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px;">
                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">🏥 Nearby Hospitals</div>
            \`;
            
            hospitals.forEach(h => {
              mapHTML += \`
                    <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; 
                                margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease;"
                         onclick="selectHospital('\${h.id}')"
                         onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                         onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                      <div style="font-weight: bold;">\${h.name}</div>
                      <div style="font-size: 14px; opacity: 0.8;">
                        Distance: \${calculateDistance(\` + lat + \`, \` + lng + \`, \${h.location.latitude}, \${h.location.longitude}).toFixed(1)} km
                      </div>
                    </div>
              \`;
            });
            
            mapHTML += \`
                </div>
            \`;
          }
          
          mapHTML += \`
              </div>
            </div>
          \`;
          
          document.getElementById('map').innerHTML = mapHTML;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'map_loaded'
          }));
        }

        // Load map
        loadMap();
      </script>
      
      <script async defer 
              src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=loadMap"
              onerror="initStaticMap()">
      </script>
    </body>
    </html>
    `;
  };

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
        source={{ html: generateMapHTML() }}
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