import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import DriverService, { Driver } from '../services/DriverService';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
  onLoginSuccess?: (driver: Driver) => void;
}

const LoginScreen: React.FC<Props> = ({ navigation, onLoginSuccess }) => {
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;

  const driverService = DriverService.getInstance();

  useEffect(() => {
    checkStoredLogin();
    animateLogin();
  }, []);

  const checkStoredLogin = async () => {
    try {
      const storedDriver = await driverService.loadStoredDriver();
      if (storedDriver) {
        if (onLoginSuccess) {
          onLoginSuccess(storedDriver);
        } else {
          navigation.replace('MainMap');
        }
        return;
      }
    } catch (error) {
      console.error('Failed to check stored login:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const animateLogin = () => {
    const rotateLogo = () => {
      logoRotation.setValue(0);
      Animated.timing(logoRotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => rotateLogo());
    };
    rotateLogo();

    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!driverId.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both Driver ID and Password');
      return;
    }

    setIsLoading(true);

    try {
      const driver = await driverService.login({
        driverId: driverId.trim(),
        password: password.trim(),
      });

      Alert.alert(
        'Login Successful',
        `Welcome back, ${driver.name}!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              if (onLoginSuccess) {
                onLoginSuccess(driver);
              } else {
                navigation.replace('MainMap');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert(
        'Login Failed',
        'Invalid credentials or connection error. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = () => {
    setDriverId('DRIVER001');
    setPassword('password123');
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Checking login status...</Text>
      </View>
    );
  }

  const logoRotate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoBackground,
              {
                transform: [{ rotate: logoRotate }],
              },
            ]}
          >
            <Ionicons name="medical" size={60} color="#fff" />
          </Animated.View>
          <Text style={styles.appTitle}>AmbulanceDriver</Text>
          <Text style={styles.appSubtitle}>Emergency Response System</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Driver Login</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Driver ID"
              placeholderTextColor="#999"
              value={driverId}
              onChangeText={setDriverId}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in" size={20} color="#fff" />
                <Text style={styles.loginButtonText}>LOGIN</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLoginButton}
            onPress={handleQuickLogin}
          >
            <Text style={styles.quickLoginText}>Quick Login (Demo)</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Contact your supervisor if you've forgotten your credentials
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Emergency Response Division</Text>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickLoginButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickLoginText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  versionText: {
    color: '#999',
    fontSize: 12,
  },
});

export default LoginScreen;