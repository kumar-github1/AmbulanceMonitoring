import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { ConnectionStatus } from '../services/AdvancedSocketService';

interface Props {
  connectionStatus: ConnectionStatus;
  onManualReconnect?: () => void;
  onClearQueue?: () => void;
  style?: any;
}

const { width } = Dimensions.get('window');

const ConnectionStatusIndicator: React.FC<Props> = ({
  connectionStatus,
  onManualReconnect,
  onClearQueue,
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdateText, setLastUpdateText] = useState('Never');

  useEffect(() => {
    const updateLastSyncText = () => {
      if (!connectionStatus.lastSyncTime) {
        setLastUpdateText('Never');
        return;
      }

      const now = Date.now();
      const diff = now - connectionStatus.lastSyncTime;

      if (diff < 5000) {
        setLastUpdateText('Just now');
      } else if (diff < 60000) {
        setLastUpdateText(`${Math.floor(diff / 1000)}s ago`);
      } else if (diff < 3600000) {
        setLastUpdateText(`${Math.floor(diff / 60000)}m ago`);
      } else {
        setLastUpdateText('Over 1h ago');
      }
    };

    updateLastSyncText();
    const interval = setInterval(updateLastSyncText, 1000);

    return () => clearInterval(interval);
  }, [connectionStatus.lastSyncTime]);

  const getStatusColor = (): string => {
    if (connectionStatus.isConnected) return '#4CAF50';
    if (connectionStatus.isReconnecting) return '#FF9800';
    return '#F44336';
  };

  const getStatusIcon = (): string => {
    if (connectionStatus.isConnected) return '🟢';
    if (connectionStatus.isReconnecting) return '🟡';
    return '🔴';
  };

  const getStatusText = (): string => {
    if (connectionStatus.isConnected) return 'Connected';
    if (connectionStatus.isReconnecting) {
      return `Reconnecting... (${connectionStatus.reconnectAttempts})`;
    }
    return 'Disconnected';
  };

  const getLatencyColor = (latency: number | null): string => {
    if (!latency) return '#666';
    if (latency < 100) return '#4CAF50';
    if (latency < 300) return '#FF9800';
    return '#F44336';
  };

  const formatLastConnected = (): string => {
    if (!connectionStatus.lastConnected) return 'Never';
    
    const date = new Date(connectionStatus.lastConnected);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString();
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { borderColor: getStatusColor() }, style]}
        onPress={() => setShowDetails(true)}
        activeOpacity={0.7}
      >
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
            <Text style={styles.lastSync}>Last sync: {lastUpdateText}</Text>
          </View>
          {connectionStatus.queuedEvents > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueText}>{connectionStatus.queuedEvents}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={showDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connection Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetails(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Connection Status */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>🔗 Connection Status</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={styles.statusContainer}>
                    <Text style={[styles.detailValue, { color: getStatusColor() }]}>
                      {getStatusIcon()} {getStatusText()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Connected:</Text>
                  <Text style={styles.detailValue}>{formatLastConnected()}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Sync:</Text>
                  <Text style={styles.detailValue}>{lastUpdateText}</Text>
                </View>
              </View>

              {/* Network Stats */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>📊 Network Stats</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Server Latency:</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: getLatencyColor(connectionStatus.serverLatency) }
                  ]}>
                    {connectionStatus.serverLatency ? 
                      `${connectionStatus.serverLatency}ms` : 'Unknown'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reconnect Attempts:</Text>
                  <Text style={styles.detailValue}>
                    {connectionStatus.reconnectAttempts}
                  </Text>
                </View>
              </View>

              {/* Offline Queue */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>📦 Offline Queue</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Queued Events:</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: connectionStatus.queuedEvents > 0 ? '#FF9800' : '#4CAF50' }
                  ]}>
                    {connectionStatus.queuedEvents}
                  </Text>
                </View>
                
                {connectionStatus.queuedEvents > 0 && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      onClearQueue?.();
                      setShowDetails(false);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Clear Queue</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Manual Controls */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>🔧 Manual Controls</Text>
                
                <TouchableOpacity
                  style={[
                    styles.reconnectButton,
                    connectionStatus.isReconnecting && styles.buttonDisabled
                  ]}
                  onPress={() => {
                    onManualReconnect?.();
                    setShowDetails(false);
                  }}
                  disabled={connectionStatus.isReconnecting}
                >
                  {connectionStatus.isReconnecting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.reconnectButtonText}>🔄 Reconnect Now</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Connection Tips */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>💡 Connection Tips</Text>
                
                <Text style={styles.tipText}>
                  • Check your internet connection
                </Text>
                <Text style={styles.tipText}>
                  • Ensure server URL is correct in settings
                </Text>
                <Text style={styles.tipText}>
                  • Try manual reconnect if issues persist
                </Text>
                <Text style={styles.tipText}>
                  • Events are queued when offline and sent when reconnected
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lastSync: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  queueBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  queueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    flex: 1,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reconnectButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  reconnectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
});

export default ConnectionStatusIndicator;