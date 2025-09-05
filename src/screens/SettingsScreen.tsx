import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [originalServerUrl, setOriginalServerUrl] = useState('');
  const [locationUpdateInterval, setLocationUpdateInterval] = useState('5');
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [
        storedServerUrl,
        storedInterval,
        storedAccuracy,
        storedReconnect,
      ] = await Promise.all([
        AsyncStorage.getItem('serverUrl'),
        AsyncStorage.getItem('locationUpdateInterval'),
        AsyncStorage.getItem('highAccuracy'),
        AsyncStorage.getItem('autoReconnect'),
      ]);

      const defaultUrl = 'ws://10.144.117.52:3001';
      const url = storedServerUrl || defaultUrl;
      
      setServerUrl(url);
      setOriginalServerUrl(url);
      setLocationUpdateInterval(storedInterval || '5');
      setHighAccuracy(storedAccuracy !== 'false');
      setAutoReconnect(storedReconnect !== 'false');
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const validateServerUrl = (url: string): boolean => {
    const urlPattern = /^(ws|wss):\/\/.+/;
    return urlPattern.test(url);
  };

  const validateInterval = (interval: string): boolean => {
    const num = parseInt(interval);
    return !isNaN(num) && num >= 1 && num <= 60;
  };

  const saveSettings = async () => {
    if (!validateServerUrl(serverUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid WebSocket URL (ws:// or wss://)');
      return;
    }

    if (!validateInterval(locationUpdateInterval)) {
      Alert.alert('Invalid Interval', 'Location update interval must be between 1-60 seconds');
      return;
    }

    setIsSaving(true);

    try {
      await Promise.all([
        AsyncStorage.setItem('serverUrl', serverUrl),
        AsyncStorage.setItem('locationUpdateInterval', locationUpdateInterval),
        AsyncStorage.setItem('highAccuracy', highAccuracy.toString()),
        AsyncStorage.setItem('autoReconnect', autoReconnect.toString()),
      ]);

      const hasUrlChanged = serverUrl !== originalServerUrl;
      
      Alert.alert(
        'Settings Saved',
        hasUrlChanged 
          ? 'Settings saved successfully. Please restart the app for server changes to take effect.'
          : 'Settings saved successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setServerUrl('ws://10.144.117.52:3001');
            setLocationUpdateInterval('5');
            setHighAccuracy(true);
            setAutoReconnect(true);
          },
        },
      ]
    );
  };

  const testConnection = async () => {
    if (!validateServerUrl(serverUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid WebSocket URL first');
      return;
    }

    Alert.alert(
      'Test Connection',
      'Connection testing is not implemented yet. This would attempt to connect to the server and verify the connection.',
      [{ text: 'OK' }]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Server Configuration</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL *</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="ws://your-server.com:3001"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>WebSocket URL (ws:// or wss://)</Text>
          </View>

          <TouchableOpacity style={styles.testButton} onPress={testConnection}>
            <Text style={styles.testButtonText}>🔗 Test Connection</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Location Settings</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Update Interval (seconds) *</Text>
            <TextInput
              style={styles.input}
              value={locationUpdateInterval}
              onChangeText={setLocationUpdateInterval}
              placeholder="5"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <Text style={styles.hint}>How often to send location updates (1-60 seconds)</Text>
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchItem}>
              <Text style={styles.switchLabel}>High Accuracy GPS</Text>
              <Switch
                value={highAccuracy}
                onValueChange={setHighAccuracy}
                trackColor={{ false: '#ccc', true: '#FF6B6B' }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.switchHint}>
              Uses more battery but provides better accuracy
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Connection Settings</Text>
          
          <View style={styles.switchGroup}>
            <View style={styles.switchItem}>
              <Text style={styles.switchLabel}>Auto Reconnect</Text>
              <Switch
                value={autoReconnect}
                onValueChange={setAutoReconnect}
                trackColor={{ false: '#ccc', true: '#FF6B6B' }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.switchHint}>
              Automatically reconnect when connection is lost
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={saveSettings}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Save Settings</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
            <Text style={styles.resetButtonText}>🔄 Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Information</Text>
          <Text style={styles.infoText}>
            • Server URL: The WebSocket server that receives ambulance location data
          </Text>
          <Text style={styles.infoText}>
            • Update Interval: How frequently your location is sent to the server
          </Text>
          <Text style={styles.infoText}>
            • High Accuracy: Uses GPS instead of network location for better precision
          </Text>
          <Text style={styles.infoText}>
            • Auto Reconnect: Automatically tries to reconnect if connection is lost
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    height: 45,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchGroup: {
    marginBottom: 15,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  switchHint: {
    fontSize: 12,
    color: '#666',
  },
  buttonContainer: {
    margin: 10,
    marginTop: 0,
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#666',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default SettingsScreen;