import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrafficSignal } from '../services/TrafficSignalService';
import TrafficSignalComponent from './TrafficSignalComponent';

interface Props {
    visible: boolean;
    signals: TrafficSignal[];
    onClose: () => void;
    onManualOverride: (signalId: string) => void;
}

const { width, height } = Dimensions.get('window');

const TrafficSignalsPanel: React.FC<Props> = ({
    visible,
    signals,
    onClose,
    onManualOverride,
}) => {
    const [selectedSignal, setSelectedSignal] = useState<TrafficSignal | null>(null);

    const nearbySignals = signals
        .filter(s => s.ambulanceProximity && s.ambulanceProximity <= 2000) // 2km range
        .sort((a, b) => (a.ambulanceProximity || 0) - (b.ambulanceProximity || 0));

    const emergencyModeSignals = nearbySignals.filter(s => s.emergencyOverride);
    const normalSignals = nearbySignals.filter(s => !s.emergencyOverride);

    const handleSignalPress = (signal: TrafficSignal) => {
        setSelectedSignal(signal);
    };

    const handleManualOverride = (signal: TrafficSignal) => {
        onManualOverride(signal.id);
        setSelectedSignal(null);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Ionicons name="radio-button-off" size={24} color="#FF6B35" />
                            <Text style={styles.title}>Traffic Signals</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Stats Bar */}
                    <View style={styles.statsBar}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{nearbySignals.length}</Text>
                            <Text style={styles.statLabel}>Nearby</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: '#FF6B35' }]}>
                                {emergencyModeSignals.length}
                            </Text>
                            <Text style={styles.statLabel}>Emergency</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: '#00C851' }]}>
                                {emergencyModeSignals.filter(s => s.status === 'cleared_for_ambulance').length}
                            </Text>
                            <Text style={styles.statLabel}>Cleared</Text>
                        </View>
                    </View>

                    {/* Signals List */}
                    <ScrollView style={styles.signalsList} showsVerticalScrollIndicator={false}>
                        {/* Emergency Mode Signals */}
                        {emergencyModeSignals.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>🚨 Emergency Mode</Text>
                                {emergencyModeSignals.map(signal => (
                                    <TrafficSignalComponent
                                        key={signal.id}
                                        signal={signal}
                                        onPress={handleSignalPress}
                                        showDetails={false}
                                    />
                                ))}
                            </>
                        )}

                        {/* Normal Signals */}
                        {normalSignals.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>🚦 Normal Operation</Text>
                                {normalSignals.map(signal => (
                                    <TrafficSignalComponent
                                        key={signal.id}
                                        signal={signal}
                                        onPress={handleSignalPress}
                                        showDetails={false}
                                    />
                                ))}
                            </>
                        )}

                        {nearbySignals.length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="location-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyText}>No traffic signals nearby</Text>
                                <Text style={styles.emptySubtext}>Move closer to intersections to see traffic signals</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Signal Detail Modal */}
                {selectedSignal && (
                    <Modal
                        visible={!!selectedSignal}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setSelectedSignal(null)}
                    >
                        <View style={styles.detailOverlay}>
                            <View style={styles.detailContent}>
                                <TrafficSignalComponent
                                    signal={selectedSignal}
                                    showDetails={true}
                                />

                                <View style={styles.detailActions}>
                                    {!selectedSignal.emergencyOverride && (
                                        <TouchableOpacity
                                            style={styles.overrideButton}
                                            onPress={() => handleManualOverride(selectedSignal)}
                                        >
                                            <Ionicons name="flash" size={20} color="#fff" />
                                            <Text style={styles.overrideButtonText}>Manual Override</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setSelectedSignal(null)}
                                    >
                                        <Text style={styles.cancelButtonText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: height * 0.8,
        paddingBottom: 34, // Safe area
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        marginLeft: 12,
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    statsBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#f8f9fa',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
    },
    signalsList: {
        flex: 1,
        paddingHorizontal: 20,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#666',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 20,
    },
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 40,
        maxWidth: width - 80,
    },
    detailActions: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 12,
    },
    overrideButton: {
        flex: 1,
        backgroundColor: '#FF6B35',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    overrideButtonText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 6,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#e0e0e0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
});

export default TrafficSignalsPanel;