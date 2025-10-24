import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import type { StallData } from './MappedinMap';

interface StallPromptProps {
  visible: boolean;
  stall?: StallData;
  onClose: () => void;
  onGetDirections: (stall: StallData) => void;
  onViewStall: (stall: StallData) => void;
}

const StallPrompt: React.FC<StallPromptProps> = ({ visible, stall, onClose, onGetDirections, onViewStall }) => {
  const title = stall?.vendorName || stall?.label || 'Selected Stall';
  const stallNumber = stall?.stallNumber || stall?.label || stall?.id;
  const floor = stall?.floorName ? ` • ${stall.floorName}` : '';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Stall {stallNumber}{floor}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => stall && onGetDirections(stall)}>
              <Text style={styles.primaryText}>Get Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => stall && onViewStall(stall)}>
              <Text style={styles.secondaryText}>View Stall</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#555',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#4CAF50',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
  },
  secondaryText: { color: '#4CAF50', fontWeight: '700', fontSize: 16 },
});

export default StallPrompt;
