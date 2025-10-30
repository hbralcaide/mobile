import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import MapViewComponent from '../../map/MapView';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Market'>;

interface CustomerHomeProps extends Props {
  onLogout?: () => void;
}

const CustomerHome: React.FC<CustomerHomeProps> = ({ navigation }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{id: string; name: string; data?: any} | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const toggleBanner = () => {
    const toValue = isExpanded ? 300 : 0;
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setIsExpanded(!isExpanded);
    });
  };

  const handleCategoryPress = (category: string) => {
    // Toggle category selection for highlighting
    setSelectedCategory(prev => prev === category ? null : category);
  };

  const handleStallClick = async (stallNumber: string) => {
    console.log('Stall clicked:', stallNumber);
    
    try {
      // Query vendor by stall_number
      const { data: vendor, error } = await supabase
        .from('vendor_profiles')
        .select('id, business_name, first_name, last_name')
        .eq('stall_number', stallNumber)
        .single();

      if (error) {
        console.error('Error fetching vendor:', error);
        Alert.alert('No Vendor', `Stall ${stallNumber} is currently vacant.`);
        return;
      }

      if (vendor) {
        console.log('Vendor found:', vendor);
        // Navigate to VendorDetails screen
        navigation.navigate('VendorDetails', {
          vendorId: vendor.id,
          vendorName: vendor.business_name || `${vendor.first_name} ${vendor.last_name}`,
        });
      }
    } catch (error) {
      console.error('Error handling stall click:', error);
      Alert.alert('Error', 'Failed to load vendor information');
    }
  };

  const handleLocationSelect = (locationId: string, locationName: string, locationData?: any) => {
    console.log('Location selected:', { locationId, locationName, locationData });
    setSelectedLocation({ id: locationId, name: locationName, data: locationData });
    
    // Show location details alert
    Alert.alert(
      locationName,
      'What would you like to do?',
      [
        {
          text: 'View Details',
          onPress: () => {
            // TODO: Navigate to location/vendor details
            console.log('View details for:', locationId);
          }
        },
        {
          text: 'Get Directions',
          onPress: () => {
            // TODO: Show directions to this location
            console.log('Get directions to:', locationId);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setSelectedLocation(null)
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2C2C2C" />

      {/* Main Content - Indoor Map */}
      <View style={styles.mainContent}>
        <MapViewComponent 
          onLocationSelect={handleLocationSelect}
          selectedCategory={selectedCategory || undefined}
          onStallClick={handleStallClick}
        />
        
        {/* Selected Location Info Banner */}
        {selectedLocation && (
          <View style={styles.locationInfoBanner}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationName}>{selectedLocation.name}</Text>
              <Text style={styles.locationId}>ID: {selectedLocation.id}</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedLocation(null)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Green Banner Overlay */}
      <Animated.View
        style={[
          styles.greenBanner,
          {
            transform: [{ translateY: translateY }]
          }
        ]}
      >
        {/* Drag Handle */}
        <TouchableOpacity
          style={styles.dragHandleContainer}
          onPress={toggleBanner}
        >
          <View style={styles.dragHandle} />
          <Text style={styles.dragHint}>
            {isExpanded ? '↓ Tap to hide' : '↑ Tap to show'}
          </Text>
        </TouchableOpacity>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.welcomeSubtitle}>Mapalengke</Text>
          <View style={styles.separator} />
          <Text style={styles.promptText}>What are you looking for?</Text>
          <Text style={styles.hintText}>Select Category/Product</Text>
        </View>

        {/* Category Buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryButtonsContainer}
          style={styles.categoryButtons}
        >
          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Fish')}>
            <Text style={styles.categoryButtonText}>Fish</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Meat')}>
            <Text style={styles.categoryButtonText}>Meat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Fruits & Vegetables')}>
            <Text style={styles.categoryButtonText}>Fruits & Vegetables</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Rice & Grain')}>
            <Text style={styles.categoryButtonText}>Rice & Grain</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Grocery')}>
            <Text style={styles.categoryButtonText}>Grocery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Dried Fish')}>
            <Text style={styles.categoryButtonText}>Dried Fish</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Eatery')}>
            <Text style={styles.categoryButtonText}>Eatery</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Search Bar removed as requested */}
      </Animated.View>

      {/* Hidden Banner Indicator */}
      {!isExpanded && (
        <TouchableOpacity
          style={styles.hiddenIndicator}
          onPress={toggleBanner}
        >
          <Text style={styles.hiddenIndicatorText}>↑</Text>
        </TouchableOpacity>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#2C2C2C',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },
  locationInfoBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationId: {
    fontSize: 12,
    color: '#666',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  greenBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginBottom: 8,
  },
  dragHint: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  separator: {
    width: '80%',
    height: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 15,
  },
  promptText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 5,
  },
  hintText: {
    fontSize: 14,
    color: '#E8F5E8',
    opacity: 0.8,
  },
  categoryButtons: {
    marginBottom: 25,
  },
  categoryButtonsContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  categoryButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#666666',
    flex: 1,
    fontWeight: '500',
  },
  hiddenIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  hiddenIndicatorText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  viewAllButton: {
    backgroundColor: '#2196F3',
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#666',
    padding: 5,
  },
  stallItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  stallNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stallName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default CustomerHome;