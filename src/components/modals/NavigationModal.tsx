import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';

interface NavigationModalProps {
  visible: boolean;
  vendor: any | null;
  onClose: () => void;
  onViewDetails: () => void;
  onConfirm: () => void;
}

const NavigationModal: React.FC<NavigationModalProps> = ({
  visible,
  vendor,
  onClose,
  onViewDetails,
  onConfirm,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Gradient Header Background */}
          <View style={styles.headerSection}>
            {/* Navigation Icon */}
            <View style={styles.navigationIconContainer}>
              <View style={styles.navigationIconCircle}>
                <Text style={styles.navigationIcon}>🧭</Text>
              </View>
              <View style={styles.pulseCircle} />
            </View>
            
            <Text style={styles.title}>Let's Navigate!</Text>
            <Text style={styles.subtitle}>Your destination awaits</Text>
          </View>

          {/* Vendor Info Card */}
          {vendor && (
            <View style={styles.contentSection}>
              <View style={styles.vendorCard}>
                <View style={styles.vendorImageWrapper}>
                  {vendor.profile_image_url ? (
                    <Image 
                      source={{ uri: `${vendor.profile_image_url}?v=${Date.now()}` }} 
                      style={styles.vendorImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.vendorImagePlaceholder}>
                      <Text style={styles.vendorInitial}>
                        {(vendor.business_name || vendor.first_name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.vendorImageBadge}>
                    <Text style={styles.vendorImageBadgeIcon}>✓</Text>
                  </View>
                </View>

                <View style={styles.vendorDetails}>
                  <Text style={styles.vendorName} numberOfLines={2}>
                    {vendor.business_name || `${vendor.first_name} ${vendor.last_name}`}
                  </Text>
                  
                  <View style={styles.stallBadge}>
                    <View style={styles.stallDot} />
                    <Text style={styles.stallText}>Stall {vendor.stall_number}</Text>
                  </View>
                </View>
              </View>

              {/* Direction Instructions */}
              <View style={styles.instructionBox}>
                <View style={styles.instructionIconBox}>
                  <Text style={styles.instructionIcon}>📍</Text>
                </View>
                <View style={styles.instructionContent}>
                  <Text style={styles.instructionTitle}>How to get there</Text>
                  <Text style={styles.instructionText}>
                    Follow the blue path on the map to reach your destination
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onViewDetails}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonIcon}>🔍</Text>
              <Text style={styles.secondaryButtonText}>View Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Start Navigation</Text>
              <Text style={styles.primaryButtonIcon}>→</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButtonText: {
    fontSize: 22,
    color: '#2C2C2C',
    fontWeight: '700',
  },
  headerSection: {
    backgroundColor: '#4CAF50',
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  navigationIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  navigationIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  pulseCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  navigationIcon: {
    fontSize: 44,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  contentSection: {
    padding: 24,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  vendorImageWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  vendorImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  vendorImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  vendorInitial: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  vendorImageBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  vendorImageBadgeIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  vendorDetails: {
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 8,
    lineHeight: 22,
  },
  stallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  stallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  stallText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  instructionBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  instructionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionIcon: {
    fontSize: 20,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'column',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  primaryButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default NavigationModal;
