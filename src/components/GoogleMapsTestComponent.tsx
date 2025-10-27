import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import CONFIG from '../config/apiConfig';

const GoogleMapsTestComponent: React.FC = () => {
    const [showTest, setShowTest] = useState(false);
    const [testResult, setTestResult] = useState<string>('');

    const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: Arial, sans-serif; 
          background: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        .test-card {
          background: white;
          padding: 20px;
          margin: 10px 0;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
        }
        .button:hover {
          background: #45a049;
        }
        #map {
          height: 300px;
          width: 100%;
          background: #f0f0f0;
          border: 1px solid #ddd;
          margin: 10px 0;
        }
        .success { color: #4CAF50; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .warning { color: #ff9800; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="test-card">
          <h2>🗺️ Google Maps API Test in WebView</h2>
          <p><strong>API Key:</strong> ${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 20)}...</p>
          <p id="status">Ready to test</p>
          
          <button class="button" onclick="testGoogleMapsAPI()">Test Google Maps API</button>
          <button class="button" onclick="loadMap()">Load Map</button>
          <button class="button" onclick="testDirectAPI()">Test Direct API Call</button>
          
          <div id="map"></div>
          <div id="results"></div>
        </div>
      </div>

      <script>
        function log(message, type = 'info') {
          const results = document.getElementById('results');
          const className = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : '';
          results.innerHTML += '<div class="' + className + '">' + new Date().toLocaleTimeString() + ': ' + message + '</div>';
          
          // Send back to React Native
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'test_log',
            message: message,
            level: type
          }));
        }

        function testGoogleMapsAPI() {
          log('Testing Google Maps API availability...', 'info');
          document.getElementById('status').textContent = 'Testing API...';
          
          if (typeof google !== 'undefined' && google.maps) {
            log('✅ Google Maps API is already loaded!', 'success');
            document.getElementById('status').textContent = 'API Available';
            return;
          }
          
          log('Loading Google Maps JavaScript API...', 'info');
          
          const script = document.createElement('script');
          script.async = true;
          script.defer = true;
          script.src = 'https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&callback=onGoogleMapsLoaded';
          
          script.onerror = function() {
            log('❌ Failed to load Google Maps API script', 'error');
            document.getElementById('status').textContent = 'API Load Failed';
          };
          
          window.onGoogleMapsLoaded = function() {
            log('✅ Google Maps API loaded successfully!', 'success');
            document.getElementById('status').textContent = 'API Loaded Successfully';
            
            if (typeof google !== 'undefined' && google.maps) {
              log('✅ google.maps object is available', 'success');
              log('Available services: ' + Object.keys(google.maps).slice(0, 5).join(', '), 'info');
            }
          };
          
          document.head.appendChild(script);
          
          // Timeout check
          setTimeout(() => {
            if (typeof google === 'undefined' || !google.maps) {
              log('❌ Google Maps API failed to load within 10 seconds', 'error');
              document.getElementById('status').textContent = 'API Load Timeout';
            }
          }, 10000);
        }

        function loadMap() {
          if (typeof google === 'undefined' || !google.maps) {
            log('❌ Google Maps API not loaded. Please test API first.', 'error');
            return;
          }

          log('Creating map instance...', 'info');
          
          try {
            const map = new google.maps.Map(document.getElementById('map'), {
              zoom: 10,
              center: { lat: 37.7749, lng: -122.4194 },
              mapTypeId: 'roadmap'
            });

            // Add a marker
            const marker = new google.maps.Marker({
              position: { lat: 37.7749, lng: -122.4194 },
              map: map,
              title: 'Test Location',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
                  '<circle cx="15" cy="15" r="12" fill="#FF6B6B" stroke="white" stroke-width="2"/>' +
                  '<text x="15" y="20" font-size="12" text-anchor="middle" fill="white">📍</text>' +
                  '</svg>'
                ),
                scaledSize: new google.maps.Size(30, 30)
              }
            });

            log('✅ Map created successfully with marker!', 'success');
            document.getElementById('status').textContent = 'Map Loaded Successfully';
            
          } catch (error) {
            log('❌ Map creation failed: ' + error.message, 'error');
            document.getElementById('status').textContent = 'Map Creation Failed';
          }
        }

        function testDirectAPI() {
          log('Testing direct API access...', 'info');
          
          // Test with a simple static map request
          const testUrl = 'https://maps.googleapis.com/maps/api/staticmap?center=37.7749,-122.4194&zoom=12&size=300x200&key=${CONFIG.GOOGLE_MAPS_API_KEY}';
          
          const img = new Image();
          img.onload = function() {
            log('✅ Static Maps API is working!', 'success');
            document.getElementById('map').innerHTML = '<img src="' + testUrl + '" alt="Static Map Test" style="width: 100%; height: 100%; object-fit: cover;">';
          };
          img.onerror = function() {
            log('❌ Static Maps API failed - check API key permissions', 'error');
          };
          img.src = testUrl;
        }

        // Initialize
        log('WebView test component initialized', 'info');
      </script>
    </body>
    </html>
  `;

    const handleWebViewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'test_log') {
                setTestResult(prev => prev + '\n' + `[${data.level.toUpperCase()}] ${data.message}`);
            }
        } catch (error) {
            console.error('Error parsing WebView message:', error);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.testButton}
                onPress={() => setShowTest(!showTest)}
            >
                <Text style={styles.testButtonText}>
                    {showTest ? '❌ Hide Google Maps Test' : '🔧 Show Google Maps Test'}
                </Text>
            </TouchableOpacity>

            {showTest && (
                <View style={styles.testContainer}>
                    <Text style={styles.testTitle}>Google Maps API Test</Text>
                    <Text style={styles.apiKeyInfo}>
                        API Key: {CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 20)}...
                    </Text>

                    <WebView
                        source={{ html: testHTML }}
                        style={styles.webView}
                        onMessage={handleWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />

                    {testResult ? (
                        <TouchableOpacity
                            style={styles.resultsButton}
                            onPress={() => {
                                Alert.alert('Test Results', testResult, [{ text: 'OK' }]);
                            }}
                        >
                            <Text style={styles.resultsButtonText}>📋 View Test Results</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 100,
        right: 20,
        zIndex: 1000,
    },
    testButton: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    testButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    testContainer: {
        position: 'absolute',
        top: 40,
        right: 0,
        width: 350,
        height: 400,
        backgroundColor: 'white',
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        padding: 10,
    },
    testTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
    },
    apiKeyInfo: {
        fontSize: 12,
        color: '#666',
        marginBottom: 10,
        textAlign: 'center',
    },
    webView: {
        flex: 1,
        borderRadius: 10,
    },
    resultsButton: {
        backgroundColor: '#4CAF50',
        padding: 8,
        borderRadius: 8,
        marginTop: 5,
    },
    resultsButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default GoogleMapsTestComponent;
