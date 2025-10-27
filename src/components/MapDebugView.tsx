import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationData, GPSStatus } from '../services/GPSService';
import CONFIG from '../config/apiConfig';

interface Props {
    style: any;
    currentLocation?: LocationData | null;
    gpsStatus?: GPSStatus;
}

const MapDebugView: React.FC<Props> = ({
    style,
    currentLocation,
    gpsStatus
}) => {
    const webViewRef = useRef<WebView>(null);
    const [debugMessages, setDebugMessages] = useState<string[]>([]);
    const [apiKeyStatus, setApiKeyStatus] = useState<string>('checking...');

    const addDebugMessage = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const newMessage = `[${timestamp}] ${message}`;
        setDebugMessages(prev => [...prev.slice(-4), newMessage]); // Keep last 5 messages
        console.log(newMessage);
    };

    useEffect(() => {
        // Check API key format
        const apiKey = CONFIG.GOOGLE_MAPS_API_KEY;
        if (apiKey === 'YOUR_ACTUAL_API_KEY_HERE') {
            setApiKeyStatus('❌ Placeholder key (not set)');
            addDebugMessage('API Key is still placeholder - need to set actual key');
        } else if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
            setApiKeyStatus('⚠️ Invalid format');
            addDebugMessage(`API Key format seems invalid: ${apiKey.substring(0, 10)}...`);
        } else {
            setApiKeyStatus('✅ Format OK');
            addDebugMessage(`API Key format looks good: ${apiKey.substring(0, 10)}...`);
        }
    }, []);

    const lat = currentLocation?.latitude || 37.7749;
    const lng = currentLocation?.longitude || -122.4194;

    const generateDebugMapHTML = () => {
        return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: Arial, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
        }
        .debug-container {
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }
        .status-card {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border-radius: 15px;
          padding: 20px;
          margin: 20px 0;
        }
        .api-test-btn {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          margin: 10px;
          font-size: 16px;
        }
        .api-test-btn:hover {
          background: #45a049;
        }
        .location-info {
          background: rgba(0,0,0,0.3);
          padding: 15px;
          border-radius: 10px;
          margin: 15px 0;
          font-family: monospace;
        }
        .debug-log {
          background: rgba(0,0,0,0.5);
          padding: 15px;
          border-radius: 10px;
          text-align: left;
          font-family: monospace;
          font-size: 12px;
          max-height: 200px;
          overflow-y: auto;
        }
        #map {
          height: 300px;
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .error { color: #ff5722; }
        .success { color: #4caf50; }
        .warning { color: #ff9800; }
      </style>
    </head>
    <body>
      <div class="debug-container">
        <h1>🗺️ Map Debug Mode</h1>
        
        <div class="status-card">
          <h3>API Key Status</h3>
          <div id="apiKeyStatus">${CONFIG.GOOGLE_MAPS_API_KEY === 'YOUR_ACTUAL_API_KEY_HERE' ? '❌ Not Set' : '✅ Configured'}</div>
          <div style="font-size: 12px; margin-top: 10px;">
            Key: ${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 20)}...
          </div>
        </div>

        <div class="status-card">
          <h3>Location Data</h3>
          <div class="location-info">
            📍 Latitude: ${lat.toFixed(6)}<br>
            📍 Longitude: ${lng.toFixed(6)}<br>
            🎯 GPS Status: ${gpsStatus?.isTracking ? 'Active' : 'Inactive'}<br>
            ⏰ Last Update: ${currentLocation?.timestamp ? new Date(currentLocation.timestamp).toLocaleTimeString() : 'Never'}
          </div>
        </div>

        <div class="status-card">
          <h3>Google Maps Test</h3>
          <button class="api-test-btn" onclick="testGoogleMaps()">Test Google Maps API</button>
          <button class="api-test-btn" onclick="loadBasicMap()">Load Basic Map</button>
          <div id="map">
            <div>📍 Map will load here</div>
          </div>
          <div id="testResult"></div>
        </div>

        <div class="status-card">
          <h3>Debug Log</h3>
          <div class="debug-log" id="debugLog">
            Initializing debug mode...<br>
          </div>
        </div>
      </div>

      <script>
        let debugLog = '';
        
        function log(message, level = 'info') {
          const timestamp = new Date().toLocaleTimeString();
          const className = level === 'error' ? 'error' : level === 'success' ? 'success' : level === 'warning' ? 'warning' : '';
          debugLog += '<div class="' + className + '">[' + timestamp + '] ' + message + '</div>';
          document.getElementById('debugLog').innerHTML = debugLog;
          
          // Send back to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'debug_log',
            message: message,
            level: level
          }));
        }

        function testGoogleMaps() {
          log('Testing Google Maps API...', 'info');
          
          if (typeof google !== 'undefined' && google.maps) {
            log('✅ Google Maps API is already loaded!', 'success');
            document.getElementById('testResult').innerHTML = '<div class="success">✅ Google Maps API Available</div>';
          } else {
            log('Loading Google Maps API with key...', 'info');
            
            const script = document.createElement('script');
            script.async = true;
            script.defer = true;
            script.src = 'https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&callback=onMapsLoaded';
            
            script.onerror = function() {
              log('❌ Failed to load Google Maps API - check your API key and internet connection', 'error');
              document.getElementById('testResult').innerHTML = '<div class="error">❌ Failed to load Google Maps API</div>';
            };
            
            window.onMapsLoaded = function() {
              log('✅ Google Maps API loaded successfully!', 'success');
              document.getElementById('testResult').innerHTML = '<div class="success">✅ Google Maps API Loaded!</div>';
              loadBasicMap();
            };
            
            document.head.appendChild(script);
          }
        }

        function loadBasicMap() {
          if (typeof google === 'undefined' || !google.maps) {
            log('❌ Google Maps API not available for map creation', 'error');
            return;
          }

          log('Creating basic map...', 'info');
          
          try {
            const map = new google.maps.Map(document.getElementById('map'), {
              zoom: 12,
              center: { lat: ${lat}, lng: ${lng} },
              mapTypeId: 'roadmap'
            });

            // Add ambulance marker
            new google.maps.Marker({
              position: { lat: ${lat}, lng: ${lng} },
              map: map,
              title: 'Ambulance Location',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
                  '<circle cx="20" cy="20" r="18" fill="#FF6B6B" stroke="white" stroke-width="3"/>' +
                  '<text x="20" y="27" font-size="16" text-anchor="middle" fill="white">🚑</text>' +
                  '</svg>'
                ),
                scaledSize: new google.maps.Size(40, 40)
              }
            });

            log('✅ Basic map created successfully with ambulance marker!', 'success');
            
          } catch (error) {
            log('❌ Map creation failed: ' + error.message, 'error');
          }
        }

        // Initialize
        log('Debug mode initialized', 'info');
        log('API Key: ${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 20)}...', 'info');
        log('Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}', 'info');
      </script>
    </body>
    </html>
    `;
    };

    const handleWebViewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === 'debug_log') {
                addDebugMessage(data.message);
            }
        } catch (error) {
            console.error('Error parsing WebView message:', error);
        }
    };

    return (
        <View style={[styles.container, style]}>
            {/* Debug Header */}
            <View style={styles.debugHeader}>
                <Text style={styles.debugTitle}>🔧 Map Debug Mode</Text>
                <Text style={styles.apiKeyStatus}>{apiKeyStatus}</Text>
                <TouchableOpacity
                    style={styles.alertButton}
                    onPress={() => {
                        Alert.alert(
                            'Debug Info',
                            `API Key: ${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 20)}...\n` +
                            `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
                            `GPS: ${gpsStatus?.isTracking ? 'Active' : 'Inactive'}`,
                            [{ text: 'OK' }]
                        );
                    }}
                >
                    <Text style={styles.alertButtonText}>Show Debug Info</Text>
                </TouchableOpacity>
            </View>

            <WebView
                ref={webViewRef}
                source={{ html: generateDebugMapHTML() }}
                style={styles.webView}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
            />

            {/* Debug Messages Overlay */}
            <View style={styles.debugMessages}>
                {debugMessages.slice(-3).map((message, index) => (
                    <Text key={index} style={styles.debugMessageText}>
                        {message}
                    </Text>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    debugHeader: {
        backgroundColor: '#2196F3',
        padding: 15,
        alignItems: 'center',
    },
    debugTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    apiKeyStatus: {
        color: 'white',
        fontSize: 14,
        marginBottom: 10,
    },
    alertButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 15,
    },
    alertButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    webView: {
        flex: 1,
    },
    debugMessages: {
        position: 'absolute',
        bottom: 20,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 10,
        padding: 10,
        maxHeight: 100,
    },
    debugMessageText: {
        color: 'white',
        fontSize: 11,
        fontFamily: 'monospace',
        marginBottom: 2,
    },
});

export default MapDebugView;
