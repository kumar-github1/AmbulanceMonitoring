import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Vibration,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CommunicationService, { Message, StatusUpdate } from '../services/CommunicationService';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  emergencyId?: string;
}

const { width, height } = Dimensions.get('window');

const CommunicationPanel: React.FC<Props> = ({
  visible,
  onClose,
  currentLocation,
  emergencyId,
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'messages' | 'voice'>('quick');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const slideAnimation = useRef(new Animated.Value(height)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const communicationService = CommunicationService.getInstance();

  useEffect(() => {
    if (visible) {
      animateIn();
      loadMessages();
    } else {
      animateOut();
    }
  }, [visible]);

  useEffect(() => {
    const unsubscribeMessages = communicationService.onMessages((msgs) => {
      setMessages(msgs);
      setUnreadCount(communicationService.getUnreadCount());
    });

    const unsubscribeStatus = communicationService.onStatusUpdate((status) => {
      console.log('Status update received:', status);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
    };
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(slideAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pulseSOSButton = () => {
    Animated.sequence([
      Animated.timing(pulseAnimation, {
        toValue: 1.1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => pulseSOSButton());
  };

  const loadMessages = async () => {
    try {
      await communicationService.loadMessages();
      const msgs = communicationService.getMessages();
      setMessages(msgs);
      setUnreadCount(communicationService.getUnreadCount());
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleQuickMessage = async (type: 'patient_picked_up' | 'en_route' | 'stuck_traffic' | 'arrived') => {
    setIsLoading(true);
    try {
      await communicationService.sendQuickMessage(type);
      Vibration.vibrate(100);
      Alert.alert('Status Sent', 'Your status update has been sent to control center.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send status update. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsLoading(true);
    try {
      await communicationService.sendMessage(
        'control_center',
        'Control Center',
        newMessage.trim(),
        'text',
        'normal'
      );
      setNewMessage('');
      Alert.alert('Message Sent', 'Your message has been sent to control center.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceCall = async () => {
    try {
      await communicationService.initiateVoiceCall('control_center', 'Control Center');
      Alert.alert(
        'Voice Call',
        'Initiating voice call to Control Center...',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate voice call. Please try again.');
    }
  };

  const handleSOSAlert = () => {
    Alert.alert(
      'SOS Emergency Alert',
      'This will send an emergency alert to all nearby units and control center. Use only in case of driver emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              const location = currentLocation || { latitude: 37.7749, longitude: -122.4194 };
              await communicationService.sendSOSAlert(location, 'Driver emergency - immediate assistance required');
              Vibration.vibrate([0, 500, 200, 500]);
              Alert.alert('SOS Alert Sent', 'Emergency alert has been sent. Help is on the way.');
            } catch (error) {
              Alert.alert('Error', 'Failed to send SOS alert. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderQuickMessages = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quickMessageSection}>
        <Text style={styles.sectionTitle}>Quick Status Updates</Text>
        <View style={styles.quickButtonsContainer}>
          <TouchableOpacity
            style={[styles.quickButton, styles.successButton]}
            onPress={() => handleQuickMessage('patient_picked_up')}
            disabled={isLoading}
          >
            <Ionicons name="person-add" size={24} color="#fff" />
            <Text style={styles.quickButtonText}>Patient Picked Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton, styles.primaryButton]}
            onPress={() => handleQuickMessage('en_route')}
            disabled={isLoading}
          >
            <Ionicons name="car" size={24} color="#fff" />
            <Text style={styles.quickButtonText}>En Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton, styles.warningButton]}
            onPress={() => handleQuickMessage('stuck_traffic')}
            disabled={isLoading}
          >
            <Ionicons name="warning" size={24} color="#fff" />
            <Text style={styles.quickButtonText}>Stuck in Traffic</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickButton, styles.infoButton]}
            onPress={() => handleQuickMessage('arrived')}
            disabled={isLoading}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.quickButtonText}>Arrived</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.emergencySection}>
        <Text style={styles.sectionTitle}>Emergency Actions</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleSOSAlert}
            onPressIn={() => pulseSOSButton()}
          >
            <Ionicons name="alert" size={32} color="#fff" />
            <Text style={styles.sosButtonText}>SOS - DRIVER EMERGENCY</Text>
            <Text style={styles.sosSubtext}>Tap to send emergency alert</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );

  const renderMessages = () => (
    <View style={styles.tabContent}>
      <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No messages yet</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageItem,
                message.senderId === 'current_driver' ? styles.sentMessage : styles.receivedMessage,
              ]}
            >
              <Text style={styles.messageContent}>{message.content}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Text>
                {message.senderId === 'current_driver' && (
                  <Ionicons
                    name={message.read ? 'checkmark-done' : 'checkmark'}
                    size={12}
                    color={message.read ? '#4CAF50' : '#666'}
                  />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.messageInput}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message to Control Center..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || isLoading}
        >
          <Ionicons name="send" size={20} color={newMessage.trim() ? '#2196F3' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVoice = () => (
    <View style={styles.tabContent}>
      <View style={styles.voiceSection}>
        <Text style={styles.sectionTitle}>Voice Communication</Text>
        
        <TouchableOpacity style={styles.voiceCallButton} onPress={handleVoiceCall}>
          <Ionicons name="call" size={32} color="#fff" />
          <Text style={styles.voiceCallText}>Call Control Center</Text>
          <Text style={styles.voiceCallSubtext}>Direct voice communication</Text>
        </TouchableOpacity>

        <View style={styles.callHistory}>
          <Text style={styles.callHistoryTitle}>Recent Calls</Text>
          <View style={styles.emptyState}>
            <Ionicons name="call-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No recent calls</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'quick':
        return renderQuickMessages();
      case 'messages':
        return renderMessages();
      case 'voice':
        return renderVoice();
      default:
        return renderQuickMessages();
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnimation }]}>
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
            <Text style={styles.headerTitle}>Communication</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'quick' && styles.activeTab]}
              onPress={() => setActiveTab('quick')}
            >
              <Ionicons name="flash" size={20} color={activeTab === 'quick' ? '#2196F3' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'quick' && styles.activeTabText]}>
                Quick
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
              onPress={() => setActiveTab('messages')}
            >
              <Ionicons name="chatbubbles" size={20} color={activeTab === 'messages' ? '#2196F3' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
                Messages
              </Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'voice' && styles.activeTab]}
              onPress={() => setActiveTab('voice')}
            >
              <Ionicons name="call" size={20} color={activeTab === 'voice' ? '#2196F3' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'voice' && styles.activeTabText]}>
                Voice
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {renderTabContent()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  quickMessageSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  quickButtonsContainer: {
    gap: 12,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  infoButton: {
    backgroundColor: '#00BCD4',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  emergencySection: {
    padding: 20,
    paddingTop: 0,
  },
  sosButton: {
    backgroundColor: '#F44336',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sosSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  messageItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageContent: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    padding: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  voiceSection: {
    padding: 20,
  },
  voiceCallButton: {
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 8,
  },
  voiceCallText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  voiceCallSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  callHistory: {
    marginTop: 16,
  },
  callHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
});

export default CommunicationPanel;