import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Animated,
  ScrollView,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import IndoorMarketMap from './MarketMapScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Market'>;

interface CustomerHomeProps extends Props {
  onLogout?: () => void;
}

const CustomerHome: React.FC<CustomerHomeProps> = ({ navigation, onLogout }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMeatModal, setShowMeatModal] = useState(false);

  const handleStallPress = (stall: any) => {
    Alert.alert('Stall Selected', `You selected stall: ${stall?.name || 'Unknown'}`);
  };

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
    navigation.navigate('VendorsByCategory', { category });
  };



  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2C2C2C" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Toril Public Market</Text>
        {onLogout && (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content - Indoor Map */}
      <View style={styles.mainContent}>
        <IndoorMarketMap
          onStallPress={handleStallPress}
          selectedStallId={undefined}
        />
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

          <TouchableOpacity style={styles.categoryButton} onPress={() => setShowMeatModal(true)}>
            <Text style={styles.categoryButtonText}>Meat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryButton} onPress={() => handleCategoryPress('Vegetables & Fruits')}>
            <Text style={styles.categoryButtonText}>Vegetables & Fruits</Text>
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
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search Product or Category</Text>
        </View>
      </Animated.View>

      {/* Meat Subcategory Modal */}
      <Modal visible={showMeatModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMeatModal(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>Meat Categories</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setShowMeatModal(false); handleCategoryPress('Meat'); }}>
              <Text style={styles.modalItemText}>All Meat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setShowMeatModal(false); handleCategoryPress('Pork'); }}>
              <Text style={styles.modalItemText}>Pork</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setShowMeatModal(false); handleCategoryPress('Beef'); }}>
              <Text style={styles.modalItemText}>Beef</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setShowMeatModal(false); handleCategoryPress('Chicken'); }}>
              <Text style={styles.modalItemText}>Chicken</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  // Modal styles for Meat subcategories
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
});

export default CustomerHome;