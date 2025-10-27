import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkConnection } from '../services/RaspberryPiService';
import { getPiStatus } from '../config/piConfig';

interface Props {
  style?: any;
}

const PiConnectionIndicator: React.FC<Props> = ({ style }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkPiConnection();
    const interval = setInterval(checkPiConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkPiConnection = async () => {
    setIsChecking(true);
    const connected = await checkConnection();
    setIsConnected(connected);
    setIsChecking(false);
  };

  const piStatus = getPiStatus();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isConnected ? styles.connected : styles.disconnected,
        style,
      ]}
      onPress={checkPiConnection}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isConnected ? 'hardware-chip' : 'hardware-chip-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isChecking ? 'Checking...' : isConnected ? 'Pi Connected' : 'Pi Offline'}
      </Text>
      {!isConnected && (
        <Text style={styles.ipText}>{piStatus.ip}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#F44336',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ipText: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8,
  },
});

export default PiConnectionIndicator;
