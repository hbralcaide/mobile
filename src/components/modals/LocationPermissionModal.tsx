import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface LocationPermissionModalProps {
  visible: boolean;
  onRequestPermission: () => void;
  onDeny: () => void;
}

const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  visible,
  onRequestPermission,
  onDeny,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>📍</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Enable Location Services</Text>

          {/* Description */}
          <Text style={styles.description}>
            To provide accurate navigation and directions to stalls within the market, 
            we need access to your device location.
          </Text>

          {/* Benefits List */}
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.benefitText}>Get real-time directions from where you are</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.benefitText}>Navigate easily to any stall in the market</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.benefitText}>See your current position on the map</Text>
            </View>
          </View>

          {/* Privacy Note */}
          <Text style={styles.privacyNote}>
            Your location is only used for navigation and is never stored or shared.
          </Text>

          <Text style={styles.skipNote}>
            You can still navigate using the market entrance if you choose "Not Now"
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.allowButton}
              onPress={onRequestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.allowButtonText}>Allow Location Access</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.denyButton}
              onPress={onDeny}
              activeOpacity={0.7}
            >
              <Text style={styles.denyButtonText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  benefitsList: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkmark: {
    fontSize: 18,
    color: '#10B981',
    marginRight: 12,
    fontWeight: '700',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  privacyNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    gap: 12,
  },
  allowButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  allowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  denyButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LocationPermissionModal;
