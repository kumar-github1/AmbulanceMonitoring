import AsyncStorage from '@react-native-async-storage/async-storage';
import { SocketService } from './SocketService';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'status' | 'emergency' | 'system';
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface StatusUpdate {
  id: string;
  driverId: string;
  status: 'patient_picked_up' | 'en_route' | 'stuck_traffic' | 'arrived' | 'available' | 'unavailable';
  message: string;
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  emergencyId?: string;
}

export interface VoiceCall {
  id: string;
  callerId: string;
  callerName: string;
  recipientId: string;
  recipientName: string;
  type: 'incoming' | 'outgoing';
  status: 'ringing' | 'answered' | 'ended' | 'missed';
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface SOSAlert {
  id: string;
  driverId: string;
  driverName: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
  message?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  responseTime?: number;
}

class CommunicationService {
  private static instance: CommunicationService;
  private socketService: SocketService;
  private messages: Message[] = [];
  private messageListeners: ((messages: Message[]) => void)[] = [];
  private statusListeners: ((status: StatusUpdate) => void)[] = [];
  private voiceCallListeners: ((call: VoiceCall) => void)[] = [];
  private sosListeners: ((alert: SOSAlert) => void)[] = [];

  private constructor() {
    this.socketService = SocketService.getInstance();
    this.initializeSocketListeners();
  }

  public static getInstance(): CommunicationService {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService();
    }
    return CommunicationService.instance;
  }

  private initializeSocketListeners(): void {
    // Message listeners
    this.socketService.on('message_received', (message: Message) => {
      this.handleIncomingMessage(message);
    });

    this.socketService.on('status_update', (status: StatusUpdate) => {
      this.handleStatusUpdate(status);
    });

    this.socketService.on('voice_call_incoming', (call: VoiceCall) => {
      this.handleIncomingCall(call);
    });

    this.socketService.on('sos_alert', (alert: SOSAlert) => {
      this.handleSOSAlert(alert);
    });
  }

  public async loadMessages(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('messages');
      if (stored) {
        this.messages = JSON.parse(stored);
        this.notifyMessageListeners();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  public async sendMessage(
    recipientId: string,
    recipientName: string,
    content: string,
    type: Message['type'] = 'text',
    priority: Message['priority'] = 'normal'
  ): Promise<Message> {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: 'current_driver', // This should be actual driver ID
      senderName: 'Driver', // This should be actual driver name
      recipientId,
      recipientName,
      content,
      type,
      priority,
      timestamp: Date.now(),
      read: false,
    };

    try {
      // Send via socket
      this.socketService.emit('send_message', message);
      
      // Store locally
      this.messages.push(message);
      await this.saveMessages();
      this.notifyMessageListeners();
      
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  public async sendStatusUpdate(
    status: StatusUpdate['status'],
    message: string,
    location?: { latitude: number; longitude: number },
    emergencyId?: string
  ): Promise<void> {
    const statusUpdate: StatusUpdate = {
      id: `status_${Date.now()}`,
      driverId: 'current_driver', // This should be actual driver ID
      status,
      message,
      timestamp: Date.now(),
      location,
      emergencyId,
    };

    try {
      // Send via socket
      this.socketService.emit('status_update', statusUpdate);
      
      // Store locally
      await this.saveStatusUpdate(statusUpdate);
      this.notifyStatusListeners(statusUpdate);
    } catch (error) {
      console.error('Failed to send status update:', error);
      throw error;
    }
  }

  public async sendQuickMessage(type: 'patient_picked_up' | 'en_route' | 'stuck_traffic' | 'arrived'): Promise<void> {
    const messages = {
      patient_picked_up: 'Patient picked up and secured',
      en_route: 'En route to destination',
      stuck_traffic: 'Stuck in traffic, ETA delayed',
      arrived: 'Arrived at destination',
    };

    await this.sendStatusUpdate(type, messages[type]);
  }

  public async initiateVoiceCall(recipientId: string, recipientName: string): Promise<VoiceCall> {
    const call: VoiceCall = {
      id: `call_${Date.now()}`,
      callerId: 'current_driver', // This should be actual driver ID
      callerName: 'Driver', // This should be actual driver name
      recipientId,
      recipientName,
      type: 'outgoing',
      status: 'ringing',
      startTime: Date.now(),
    };

    try {
      // Initiate call via socket
      this.socketService.emit('initiate_call', call);
      
      // Store locally
      await this.saveVoiceCall(call);
      this.notifyVoiceCallListeners(call);
      
      return call;
    } catch (error) {
      console.error('Failed to initiate voice call:', error);
      throw error;
    }
  }

  public async sendSOSAlert(
    location: { latitude: number; longitude: number },
    message?: string
  ): Promise<SOSAlert> {
    const alert: SOSAlert = {
      id: `sos_${Date.now()}`,
      driverId: 'current_driver', // This should be actual driver ID
      driverName: 'Driver', // This should be actual driver name
      timestamp: Date.now(),
      location,
      message,
      status: 'active',
    };

    try {
      // Send SOS alert via socket
      this.socketService.emit('sos_alert', alert);
      
      // Store locally
      await this.saveSOSAlert(alert);
      this.notifySOSListeners(alert);
      
      return alert;
    } catch (error) {
      console.error('Failed to send SOS alert:', error);
      throw error;
    }
  }

  public getMessages(): Message[] {
    return this.messages.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getConversation(recipientId: string): Message[] {
    return this.messages
      .filter(msg => 
        (msg.senderId === recipientId || msg.recipientId === recipientId)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public async markMessageAsRead(messageId: string): Promise<void> {
    const message = this.messages.find(msg => msg.id === messageId);
    if (message && !message.read) {
      message.read = true;
      await this.saveMessages();
      this.notifyMessageListeners();
    }
  }

  public getUnreadCount(): number {
    return this.messages.filter(msg => !msg.read && msg.recipientId === 'current_driver').length;
  }

  // Event listeners
  public onMessages(listener: (messages: Message[]) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  public onStatusUpdate(listener: (status: StatusUpdate) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  public onVoiceCall(listener: (call: VoiceCall) => void): () => void {
    this.voiceCallListeners.push(listener);
    return () => {
      const index = this.voiceCallListeners.indexOf(listener);
      if (index > -1) {
        this.voiceCallListeners.splice(index, 1);
      }
    };
  }

  public onSOSAlert(listener: (alert: SOSAlert) => void): () => void {
    this.sosListeners.push(listener);
    return () => {
      const index = this.sosListeners.indexOf(listener);
      if (index > -1) {
        this.sosListeners.splice(index, 1);
      }
    };
  }

  // Private methods
  private handleIncomingMessage(message: Message): void {
    this.messages.push(message);
    this.saveMessages();
    this.notifyMessageListeners();
  }

  private handleStatusUpdate(status: StatusUpdate): void {
    this.saveStatusUpdate(status);
    this.notifyStatusListeners(status);
  }

  private handleIncomingCall(call: VoiceCall): void {
    this.saveVoiceCall(call);
    this.notifyVoiceCallListeners(call);
  }

  private handleSOSAlert(alert: SOSAlert): void {
    this.saveSOSAlert(alert);
    this.notifySOSListeners(alert);
  }

  private async saveMessages(): Promise<void> {
    try {
      await AsyncStorage.setItem('messages', JSON.stringify(this.messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }

  private async saveStatusUpdate(status: StatusUpdate): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('statusUpdates');
      const updates = existing ? JSON.parse(existing) : [];
      updates.push(status);
      await AsyncStorage.setItem('statusUpdates', JSON.stringify(updates));
    } catch (error) {
      console.error('Failed to save status update:', error);
    }
  }

  private async saveVoiceCall(call: VoiceCall): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('voiceCalls');
      const calls = existing ? JSON.parse(existing) : [];
      calls.push(call);
      await AsyncStorage.setItem('voiceCalls', JSON.stringify(calls));
    } catch (error) {
      console.error('Failed to save voice call:', error);
    }
  }

  private async saveSOSAlert(alert: SOSAlert): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('sosAlerts');
      const alerts = existing ? JSON.parse(existing) : [];
      alerts.push(alert);
      await AsyncStorage.setItem('sosAlerts', JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save SOS alert:', error);
    }
  }

  private notifyMessageListeners(): void {
    const sortedMessages = this.getMessages();
    this.messageListeners.forEach(listener => listener(sortedMessages));
  }

  private notifyStatusListeners(status: StatusUpdate): void {
    this.statusListeners.forEach(listener => listener(status));
  }

  private notifyVoiceCallListeners(call: VoiceCall): void {
    this.voiceCallListeners.forEach(listener => listener(call));
  }

  private notifySOSListeners(alert: SOSAlert): void {
    this.sosListeners.forEach(listener => listener(alert));
  }
}

export default CommunicationService;