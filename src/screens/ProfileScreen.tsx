import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import DriverService, { Driver, Shift, PerformanceMetrics } from '../services/DriverService';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
  driver: Driver;
  onLogout?: () => void;
}

const ProfileScreen: React.FC<Props> = ({ navigation, driver, onLogout }) => {
  const [currentDriver, setCurrentDriver] = useState<Driver>(driver);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isOnDuty, setIsOnDuty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;

  const driverService = DriverService.getInstance();

  useEffect(() => {
    loadProfileData();
    animateProfile();
  }, []);

  useEffect(() => {
    setIsOnDuty(currentDriver.isActive);
  }, [currentDriver]);

  const animateProfile = () => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadProfileData = async () => {
    try {
      const performanceData = await driverService.getPerformanceMetrics();
      setMetrics(performanceData);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleShiftToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      if (isOnDuty) {
        // End shift
        const shift = await driverService.endShift();
        Alert.alert(
          'Shift Ended',
          `Shift duration: ${formatDuration(shift.duration)}\nEmergencies handled: ${shift.emergencies}`,
          [{ text: 'OK' }]
        );
      } else {
        // Start shift - need current location
        Alert.alert(
          'Start Shift',
          'This will mark you as available for emergency calls.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start Shift',
              onPress: async () => {
                try {
                  // Mock location for demo
                  const mockLocation = { latitude: 37.7749, longitude: -122.4194 };
                  await driverService.startShift(mockLocation);
                  Alert.alert('Success', 'Shift started successfully!');
                } catch (error) {
                  Alert.alert('Error', 'Failed to start shift. Please try again.');
                }
              },
            },
          ]
        );
      }

      const updatedDriver = driverService.getCurrentDriver();
      if (updatedDriver) {
        setCurrentDriver(updatedDriver);
        setIsOnDuty(updatedDriver.isActive);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update shift status. Please try again.');
      console.error('Shift toggle error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await driverService.logout();
              if (onLogout) {
                onLogout();
              } else {
                navigation.replace('Login');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to logout properly. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 4.5) return '#4CAF50';
    if (rating >= 4.0) return '#8BC34A';
    if (rating >= 3.5) return '#FFC107';
    if (rating >= 3.0) return '#FF9800';
    return '#F44336';
  };

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <View style={styles.profileInfo}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={40} color="#2196F3" />
        </View>
        <View style={styles.driverDetails}>
          <Text style={styles.driverName}>{currentDriver.name}</Text>
          <Text style={styles.driverId}>ID: {currentDriver.id}</Text>
          <Text style={styles.ambulanceId}>Ambulance: {currentDriver.ambulanceId}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: isOnDuty ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>{isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderShiftControls = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Shift Management</Text>
      <View style={styles.shiftContainer}>
        <View style={styles.shiftInfo}>
          <Ionicons name="time" size={24} color="#2196F3" />
          <View style={styles.shiftDetails}>
            <Text style={styles.shiftLabel}>Duty Status</Text>
            <Text style={styles.shiftValue}>{isOnDuty ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        <View style={styles.switchContainer}>
          <Switch
            value={isOnDuty}
            onValueChange={handleShiftToggle}
            disabled={isLoading}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={isOnDuty ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
      {currentDriver.currentShift && (
        <View style={styles.currentShiftInfo}>
          <Text style={styles.currentShiftText}>
            Current shift started: {new Date(currentDriver.currentShift.startTime).toLocaleTimeString()}
          </Text>
          <Text style={styles.currentShiftText}>
            Emergencies handled: {currentDriver.currentShift.emergencies}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPerformanceStats = () => {
    if (!metrics) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="flash" size={24} color="#F44336" />
            <Text style={styles.statValue}>{metrics.totalEmergencies}</Text>
            <Text style={styles.statLabel}>Total Emergencies</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{metrics.avgResponseTime.toFixed(1)}min</Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{(metrics.totalDistance / 1000).toFixed(1)}km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={24} color={getRatingColor(metrics.rating)} />
            <Text style={[styles.statValue, { color: getRatingColor(metrics.rating) }]}>
              {metrics.rating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
        <View style={styles.monthlyStats}>
          <Text style={styles.monthlyTitle}>This Month</Text>
          <View style={styles.monthlyRow}>
            <View style={styles.monthlyItem}>
              <Text style={styles.monthlyValue}>{metrics.emergenciesThisMonth}</Text>
              <Text style={styles.monthlyLabel}>Emergencies</Text>
            </View>
            <View style={styles.monthlyItem}>
              <Text style={styles.monthlyValue}>{metrics.hoursThisMonth.toFixed(1)}h</Text>
              <Text style={styles.monthlyLabel}>Hours</Text>
            </View>
            <View style={styles.monthlyItem}>
              <Text style={styles.monthlyValue}>{metrics.totalShifts}</Text>
              <Text style={styles.monthlyLabel}>Total Shifts</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCertifications = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Certifications</Text>
      <View style={styles.certificationsList}>
        {currentDriver.certifications.map((cert, index) => (
          <View key={index} style={styles.certificationItem}>
            <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={styles.certificationText}>{cert}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderActions = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ShiftHistory')}>
        <Ionicons name="calendar" size={20} color="#2196F3" />
        <Text style={styles.actionButtonText}>View Shift History</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Settings')}>
        <Ionicons name="settings" size={20} color="#2196F3" />
        <Text style={styles.actionButtonText}>Settings</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Analytics')}>
        <Ionicons name="analytics" size={20} color="#2196F3" />
        <Text style={styles.actionButtonText}>Analytics & Reports</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color="#F44336" />
        <Text style={[styles.actionButtonText, styles.logoutText]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {renderHeader()}
      {renderShiftControls()}
      {renderPerformanceStats()}
      {renderCertifications()}
      {renderActions()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  driverId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  ambulanceId: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  shiftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shiftDetails: {
    marginLeft: 12,
  },
  shiftLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  shiftValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  switchContainer: {
    marginLeft: 16,
  },
  currentShiftInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  currentShiftText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
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
  monthlyStats: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  monthlyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  monthlyItem: {
    alignItems: 'center',
  },
  monthlyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  monthlyLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  certificationsList: {
    gap: 8,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  certificationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#F44336',
  },
});

export default ProfileScreen;