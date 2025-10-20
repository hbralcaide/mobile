import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useMapOverlay } from '../../map/MapProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Market'>;

const MarketScreen: React.FC<Props> = () => {
  const { showMap, hideMap } = useMapOverlay();

  React.useEffect(() => {
    // Show the Mappedin map when this screen mounts
    showMap();
    
    // Hide the map when unmounting (going back)
    return () => {
      hideMap();
    };
  }, [showMap, hideMap]);

  return (
    <View style={styles.container}>
      {/* The map is rendered by MapProvider as a global overlay */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default MarketScreen;