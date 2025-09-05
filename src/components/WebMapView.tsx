import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

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
  hospitals?: Hospital[];
  selectedHospital?: Hospital | null;
  onHospitalPress?: (hospital: Hospital) => void;
}

const WebMapView: React.FC<Props> = ({ 
  style, 
  initialRegion, 
  hospitals = [],
  selectedHospital,
  onHospitalPress 
}) => {
  const webViewRef = useRef<WebView>(null);

  const generateMapHTML = () => {
    const lat = initialRegion?.latitude || 37.7749;
    const lng = initialRegion?.longitude || -122.4194;
    
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body, html { margin: 0; padding: 0; height: 100%; }
        #map { height: 100%; width: 100%; }
        .info-window { font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map;
        let userMarker;
        let hospitalMarkers = [];

        function initMap() {
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: { lat: ${lat}, lng: ${lng} },
            mapTypeId: 'roadmap',
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'on' }]
              }
            ]
          });

          // Add user location marker (ambulance)
          userMarker = new google.maps.Marker({
            position: { lat: ${lat}, lng: ${lng} },
            map: map,
            title: 'Ambulance Location',
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="#FF6B6B" stroke="white" stroke-width="3"/>
                  <text x="20" y="28" font-size="20" text-anchor="middle" fill="white">🚑</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 40)
            }
          });

          // Add hospital markers
          const hospitals = [${hospitalMarkers}];
          
          hospitals.forEach(hospital => {
            const marker = new google.maps.Marker({
              position: hospital.position,
              map: map,
              title: hospital.title,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 35 35">
                    <circle cx="17.5" cy="17.5" r="15" fill="#4CAF50" stroke="white" stroke-width="2"/>
                    <text x="17.5" y="25" font-size="16" text-anchor="middle" fill="white">🏥</text>
                  </svg>
                `),
                scaledSize: new google.maps.Size(35, 35)
              }
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="info-window">
                  <h3>${hospital.title}</h3>
                  <p>Emergency Services Available</p>
                  <button onclick="selectHospital('${hospital.id}')" 
                          style="background: #4CAF50; color: white; border: none; 
                                 padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Select Hospital
                  </button>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            hospitalMarkers.push(marker);
          });
        }

        function updateUserLocation(lat, lng) {
          if (userMarker) {
            userMarker.setPosition({ lat: lat, lng: lng });
            map.setCenter({ lat: lat, lng: lng });
          }
        }

        function selectHospital(hospitalId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'hospital_selected',
            hospitalId: hospitalId
          }));
        }

        // Initialize map when Google Maps API is loaded
        function loadGoogleMaps() {
          if (typeof google !== 'undefined') {
            initMap();
          } else {
            // Fallback - show simple map with markers
            document.getElementById('map').innerHTML = `
              <div style="display: flex; flex-direction: column; height: 100%; 
                          background: linear-gradient(45deg, #e3f2fd 0%, #bbdefb 100%); 
                          justify-content: center; align-items: center; font-family: Arial;">
                <h2 style="color: #1976d2; margin: 10px;">🗺️ Ambulance GPS Map</h2>
                <div style="background: white; padding: 20px; border-radius: 12px; 
                            box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin: 10px; text-align: center;">
                  <div style="font-size: 24px; margin-bottom: 10px;">📍</div>
                  <div><strong>Current Location:</strong></div>
                  <div>Lat: ${lat.toFixed(6)}</div>
                  <div>Lng: ${lng.toFixed(6)}</div>
                </div>
                ${hospitals.map(h => `
                  <div style="background: white; padding: 15px; border-radius: 8px; 
                              margin: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                              display: flex; align-items: center; cursor: pointer;"
                       onclick="selectHospital('${h.id}')">
                    <span style="font-size: 20px; margin-right: 10px;">🏥</span>
                    <div>
                      <strong>${h.name}</strong><br>
                      <small>Distance: ${((Math.random() * 5) + 1).toFixed(1)} km</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
          }
        }

        // Try to load Google Maps, fallback to simple view
        loadGoogleMaps();
      </script>
      <script async defer 
              src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"
              onerror="loadGoogleMaps()">
      </script>
    </body>
    </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'hospital_selected' && onHospitalPress) {
        const hospital = hospitals.find(h => h.id === data.hospitalId);
        if (hospital) {
          onHospitalPress(hospital);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
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
      />
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
});

export default WebMapView;