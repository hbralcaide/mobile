import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Linking,
    Alert,
} from 'react-native';

interface DirectionsModalProps {
    visible: boolean;
    vendorName: string;
    stallNumber: string;
    onClose: () => void;
    onIndoorMap: () => void;
}

const DirectionsModal: React.FC<DirectionsModalProps> = ({
    visible,
    vendorName,
    stallNumber,
    onClose,
    onIndoorMap,
}) => {
    const handleOutdoorDirections = () => {
        // Toril Public Market coordinates
        const marketLat = 7.018333;
        const marketLng = 125.495556;
        const marketName = 'Toril Public Market, Toril, Davao City';
        const marketAddress = 'Toril Public Market, McArthur Highway, Toril, Davao City, Davao del Sur';

        const url = Platform.select({
            ios: `maps:?daddr=${marketLat},${marketLng}&q=${encodeURIComponent(marketName)}`,
            android: `google.navigation:q=${marketLat},${marketLng}&mode=d`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${marketLat},${marketLng}&destination_place_id=${encodeURIComponent(marketName)}`
        });

        Linking.openURL(url).catch(() => {
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(marketAddress)}`;
            Linking.openURL(webUrl).catch(() => {
                Alert.alert('Error', 'Unable to open maps application');
            });
        });
        
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerIcon}>🧭</Text>
                        <Text style={styles.headerTitle}>Get Directions</Text>
                    </View>

                    {/* Vendor Info */}
                    <View style={styles.vendorInfo}>
                        <Text style={styles.vendorName}>{vendorName}</Text>
                        <Text style={styles.stallNumber}>📍 Stall {stallNumber}</Text>
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>
                        Choose how you'd like to navigate to this vendor
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.indoorButton]}
                            onPress={onIndoorMap}
                        >
                            <Text style={styles.buttonIcon}>🗺️</Text>
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonTitle}>Indoor Map</Text>
                                <Text style={styles.buttonSubtitle}>
                                    Navigate inside the market
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.outdoorButton]}
                            onPress={handleOutdoorDirections}
                        >
                            <Text style={styles.buttonIcon}>📍</Text>
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonTitle}>Outdoor Directions</Text>
                                <Text style={styles.buttonSubtitle}>
                                    Get directions to the market
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Cancel Button */}
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    headerIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    vendorInfo: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    vendorName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
        textAlign: 'center',
    },
    stallNumber: {
        fontSize: 14,
        color: '#6B7280',
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonsContainer: {
        gap: 12,
        marginBottom: 16,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    indoorButton: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    outdoorButton: {
        backgroundColor: '#F0FDF4',
        borderColor: '#22C55E',
    },
    buttonIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    buttonContent: {
        flex: 1,
    },
    buttonTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    buttonSubtitle: {
        fontSize: 13,
        color: '#6B7280',
    },
    cancelButton: {
        padding: 14,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default DirectionsModal;
