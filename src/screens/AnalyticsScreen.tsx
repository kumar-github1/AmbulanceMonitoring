import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import AnalyticsService, { 
  PerformanceReport, 
  AnalyticsPeriod, 
  TripRecord 
} from '../services/AnalyticsService';

type AnalyticsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Analytics'>;

interface Props {
  navigation: AnalyticsScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [recentTrips, setRecentTrips] = useState<TripRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;

  const analyticsService = AnalyticsService.getInstance();

  useEffect(() => {
    loadData();
    animateScreen();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      generateReport();
    }
  }, [selectedPeriod]);

  const animateScreen = () => {
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

  const loadData = async () => {
    try {
      await analyticsService.loadTripRecords();
      const trips = analyticsService.getTripHistory(10);
      setRecentTrips(trips);

      // Set default period to last 7 days
      const periods = analyticsService.getPredefinedPeriods();
      setSelectedPeriod(periods[1]); // Last 7 Days
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const generateReport = () => {
    if (!selectedPeriod) return;

    setIsLoading(true);
    try {
      const newReport = analyticsService.generatePerformanceReport(selectedPeriod);
      setReport(newReport);
    } catch (error) {
      console.error('Failed to generate report:', error);
      Alert.alert('Error', 'Failed to generate performance report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!report) return;

    try {
      await analyticsService.shareReport(report);
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export report. Please try again.');
    }
  };

  const handleTripReplay = (tripId: string) => {
    const replayData = analyticsService.getMapReplayData(tripId);
    if (replayData) {
      // Navigate to map replay screen (would need to implement this)
      Alert.alert(
        'Trip Replay',
        `Would show replay of trip ${tripId} with ${replayData.routePoints.length} route points`,
        [{ text: 'OK' }]
      );
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatDistance = (meters: number): string => {
    return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
  };

  const getOutcomeColor = (outcome: string): string => {
    switch (outcome) {
      case 'successful': return '#4CAF50';
      case 'cancelled': return '#F44336';
      case 'redirected': return '#FF9800';
      default: return '#666';
    }
  };

  const renderPeriodSelector = () => {
    const periods = analyticsService.getPredefinedPeriods();

    return (
      <View style={styles.periodSelector}>
        <Text style={styles.sectionTitle}>Report Period</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
          {periods.map((period, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.periodButton,
                selectedPeriod?.label === period.label && styles.selectedPeriodButton,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod?.label === period.label && styles.selectedPeriodText,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderOverviewCards = () => {
    if (!report) return null;

    return (
      <Animated.View
        style={[
          styles.overviewSection,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <Text style={styles.sectionTitle}>Performance Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="car" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{report.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{formatDistance(report.totalDistance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color="#FF9800" />
            <Text style={styles.statValue}>
              {(report.averageResponseTime / 60).toFixed(1)}min
            </Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={24} color="#F44336" />
            <Text style={styles.statValue}>{report.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderDetailedStats = () => {
    if (!report) return null;

    return (
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Detailed Statistics</Text>
        
        {/* Speed and Performance */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>Speed & Performance</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Average Speed:</Text>
            <Text style={styles.detailValue}>{report.averageSpeed.toFixed(1)} km/h</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Max Speed:</Text>
            <Text style={styles.detailValue}>{report.maxSpeed} km/h</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Signals Cleared:</Text>
            <Text style={styles.detailValue}>{report.signalsCleared}</Text>
          </View>
        </View>

        {/* Trip Outcomes */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>Trip Outcomes</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Successful:</Text>
            <Text style={[styles.detailValue, { color: '#4CAF50' }]}>
              {report.successfulTrips}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cancelled:</Text>
            <Text style={[styles.detailValue, { color: '#F44336' }]}>
              {report.cancelledTrips}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Success Rate:</Text>
            <Text style={styles.detailValue}>
              {report.totalTrips > 0 ? ((report.successfulTrips / report.totalTrips) * 100).toFixed(1) : 0}%
            </Text>
          </View>
        </View>

        {/* Time Distribution */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>Time Distribution</Text>
          <View style={styles.timeDistribution}>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>Morning</Text>
              <Text style={styles.timeSlotValue}>{report.timeDistribution.morning}</Text>
            </View>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>Afternoon</Text>
              <Text style={styles.timeSlotValue}>{report.timeDistribution.afternoon}</Text>
            </View>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>Evening</Text>
              <Text style={styles.timeSlotValue}>{report.timeDistribution.evening}</Text>
            </View>
            <View style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>Night</Text>
              <Text style={styles.timeSlotValue}>{report.timeDistribution.night}</Text>
            </View>
          </View>
        </View>

        {/* Hospital Visits */}
        {Object.keys(report.hospitalVisits).length > 0 && (
          <View style={styles.detailCard}>
            <Text style={styles.detailCardTitle}>Hospital Visits</Text>
            {Object.entries(report.hospitalVisits)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([hospital, visits]) => (
                <View key={hospital} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{hospital}:</Text>
                  <Text style={styles.detailValue}>{visits}</Text>
                </View>
              ))}
          </View>
        )}
      </View>
    );
  };

  const renderRecentTrips = () => (
    <View style={styles.tripsSection}>
      <View style={styles.tripsSectionHeader}>
        <Text style={styles.sectionTitle}>Recent Trips</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate('TripHistory')}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {recentTrips.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No trips recorded yet</Text>
        </View>
      ) : (
        recentTrips.slice(0, 5).map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={styles.tripCard}
            onPress={() => handleTripReplay(trip.id)}
          >
            <View style={styles.tripCardHeader}>
              <View style={styles.tripInfo}>
                <Text style={styles.tripDate}>
                  {new Date(trip.startTime).toLocaleDateString()}
                </Text>
                <Text style={styles.tripTime}>
                  {new Date(trip.startTime).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
              <View style={[styles.outcomeIndicator, { backgroundColor: getOutcomeColor(trip.outcome) }]}>
                <Text style={styles.outcomeText}>{trip.outcome.toUpperCase()}</Text>
              </View>
            </View>
            
            <View style={styles.tripStats}>
              <View style={styles.tripStat}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={styles.tripStatText}>
                  {formatDuration(trip.duration)}
                </Text>
              </View>
              <View style={styles.tripStat}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.tripStatText}>
                  {formatDistance(trip.distance)}
                </Text>
              </View>
              <View style={styles.tripStat}>
                <Ionicons name="speedometer" size={16} color="#666" />
                <Text style={styles.tripStatText}>
                  {trip.averageSpeed.toFixed(0)} km/h
                </Text>
              </View>
            </View>

            {trip.hospitalName && (
              <Text style={styles.hospitalName}>
                <Ionicons name="medical" size={14} color="#4CAF50" />
                {' '}{trip.hospitalName}
              </Text>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderExportButton = () => (
    <TouchableOpacity
      style={styles.exportButton}
      onPress={handleExportReport}
      disabled={!report || isLoading}
    >
      <Ionicons name="download" size={20} color="#fff" />
      <Text style={styles.exportButtonText}>Export Report</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {renderPeriodSelector()}
      {renderOverviewCards()}
      {renderDetailedStats()}
      {renderRecentTrips()}
      {renderExportButton()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  periodSelector: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  periodScroll: {
    marginTop: 12,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  selectedPeriodButton: {
    backgroundColor: '#2196F3',
  },
  periodButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedPeriodText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  overviewSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: (width - 72) / 2,
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
  detailsSection: {
    paddingHorizontal: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timeDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeSlot: {
    alignItems: 'center',
  },
  timeSlotLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeSlotValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  tripsSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tripsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 4,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripInfo: {
    flex: 1,
  },
  tripDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  outcomeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outcomeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  tripStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripStatText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  hospitalName: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  exportButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    gap: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AnalyticsScreen;