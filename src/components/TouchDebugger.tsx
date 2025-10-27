import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';

interface Props {
    testId?: string;
    label?: string;
}

const TouchDebugger: React.FC<Props> = ({ testId = 'touch-test', label = 'Touch Test' }) => {
    const handlePress = () => {
        console.log(`TouchDebugger pressed: ${label}`);
        Alert.alert('Touch Debug', `${label} button was pressed successfully!`);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                testID={testId}
                style={styles.button}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                <Text style={styles.buttonText}>{label}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#FF5722',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 120,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default TouchDebugger;