import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NavigationService, { 
  NavigationRoute, 
  VoiceInstruction, 
  TrafficSignal,
  NavigationOptions 
} from '../services/NavigationService';
import { Location, Hospital } from '../services/HospitalService';

interface Props {
  visible: boolean;
  currentLocation: Location | null;
  destination: Hospital | Location | null;
  isEmergency?: boolean;
  onClose: () => void;
  onRouteUpdate: (route: NavigationRoute | null) => void;
  onNavigationStart: () => void;
}

const { width, height } = Dimensions.get('window');
const navigationService = NavigationService.getInstance();

const NavigationPanel: React.FC<Props> = ({
  visible,
  currentLocation,
  destination,
  isEmergency = false,
  onClose,
  onRouteUpdate,
  onNavigationStart,
}) => {
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<VoiceInstruction | null>(null);
  const [routeProgress, setRouteProgress] = useState({ progress: 0, remainingDistance: 0, remainingTime: 0 });
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [navigationOptions, setNavigationOptions] = useState<NavigationOptions>({
    isEmergency,
    optimizeFor: 'time',
    avoidTraffic: true,
  });
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    if (visible && currentLocation && destination) {
      calculateRoute();
    } else {
      setRoute(null);
      onRouteUpdate(null);
    }
  }, [visible, currentLocation, destination, navigationOptions]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (route && currentLocation) {
      interval = setInterval(() => {
        updateNavigationState();
      }, 2000); // Update every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [route, currentLocation]);

  useEffect(() => {
    navigationService.setVoiceEnabled(voiceEnabled);
  }, [voiceEnabled]);

  const getDestinationLocation = (): Location => {
    if (!destination) throw new Error('No destination');
    
    if ('location' in destination) {
      return destination.location;
    }
    return destination as Location;
  };

  const calculateRoute = async () => {
    if (!currentLocation || !destination) return;

    setLoading(true);
    try {
      const destinationLocation = getDestinationLocation();
      const calculatedRoute = await navigationService.calculateRoute(
        currentLocation,
        destinationLocation,
        {
          ...navigationOptions,
          isEmergency,
          vehicleType: 'ambulance',
        }
      );

      setRoute(calculatedRoute);
      onRouteUpdate(calculatedRoute);
      updateNavigationState();
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Navigation Error', 'Failed to calculate route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateNavigationState = useCallback(() => {
    if (!currentLocation || !route) return;

    // Update current instruction
    const instruction = navigationService.getNextInstruction(currentLocation);
    setCurrentInstruction(instruction);

    // Update route progress
    const progress = navigationService.getRouteProgress(currentLocation);
    setRouteProgress(progress);

    // Update traffic signals ahead
    const signalsAhead = navigationService.getTrafficSignalsAhead(currentLocation);
    setTrafficSignals(signalsAhead);

    // Check if we should announce instruction
    if (navigationService.shouldAnnounceInstruction(currentLocation)) {
      // In a real app, you would use Text-to-Speech here
      console.log('Voice instruction:', instruction?.text);
    }
  }, [currentLocation, route]);

  const handleStartNavigation = () => {
    onNavigationStart();
    setShowRouteDetails(false);
  };

  const getManeuverIcon = (maneuver: string): string => {
    switch (maneuver) {
      case 'left': return 'arrow-back-outline';
      case 'right': return 'arrow-forward-outline';
      case 'straight': return 'arrow-up-outline';
      case 'u-turn': return 'return-up-back-outline';
      case 'merge': return 'git-merge-outline';
      case 'exit': return 'exit-outline';
      default: return 'arrow-up-outline';
    }
  };

  const getSignalStatusColor = (status: string): string => {
    switch (status) {
      case 'cleared': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'normal': return '#F44336';
      default: return '#666';
    }
  };

  const formatETA = (): string => {
    if (!routeProgress.remainingTime) return 'Calculating...';
    
    const now = new Date();
    const eta = new Date(now.getTime() + routeProgress.remainingTime * 1000);
    
    return `ETA: ${eta.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  const renderRouteOptions = () => (
    <View style={styles.optionsContainer}>
      <Text style={styles.optionsTitle}>Route Options</Text>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Optimize for:</Text>
        <View style={styles.optionButtons}>
          {(['time', 'distance'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                navigationOptions.optimizeFor === option && styles.activeOption
              ]}
              onPress={() => setNavigationOptions(prev => ({ ...prev, optimizeFor: option }))}
            >
              <Text style={[
                styles.optionText,
                navigationOptions.optimizeFor === option && styles.activeOptionText
              ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.toggleOption}
        onPress={() => setNavigationOptions(prev => ({ ...prev, avoidTraffic: !prev.avoidTraffic }))}
      >
        <Ionicons
          name={navigationOptions.avoidTraffic ? 'checkbox' : 'square-outline'}
          size={24}
          color="#2196F3"
        />
        <Text style={styles.toggleText}>Avoid Heavy Traffic</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleOption}
        onPress={() => setVoiceEnabled(!voiceEnabled)}
      >
        <Ionicons
          name={voiceEnabled ? 'checkbox' : 'square-outline'}
          size={24}
          color="#2196F3"
        />
        <Text style={styles.toggleText}>Voice Instructions</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRouteDetails = () => (
    <Modal
      visible={showRouteDetails}
      animationType="slide"
      onRequestClose={() => setShowRouteDetails(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Route Details</Text>
          <TouchableOpacity onPress={() => setShowRouteDetails(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {route && (
            <>
              <View style={styles.routeSummary}>
                <View style={styles.summaryItem}>
                  <Ionicons name="location-outline" size={20} color="#666" />
                  <Text style={styles.summaryText}>
                    {navigationService.formatDistance(route.totalDistance)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.summaryText}>
                    {navigationService.formatDuration(route.totalDuration)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="stopwatch-outline" size={20} color="#666" />
                  <Text style={styles.summaryText}>{formatETA()}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Turn-by-Turn Directions</Text>
              {route.steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepIcon}>
                    <Ionicons
                      name={getManeuverIcon(step.maneuver) as any}
                      size={20}
                      color="#2196F3"
                    />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepDistance}>
                      {navigationService.formatDistance(step.distance)}
                    </Text>
                  </View>
                </View>
              ))}

              {route.trafficSignals.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Traffic Signals</Text>
                  {route.trafficSignals.map((signal, index) => (
                    <View key={signal.id} style={styles.signalItem}>
                      <View style={[
                        styles.signalStatus,
                        { backgroundColor: getSignalStatusColor(signal.status) }
                      ]}>
                        <Ionicons name="warning" size={16} color="#fff" />
                      </View>
                      <View style={styles.signalContent}>
                        <Text style={styles.signalText}>
                          Signal #{index + 1} - {signal.status.toUpperCase()}
                        </Text>
                        {signal.clearanceTime && (
                          <Text style={styles.signalDetail}>
                            Cleared for {signal.clearanceTime}s
                          </Text>
                        )}
                        {signal.estimatedWait && (
                          <Text style={styles.signalDetail}>
                            Est. wait: {signal.estimatedWait}s
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  if (!visible) return null;

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Navigation</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowRouteDetails(true)}
              disabled={!route}
            >
              <Ionicons name="list-outline" size={24} color={route ? "#2196F3" : "#ccc"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Calculating route...</Text>
          </View>
        ) : route ? (
          <View style={styles.routeContainer}>
            {/* Route Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Distance</Text>
                  <Text style={styles.summaryValue}>
                    {navigationService.formatDistance(route.totalDistance)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>
                    {navigationService.formatDuration(route.totalDuration)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>ETA</Text>
                  <Text style={styles.summaryValue}>{formatETA()}</Text>
                </View>
              </View>
              
              {routeProgress.progress > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[
                      styles.progressFill,
                      { width: `${routeProgress.progress * 100}%` }
                    ]} />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(routeProgress.progress * 100)}% complete
                  </Text>
                </View>
              )}
            </View>

            {/* Current Instruction */}
            {currentInstruction && (
              <View style={styles.instructionCard}>
                <View style={styles.instructionHeader}>
                  <Ionicons
                    name={getManeuverIcon(currentInstruction.maneuver) as any}
                    size={32}
                    color="#2196F3"
                  />
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      {currentInstruction.text}
                    </Text>
                    <Text style={styles.instructionDistance}>
                      {navigationService.formatDistance(currentInstruction.distance)}
                    </Text>
                  </View>
                </View>
                
                {currentInstruction.nextInstruction && (
                  <Text style={styles.nextInstruction}>
                    Then: {currentInstruction.nextInstruction}
                  </Text>
                )}
              </View>
            )}

            {/* Traffic Signals Ahead */}
            {trafficSignals.length > 0 && (
              <View style={styles.signalsCard}>
                <Text style={styles.cardTitle}>Traffic Signals Ahead</Text>
                {trafficSignals.slice(0, 3).map((signal, index) => (
                  <View key={signal.id} style={styles.signalRow}>
                    <View style={[
                      styles.signalDot,
                      { backgroundColor: getSignalStatusColor(signal.status) }
                    ]} />
                    <Text style={styles.signalText}>
                      {signal.status === 'cleared' ? 'Cleared' : 
                       signal.status === 'pending' ? 'Clearing...' : 'Normal'}
                    </Text>
                    {signal.clearanceTime && (
                      <Text style={styles.signalTime}>{signal.clearanceTime}s</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Route Options */}
            {renderRouteOptions()}

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.startButton, isEmergency && styles.emergencyButton]}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.startButtonText}>
                {isEmergency ? 'Start Emergency Navigation' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Route Calculation Failed</Text>
            <Text style={styles.emptySubtitle}>Unable to calculate route to destination</Text>
            <TouchableOpacity style={styles.retryButton} onPress={calculateRoute}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {renderRouteDetails()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    maxHeight: height * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  routeContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  routeSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  instructionCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionContent: {
    flex: 1,
    marginLeft: 12,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  instructionDistance: {
    fontSize: 14,
    color: '#666',
  },
  nextInstruction: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  signalsCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  signalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  signalText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  signalTime: {
    fontSize: 12,
    color: '#999',
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
    color: '#666',
    minWidth: 100,
  },
  optionButtons: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeOption: {
    backgroundColor: '#2196F3',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  activeOptionText: {
    color: '#fff',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#333',
  },
  startButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  emergencyButton: {
    backgroundColor: '#F44336',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 14,
    color: '#666',
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  signalStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalContent: {
    flex: 1,
  },
  signalDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default NavigationPanel;