import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  isVisible: boolean;
  duration: number;
  signalsCleared: number;
  onTap: () => void;
}

const { width } = Dimensions.get('window');

const EmergencyAlertBar: React.FC<Props> = ({
  isVisible,
  duration,
  signalsCleared,
  onTap,
}) => {
  const slideAnimation = useRef(new Animated.Value(-100)).current;
  const flashAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      // Slide in
      Animated.spring(slideAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Start flashing animation
      const flash = () => {
        Animated.sequence([
          Animated.timing(flashAnimation, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isVisible) flash();
        });
      };
      flash();
    } else {
      // Slide out
      Animated.timing(slideAnimation, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Stop flashing
      flashAnimation.stopAnimation();
      flashAnimation.setValue(1);
    }

    return () => {
      flashAnimation.stopAnimation();
    };
  }, [isVisible]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnimation }],
          opacity: flashAnimation,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.alertBar}
        onPress={onTap}
        activeOpacity={0.8}
      >
        <View style={styles.leftContent}>
          <View style={styles.emergencyIcon}>
            <Ionicons name="flash" size={20} color="#fff" />
          </View>
          <View style={styles.textContent}>
            <Text style={styles.emergencyTitle}>EMERGENCY ACTIVE</Text>
            <Text style={styles.emergencyDetails}>
              {formatDuration(duration)} • {signalsCleared} signals cleared
            </Text>
          </View>
        </View>
        
        <View style={styles.rightContent}>
          <Ionicons name="chevron-up" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: 44, // Account for status bar
  },
  alertBar: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencyDetails: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  rightContent: {
    padding: 4,
  },
});

export default EmergencyAlertBar;