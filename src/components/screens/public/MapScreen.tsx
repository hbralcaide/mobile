import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useMapOverlay } from '../../map/MapProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Map'>;

const MapScreen: React.FC<Props> = ({ route, navigation }) => {
  const { stallNumber, vendorName } = route.params || {};
  const { showMap, hideMap } = useMapOverlay();

  // Show the global map overlay when this screen mounts; hide when leaving
  useEffect(() => {
    showMap({ stallNumber, vendorName });
    return () => hideMap();
  }, [showMap, hideMap, stallNumber, vendorName]);

  const onBack = () => {
    hideMap();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {stallNumber ? `Directions to ${stallNumber}` : 'Market Map'}
        </Text>
      </View>

      {/* The global Map overlay is rendered by MapProvider. We keep an empty container for layout symmetry. */}
      <View style={styles.mapContainer} />

      {/* Vendor Info Banner (if navigating to specific stall) */}
      {vendorName && stallNumber && (
        <View style={styles.vendorBanner}>
          <Text style={styles.vendorBannerText}>
            🎯 Navigating to {vendorName} - Stall {stallNumber}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 5,
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333333',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  vendorBanner: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  vendorBannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MapScreen;
