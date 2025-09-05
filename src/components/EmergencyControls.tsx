import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  PanResponder,
  Vibration,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Location, Hospital } from '../services/HospitalService';

interface Props {
  isEmergencyActive: boolean;
  emergencyDuration: number;
  onStartEmergency: (hospital?: Hospital) => void;
  onEndEmergency: () => void;
  onManualOverride: () => void;
  selectedHospital?: Hospital;
  currentLocation?: Location;
  disabled?: boolean;
}

const { width } = Dimensions.get('window');

const EmergencyControls: React.FC<Props> = ({
  isEmergencyActive,
  emergencyDuration,
  onStartEmergency,
  onEndEmergency,
  onManualOverride,
  selectedHospital,
  currentLocation,
  disabled = false,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showEmergencyDetails, setShowEmergencyDetails] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  
  // Animations
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const holdAnimation = useRef(new Animated.Value(0)).current;
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  
  // Timers
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const pulseTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEmergencyActive) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }

    return () => {
      stopPulseAnimation();
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, [isEmergencyActive]);

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isEmergencyActive) pulse();
      });
    };
    pulse();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmergencyPress = () => {
    if (isEmergencyActive) {
      setShowConfirmDialog(true);
    } else {
      setShowEmergencyDetails(true);
    }
  };

  const handleStartEmergency = () => {
    setShowEmergencyDetails(false);
    Vibration.vibrate([100, 100, 100]);
    onStartEmergency(selectedHospital);
  };

  const handleEndEmergency = () => {
    setShowConfirmDialog(false);
    Vibration.vibrate(200);
    onEndEmergency();
  };

  const handleHoldStart = () => {
    if (isEmergencyActive) return;
    
    setIsHolding(true);
    setHoldProgress(0);
    
    Animated.timing(holdAnimation, {
      toValue: 100,
      duration: 3000, // 3 second hold
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && isHolding) {
        setIsHolding(false);
        handleStartEmergency();
      }
    });

    // Progress update
    const progressInterval = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / 30); // 30 updates over 3 seconds
      });
    }, 100);

    holdTimer.current = setTimeout(() => {
      clearInterval(progressInterval);
    }, 3000);
  };

  const handleHoldEnd = () => {
    setIsHolding(false);
    setHoldProgress(0);
    holdAnimation.stopAnimation();
    holdAnimation.setValue(0);
    
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      swipeAnimation.setOffset(swipeAnimation._value);
    },
    onPanResponderMove: Animated.event([null, { dx: swipeAnimation }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gestureState) => {
      swipeAnimation.flattenOffset();
      
      if (gestureState.dx > 150) {
        // Successful swipe
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
        onManualOverride();
      } else {
        // Reset swipe
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const renderEmergencyButton = () => {
    if (isEmergencyActive) {
      return (
        <Animated.View style={[styles.emergencyButtonContainer, { transform: [{ scale: pulseAnimation }] }]}>
          <TouchableOpacity
            style={[styles.emergencyButton, styles.emergencyActive]}
            onPress={handleEmergencyPress}
            disabled={disabled}
          >
            <Ionicons name="flash" size={48} color="#fff" />
            <Text style={styles.emergencyButtonText}>EMERGENCY ACTIVE</Text>
            <Text style={styles.emergencyDuration}>{formatDuration(emergencyDuration)}</Text>
          </TouchableOpacity>
          
          {/* Pulsing ring effect */}
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnimation }] }]} />
        </Animated.View>
      );
    }

    return (
      <View style={styles.emergencyButtonContainer}>
        <TouchableOpacity
          style={[
            styles.emergencyButton,
            styles.emergencyInactive,
            disabled && styles.emergencyDisabled,
            isHolding && styles.emergencyHolding,
          ]}
          onPress={handleEmergencyPress}
          onPressIn={handleHoldStart}
          onPressOut={handleHoldEnd}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {isHolding ? (
            <>
              <Animated.View style={[
                styles.holdProgressBar,
                { width: holdAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }) }
              ]} />
              <Ionicons name="flash-outline" size={48} color="#fff" />
              <Text style={styles.emergencyButtonText}>HOLD TO START</Text>
              <Text style={styles.holdProgressText}>{Math.round(holdProgress)}%</Text>
            </>
          ) : (
            <>
              <Ionicons name="flash-outline" size={48} color="#fff" />
              <Text style={styles.emergencyButtonText}>START EMERGENCY</Text>
              <Text style={styles.emergencySubtext}>Hold for 3 seconds or tap for options</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderManualOverride = () => {
    if (!isEmergencyActive) return null;

    return (
      <Animated.View 
        style={[
          styles.manualOverrideContainer,
          {
            transform: [{
              translateX: swipeAnimation.interpolate({
                inputRange: [-50, 0, 200],
                outputRange: [-50, 0, 150],
                extrapolate: 'clamp',
              })
            }]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.swipeTrack}>
          <Text style={styles.swipeText}>Swipe right for manual signal clearance</Text>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </View>
        <View style={styles.swipeHandle}>
          <Ionicons name="radio-outline" size={24} color="#FF9800" />
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {renderEmergencyButton()}
      {renderManualOverride()}

      {/* Emergency Details Modal */}
      <Modal
        visible={showEmergencyDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmergencyDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color="#F44336" />
              <Text style={styles.modalTitle}>Start Emergency Mode</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                This will activate emergency protocols:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="location" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>Continuous GPS tracking every second</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="radio" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>Traffic signal clearance requests</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="speedometer" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>Speed and route monitoring</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="medical" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>Priority hospital routing</Text>
                </View>
              </View>

              {selectedHospital && (
                <View style={styles.hospitalInfo}>
                  <Text style={styles.hospitalLabel}>Destination:</Text>
                  <Text style={styles.hospitalName}>{selectedHospital.name}</Text>
                  <Text style={styles.hospitalAddress}>{selectedHospital.address}</Text>
                </View>
              )}

              {currentLocation && (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Current Location:</Text>
                  <Text style={styles.locationCoords}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEmergencyDetails(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleStartEmergency}
              >
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Start Emergency</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Emergency Confirmation Modal */}
      <Modal
        visible={showConfirmDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmHeader}>
              <Ionicons name="stop-circle" size={32} color="#F44336" />
              <Text style={styles.confirmTitle}>End Emergency Mode?</Text>
            </View>
            
            <Text style={styles.confirmText}>
              Are you sure you want to end the emergency session?
            </Text>
            
            <Text style={styles.emergencyStats}>
              Duration: {formatDuration(emergencyDuration)}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowConfirmDialog(false)}
              >
                <Text style={styles.confirmCancelText}>Continue Emergency</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmEndButton}
                onPress={handleEndEmergency}
              >
                <Ionicons name="stop" size={20} color="#fff" />
                <Text style={styles.confirmEndText}>End Emergency</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  emergencyButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  emergencyActive: {
    backgroundColor: '#F44336',
  },
  emergencyInactive: {
    backgroundColor: '#FF9800',
  },
  emergencyDisabled: {
    backgroundColor: '#ccc',
  },
  emergencyHolding: {
    backgroundColor: '#4CAF50',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  emergencySubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  emergencyDuration: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  holdProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  holdProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  manualOverrideContainer: {
    width: width - 32,
    height: 60,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  swipeTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  swipeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeHandle: {
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  hospitalInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  hospitalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  hospitalAddress: {
    fontSize: 14,
    color: '#666',
  },
  locationInfo: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F44336',
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Confirmation modal styles
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 350,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  confirmText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  emergencyStats: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmEndButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F44336',
    gap: 6,
  },
  confirmEndText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmergencyControls;