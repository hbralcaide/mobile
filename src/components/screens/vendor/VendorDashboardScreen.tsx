import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { SessionManager } from '../../../utils/sessionManager';
import { useIsFocused } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorDashboard'>;

interface VendorProfile {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  status: string;
  phone_number?: string;
  market_section_id?: string;
  stall?: {
    stall_number: string;
    location_description?: string;
  };
}

interface Product {
  id: string;
  price: number;
  uom: string;
  status: string;
  products: {
    name: string;
    description?: string;
  };
}

const VendorDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the current session to show logged-in user's name
  const session = SessionManager.getSession();
  const isFocused = useIsFocused();

  const handleLogout = () => {
    SessionManager.clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }]
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the current logged-in vendor from session
        const session = SessionManager.getSession();
        console.log('Dashboard session:', session);
        if (!session) {
          console.log('No session found in dashboard');
          setError('Please login to view dashboard');
          setLoading(false);
          return;
        }

        // Get the vendor profile using the vendor ID from session (since actual occupant shares same vendor profile)
        console.log('🔍 Dashboard: Fetching vendor data for ID:', session.vendorId);
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select(`
            *,
            market_sections (
              id,
              name
            )
          `)
          .eq('id', session.vendorId)
          .single();

        if (vendorError) {
          console.error('Vendor error:', vendorError);
          setError('Failed to load vendor info');
          setVendor(null);
          setProducts([]);
          setLoading(false);
          return;
        }

        console.log('✅ Dashboard: Vendor data fetched:', vendorData);
        console.log('📋 Dashboard: Business name is:', vendorData.business_name);

        // Fetch stall information separately
        let stallData = null;
        if (vendorData?.id) {
          const { data: stalls, error: stallError } = await supabase
            .from('stalls')
            .select('stall_number, location_description')
            .eq('vendor_profile_id', vendorData.id)
            .maybeSingle();

          console.log('Stall query result:', { stalls, stallError });
          stallData = stalls;
        }

        // Combine vendor and stall data
        const vendorWithStall = {
          ...vendorData,
          stall: stallData
        };

        console.log('Final vendor with stall:', vendorWithStall);
        setVendor(vendorWithStall);

        // try to set profile image: prefer remote URL from DB, fallback to local AsyncStorage
        if (vendorWithStall?.profile_image_url) {
          setProfileImage(vendorWithStall.profile_image_url);
        } else {
          try {
            const local = await AsyncStorage.getItem(`vendor_avatar_${session.vendorId}`);
            if (local) {
              // stored as base64 string (data without mime prefix) -> prefix it
              setProfileImage(`data:image/jpeg;base64,${local}`);
            }
          } catch (err) {
            console.warn('Failed to read local avatar', err);
          }
        }

        // Fetch products for this specific vendor
        const { data: productData, error: productError } = await supabase
          .from('vendor_products')
          .select(`
            *,
            products (
              name,
              description
            )
          `)
          .eq('vendor_id', vendorData.id)
          .order('created_at', { ascending: false });

        if (productError) {
          setError('Failed to load products');
          setProducts([]);
        } else {
          console.log('Product data with status values:', productData);
          setProducts(productData || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load dashboard data');
      }

      setLoading(false);
    };
    if (isFocused) fetchData();
  }, [isFocused]);

  // Stats
  const totalProducts = products.length;
  const availableProducts = products.filter(p => p.status === 'available' || p.status === 'active').length;
  const unavailableProducts = products.filter(p => p.status === 'unavailable' || p.status === 'inactive').length;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#22C55E" /></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }
  if (!vendor) {
    return <View style={styles.centered}><Text>No vendor profile found.</Text></View>;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.vendorName}>{session?.firstName} {session?.lastName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{totalProducts}</Text><Text style={styles.statLabel}>Total Products</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{availableProducts}</Text><Text style={styles.statLabel}>Available Products</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{unavailableProducts}</Text><Text style={styles.statLabel}>Unavailable Products</Text></View>
      </View>

      {/* Shop Profile Card (no Manage Products button) */}
      <View style={styles.shopCardCentered}>
        <View style={styles.shopCard}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.shopAvatarImage} />
          ) : (
            <View style={styles.shopAvatar} />
          )}
          <View style={styles.shopInfo}>
            <Text style={styles.shopName}>{vendor.business_name || 'Shop Name'}</Text>
            <Text style={styles.shopDetail}>Stall No.: {vendor.stall?.stall_number || '—'}</Text>
            <Text style={styles.shopDetail}>Location: Toril Public Market</Text>
            <Text style={styles.shopDetail}>Contact Number: {vendor.phone_number || '—'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('ShopProfile')}
          >
            <Text style={styles.profileBtnText}>Manage Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Product Summary Section styled like screenshot */}
      <View style={styles.productSummaryHeader}>
        <Text style={styles.productSummaryTitle}>Product Summary</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ProductManagement')}>
          <Text style={styles.manageProductsLink}>Manage Products</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.productSummaryCard}>
        {products.length === 0 ? (
          <Text style={styles.noProductsText}>No products found.</Text>
        ) : (
          products.map(product => (
            <View key={product.id} style={[styles.productRow, (product.status === 'unavailable' || product.status === 'inactive') && styles.productRowUnavailable]}>
              <Text style={styles.productName}>{product.products.name}</Text>
              <Text style={styles.productPrice}>₱{product.price}/{product.uom || 'kg'}</Text>
              <View style={[styles.statusBadge, (product.status === 'available' || product.status === 'active') ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusBadgeText}>{(product.status === 'available' || product.status === 'active') ? 'Available' : 'Unavailable'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Remove Product Summary and table for now, as per screenshot */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: '500',
  },
  // statusActive and statusInactive already exist above, so remove these duplicates
  scroll: {
    flex: 1,
    backgroundColor: '#22C55E',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  vendorName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#15803D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    width: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  statLabel: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  shopCardCentered: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  shopCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 320,
    position: 'relative',
  },
  productSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginHorizontal: 16,
  },
  productSummaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  manageProductsLink: {
    fontSize: 15,
    color: '#fff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  productSummaryCard: {
    backgroundColor: '#F3F3F3',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 16,
    elevation: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
  },
  productRowUnavailable: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  productName: {
    fontSize: 16,
    color: '#222',
    flex: 1,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 16,
    color: '#222',
    width: 80,
    textAlign: 'right',
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  statusActive: {
    backgroundColor: '#22C55E',
  },
  statusInactive: {
    backgroundColor: '#A3A3A3',
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  noProductsText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 12,
  },
  shopAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    marginBottom: 12,
  },
  shopAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  shopInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#222',
    textAlign: 'center',
  },
  shopDetail: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
    textAlign: 'center',
  },
  profileBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 8,
    elevation: 2,
  },
  profileBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
});

export default VendorDashboardScreen;
