import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

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
  name: string;
  base_price: number;
  uom: string;
  status: string;
}

const VendorDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please login to view dashboard');
          setLoading(false);
          return;
        }

        // Fetch current vendor profile with stall information
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (vendorError) {
          console.error('Vendor error:', vendorError);
          setError('Failed to load vendor info');
          setVendor(null);
          setProducts([]);
          setLoading(false);
          return;
        }

        console.log('Vendor data:', vendorData);

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

        // Fetch products for this specific vendor
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_profile_id', vendorData.id)
          .order('name', { ascending: true });

        if (productError) {
          setError('Failed to load products');
          setProducts([]);
        } else {
          setProducts(productData || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load dashboard data');
      }
      
      setLoading(false);
    };
    fetchData();
  }, []);

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'Active').length;
  const inactiveProducts = products.filter(p => p.status !== 'Active').length;

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
        <Text style={styles.greeting}>Good Morning,</Text>
        <Text style={styles.vendorName}>{vendor.first_name} {vendor.last_name}</Text>
  <TouchableOpacity style={styles.menuIcon}><Text style={styles.menuIconText}>≡</Text></TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{totalProducts}</Text><Text style={styles.statLabel}>Total Products</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{activeProducts}</Text><Text style={styles.statLabel}>Active Products</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{inactiveProducts}</Text><Text style={styles.statLabel}>Inactive Products</Text></View>
      </View>

      {/* Shop Profile Card (no Manage Products button) */}
      <View style={styles.shopCardCentered}>
        <View style={styles.shopCard}>
          <View style={styles.shopAvatar} />
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
            <View key={product.id} style={styles.productRow}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{product.base_price}/{product.uom || 'kg'}</Text>
              <View style={[styles.statusBadge, product.status === 'Active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusBadgeText}>{product.status === 'Active' ? 'Active' : 'Inactive'}</Text>
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
  menuIconText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
  menuIcon: {
    padding: 8,
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
