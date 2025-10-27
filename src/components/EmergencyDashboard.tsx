import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmergencyStats } from '../services/EmergencyService';
import { TrafficSignal } from '../services/TrafficSignalService';
import { Hospital } from '../services/HospitalService';

interface Props {
  visible: boolean;
  stats: EmergencyStats;
  signals: TrafficSignal[];
  destination?: Hospital;
  onManualOverride: () => void;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const EmergencyDashboard: React.FC<Props> = ({
  visible,
  stats,
  signals,
  destination,
  onManualOverride,
  onClose,
}) => {
  const slideAnimation = useRef(new Animated.Value(height)).current;
  const speedPulse = useRef(new Animated.Value(1)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnimation, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnimation, {
      toValue: stats.routeProgress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [stats.routeProgress]);

  useEffect(() => {
    // Pulse animation for high speeds
    if (stats.currentSpeed > 80) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(speedPulse, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(speedPulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (stats.currentSpeed > 80) pulse();
        });
      };
      pulse();
    } else {
      speedPulse.stopAnimation();
      speedPulse.setValue(1);
    }
  }, [stats.currentSpeed]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatETA = (timestamp: number): string => {
    if (!timestamp) return '--:--';

    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSpeedColor = (speed: number): string => {
    if (speed < 20) return '#F44336'; // Red - too slow
    if (speed < 40) return '#FF9800'; // Orange - slow
    if (speed < 80) return '#4CAF50'; // Green - good
    return '#FF5722'; // Red-orange - too fast
  };

  const getSignalStatusColor = (status: string): string => {
    switch (status) {
      case 'cleared_for_ambulance': return '#4CAF50'; // Green - cleared
      case 'emergency_mode': return '#FF9800'; // Orange - in progress
      case 'normal': return '#F44336'; // Red - not cleared
      default: return '#666';
    }
  };

  const renderSpeedometer = () => (
    <Animated.View style={[styles.speedometerContainer, { transform: [{ scale: speedPulse }] }]}>
      <View style={styles.speedometer}>
        <Text style={styles.speedUnit}>km/h</Text>
        <Text style={[styles.speedValue, { color: getSpeedColor(stats.currentSpeed) }]}>
          {Math.round(stats.currentSpeed)}
        </Text>
        <Text style={styles.speedLabel}>SPEED</Text>
      </View>
    </Animated.View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Route Progress</Text>
        <Text style={styles.progressPercentage}>{Math.round(stats.routeProgress * 100)}%</Text>
      </View>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );

  const renderTrafficSignals = () => {
    // Filter upcoming signals by proximity
    const upcomingSignals = signals
      .filter(s => s.ambulanceProximity && s.ambulanceProximity > 0)
      .sort((a, b) => (a.ambulanceProximity || 0) - (b.ambulanceProximity || 0))
      .slice(0, 3);

    if (upcomingSignals.length === 0) {
      return (
        <View style={styles.signalsContainer}>
          <Text style={styles.signalsTitle}>Traffic Signals</Text>
          <Text style={styles.noSignalsText}>No upcoming signals</Text>
        </View>
      );
    }

    return (
      <View style={styles.signalsContainer}>
        <Text style={styles.signalsTitle}>Upcoming Signals ({upcomingSignals.length})</Text>
        {upcomingSignals.map((signal, index) => (
          <View key={signal.id} style={styles.signalItem}>
            <View style={[styles.signalIndicator, { backgroundColor: getSignalStatusColor(signal.status) }]}>
              <Ionicons
                name={signal.status === 'cleared_for_ambulance' ? 'checkmark' : signal.status === 'emergency_mode' ? 'time' : 'close'}
                size={16}
                color="#fff"
              />
            </View>
            <View style={styles.signalInfo}>
              <Text style={styles.signalDistance}>{formatDistance(signal.ambulanceProximity || 0)}</Text>
              <Text style={styles.signalStatus}>
                {signal.status.replace('_', ' ').toUpperCase()}
                {signal.countdown && ` (${signal.countdown}s)`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="flash" size={24} color="#F44336" />
          <Text style={styles.headerTitle}>EMERGENCY ACTIVE</Text>
          <Text style={styles.headerDuration}>{formatDuration(stats.emergencyDuration)}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="chevron-down" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Stats Row */}
        <View style={styles.mainStatsContainer}>
          {renderSpeedometer()}

          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>{formatETA(stats.estimatedArrival)}</Text>
            <Text style={styles.etaDistance}>{formatDistance(stats.distanceToDestination)}</Text>
          </View>
        </View>

        {/* Destination Info */}
        {destination && (
          <View style={styles.destinationContainer}>
            <View style={styles.destinationHeader}>
              <Ionicons name="medical" size={20} color="#4CAF50" />
              <Text style={styles.destinationLabel}>Destination</Text>
            </View>
            <Text style={styles.destinationName}>{destination.name}</Text>
            <Text style={styles.destinationAddress}>{destination.address}</Text>
          </View>
        )}

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={20} color="#2196F3" />
            <Text style={styles.statValue}>{Math.round(stats.heading)}°</Text>
            <Text style={styles.statLabel}>Heading</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="radio" size={20} color="#4CAF50" />
            <Text style={styles.statValue}>{stats.signalsCleared}</Text>
            <Text style={styles.statLabel}>Signals Cleared</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trail-sign" size={20} color="#FF9800" />
            <Text style={styles.statValue}>
              {stats.nextSignalDistance ? formatDistance(stats.nextSignalDistance) : '--'}
            </Text>
            <Text style={styles.statLabel}>Next Signal</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={20} color="#9C27B0" />
            <Text style={styles.statValue}>{formatDuration(stats.emergencyDuration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        {/* Traffic Signals */}
        {renderTrafficSignals()}

        {/* Manual Override Button */}
        <TouchableOpacity
          style={styles.overrideButton}
          onPress={onManualOverride}
        >
          <Ionicons name="radio-outline" size={24} color="#fff" />
          <Text style={styles.overrideButtonText}>REQUEST SIGNAL CLEARANCE</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginLeft: 8,
    marginRight: 16,
  },
  headerDuration: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#333',
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  speedometerContainer: {
    alignItems: 'center',
  },
  speedometer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  speedUnit: {
    fontSize: 12,
    color: '#666',
    position: 'absolute',
    top: 20,
  },
  speedValue: {
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  speedLabel: {
    fontSize: 12,
    color: '#666',
    position: 'absolute',
    bottom: 20,
    fontWeight: '600',
  },
  etaContainer: {
    alignItems: 'center',
    flex: 1,
    marginLeft: 20,
  },
  etaLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  etaValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    fontFamily: 'monospace',
  },
  etaDistance: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  destinationContainer: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  destinationLabel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 6,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  statItem: {
    width: (width - 56) / 2, // Account for padding and gap
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  signalsContainer: {
    marginBottom: 24,
  },
  signalsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  signalIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signalInfo: {
    flex: 1,
  },
  signalDistance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  signalStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noSignalsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  overrideButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  overrideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EmergencyDashboard;