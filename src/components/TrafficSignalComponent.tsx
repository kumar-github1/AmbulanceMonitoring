import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrafficSignal } from '../services/TrafficSignalService';

interface Props {
    signal: TrafficSignal;
    onPress?: (signal: TrafficSignal) => void;
    showDetails?: boolean;
}

const TrafficSignalComponent: React.FC<Props> = ({
    signal,
    onPress,
    showDetails = false
}) => {
    const getLightColor = (lightType: 'red' | 'yellow' | 'green', isActive: boolean): string => {
        if (!isActive) return '#333';

        switch (lightType) {
            case 'red': return '#FF3333';
            case 'yellow': return '#FFD700';
            case 'green': return '#00FF00';
            default: return '#333';
        }
    };

    const getSignalIcon = (): any => {
        switch (signal.type) {
            case 'intersection': return 'radio-button-off-outline';
            case 'pedestrian': return 'walk-outline';
            case 'highway_merge': return 'car-outline';
            default: return 'radio-button-off-outline';
        }
    };

    const getStatusColor = (): string => {
        switch (signal.status) {
            case 'emergency_mode': return '#FF6B35';
            case 'cleared_for_ambulance': return '#00C851';
            case 'normal': return '#666';
            default: return '#666';
        }
    };

    const formatDistance = (distance?: number): string => {
        if (!distance) return '';
        if (distance < 1000) {
            return `${Math.round(distance)}m`;
        }
        return `${(distance / 1000).toFixed(1)}km`;
    };

    return (
        <TouchableOpacity
            style={[styles.container, showDetails && styles.expandedContainer]}
            onPress={() => onPress?.(signal)}
            activeOpacity={0.7}
        >
            {/* Traffic Light Visual */}
            <View style={styles.trafficLightContainer}>
                <View style={styles.trafficLight}>
                    {/* Red Light */}
                    <View
                        style={[
                            styles.light,
                            { backgroundColor: getLightColor('red', signal.currentLight === 'red') }
                        ]}
                    />
                    {/* Yellow Light */}
                    <View
                        style={[
                            styles.light,
                            { backgroundColor: getLightColor('yellow', signal.currentLight === 'yellow') }
                        ]}
                    />
                    {/* Green Light */}
                    <View
                        style={[
                            styles.light,
                            { backgroundColor: getLightColor('green', signal.currentLight === 'green') }
                        ]}
                    />
                </View>

                {/* Emergency Override Indicator */}
                {signal.emergencyOverride && (
                    <View style={styles.emergencyIndicator}>
                        <Ionicons name="flash" size={12} color="#FF6B35" />
                    </View>
                )}
            </View>

            {/* Signal Info */}
            <View style={styles.infoContainer}>
                <View style={styles.headerRow}>
                    <Ionicons
                        name={getSignalIcon()}
                        size={16}
                        color={getStatusColor()}
                    />
                    <Text style={[styles.signalId, { color: getStatusColor() }]}>
                        {signal.id.replace('signal_', 'TL-')}
                    </Text>
                    {signal.ambulanceProximity && (
                        <Text style={styles.distance}>
                            {formatDistance(signal.ambulanceProximity)}
                        </Text>
                    )}
                </View>

                {showDetails && (
                    <>
                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Current:</Text>
                            <View style={styles.currentLightContainer}>
                                <View
                                    style={[
                                        styles.smallLight,
                                        { backgroundColor: getLightColor(signal.currentLight, true) }
                                    ]}
                                />
                                <Text style={[styles.currentLightText, { color: getLightColor(signal.currentLight, true) }]}>
                                    {signal.currentLight.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Countdown:</Text>
                            <Text style={styles.countdown}>
                                {signal.countdown}s
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Type:</Text>
                            <Text style={styles.value}>
                                {signal.type.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.label}>Direction:</Text>
                            <Text style={styles.value}>
                                {signal.direction.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>

                        {signal.status !== 'normal' && (
                            <View style={styles.statusRow}>
                                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                                    {signal.status.replace('_', ' ').toUpperCase()}
                                </Text>
                                {signal.emergencyOverride && (
                                    <Ionicons name="medical" size={14} color="#FF6B35" />
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* Simple status for compact view */}
                {!showDetails && (
                    <View style={styles.compactInfo}>
                        <Text style={styles.compactCountdown}>
                            {signal.countdown}s
                        </Text>
                        {signal.status !== 'normal' && (
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                                <Text style={styles.statusBadgeText}>
                                    {signal.status === 'emergency_mode' ? 'EMG' : 'CLR'}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 8,
        marginVertical: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    expandedContainer: {
        padding: 12,
        marginVertical: 4,
    },
    trafficLightContainer: {
        position: 'relative',
        marginRight: 12,
    },
    trafficLight: {
        backgroundColor: '#333',
        borderRadius: 6,
        padding: 3,
        width: 24,
        alignItems: 'center',
    },
    light: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginVertical: 1,
        borderWidth: 1,
        borderColor: '#555',
    },
    smallLight: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    emergencyIndicator: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#fff',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    signalId: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
    },
    distance: {
        fontSize: 11,
        color: '#666',
        backgroundColor: '#e9ecef',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 2,
    },
    label: {
        fontSize: 11,
        color: '#666',
        width: 70,
    },
    value: {
        fontSize: 11,
        color: '#333',
        fontWeight: '500',
    },
    currentLightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currentLightText: {
        fontSize: 11,
        fontWeight: '600',
    },
    countdown: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007bff',
        backgroundColor: '#e7f3ff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#dee2e6',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        flex: 1,
    },
    compactInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    compactCountdown: {
        fontSize: 11,
        color: '#666',
    },
    statusBadge: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 8,
        minWidth: 30,
        alignItems: 'center',
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#fff',
    },
});

export default TrafficSignalComponent;