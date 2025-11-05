import React, { useEffect, useState, useCallback } from 'react';
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
  vendor_id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    description?: string;
    category_id: string;
    product_categories?: {
      id: string;
      name: string;
    }[];
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

  // Function to process raw database product into our Product type
  const processProducts = (rawProducts: any[]): Product[] => {
    return rawProducts.map(item => ({
      id: String(item.id),
      price: Number(item.price),
      uom: String(item.uom || ''),
      status: String(item.status),
      vendor_id: String(item.vendor_id),
      product_id: String(item.product_id),
      products: {
        id: String(item.products?.id || ''),
        name: String(item.products?.name || ''),
        description: item.products?.description,
        category_id: String(item.products?.category_id || ''),
        product_categories: item.products?.product_categories
      }
    }));
  };

  // Refresh data when returning to the dashboard
  const refreshData = useCallback(async () => {
    const localSession = SessionManager.getSession();
    if (!localSession?.vendorId) {
      console.log('No session for refresh');
      return;
    }

    try {
      const { data: freshData, error } = await supabase
        .from('vendor_products')
        .select(`
          id,
          price,
          uom,
          status,
          vendor_id,
          product_id,
          products (
            id,
            name,
            description,
            category_id,
            product_categories (
              id,
              name
            )
          )
        `)
  .eq('vendor_id', localSession.vendorId)
        .not('status', 'eq', 'deleted')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      const processedProducts = processProducts(freshData || []);
      setProducts(processedProducts);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
  const localSession = SessionManager.getSession();
  if (!localSession?.vendorId) return;

    // Subscribe to both vendor_products and products tables
    const subscription = supabase
      .channel('product_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_products',
          filter: `vendor_id=eq.${localSession.vendorId}`
        },
        async (payload) => {
          console.log('Vendor products update:', payload);
          if (payload.eventType === 'DELETE' || (payload.new as any)?.status === 'deleted') {
            // Remove the product from the local state
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setProducts(prev => prev.filter(p => p.id !== oldId));
            }
          } else {
            // For inserts and updates, refresh all data to ensure consistency
            await refreshData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        async (payload) => {
          console.log('Products update:', payload);
          // Refresh data when product details change
          await refreshData();
        }
      )
      .subscribe();

    // Initial data fetch
    refreshData();

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshData]);

  useEffect(() => {
  const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the current logged-in vendor from session
        const localSession = SessionManager.getSession();
        console.log('Dashboard session:', localSession);
        if (!localSession) {
          console.log('No session found in dashboard');
          setError('Please login to view dashboard');
          setLoading(false);
          return;
        }

        // Get the vendor profile using the vendor ID from session (since actual occupant shares same vendor profile)
        console.log('🔍 Dashboard: Fetching vendor data for ID:', localSession.vendorId);
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select(`
            *,
            market_sections (
              id,
              name
            )
          `)
            .eq('id', localSession.vendorId)
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
          // Add cache-busting parameter to ensure fresh image after upload
          const cacheBuster = `?v=${Date.now()}`;
          setProfileImage(vendorWithStall.profile_image_url + cacheBuster);
        } else {
          try {
            const local = await AsyncStorage.getItem(`vendor_avatar_${localSession.vendorId}`);
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
            id,
            price,
            uom,
            status,
            products (
              id,
              name,
              description
            )
          `)
          .eq('vendor_id', vendorData.id)
          .not('status', 'eq', 'deleted')
          .order('created_at', { ascending: false });

        if (productError) {
          setError('Failed to load products');
          setProducts([]);
        } else {
          console.log('Product data with status values:', productData);
          const processedProducts = processProducts(productData || []);
          setProducts(processedProducts);
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
            <Text style={styles.shopDetail}>Contact Number: 0{vendor.phone_number || '—'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('ShopProfile')}
          >
            <Text style={styles.profileBtnText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Product Summary Section styled like screenshot */}
      <View style={styles.productSummaryContainer}>
        <View style={styles.productSummaryHeader}>
          <Text style={styles.productSummaryTitle}>Product Summary</Text>
          <TouchableOpacity 
            style={styles.manageProductsButton}
            onPress={() => navigation.navigate('ProductManagement')}
          >
            <Text style={styles.manageProductsButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productSummaryCard}>
          {products.length === 0 ? (
            <Text style={styles.noProductsText}>No products found.</Text>
          ) : (
            products.map((product, index) => (
              <View key={product.id} style={[
                styles.productRow, 
                index === products.length - 1 && styles.productRowLast,
                (product.status === 'unavailable' || product.status === 'inactive') && styles.productRowUnavailable
              ]}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.products.name}</Text>
                  <Text style={styles.productPrice}>₱{product.price}/{product.uom || 'kg'}</Text>
                </View>
                <View style={[
                  styles.statusBadge, 
                  (product.status === 'available' || product.status === 'active') ? styles.statusActive : styles.statusInactive
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    (product.status === 'available' || product.status === 'active') ? styles.statusActiveText : styles.statusInactiveText
                  ]}>
                    {(product.status === 'available' || product.status === 'active') ? 'Available' : 'Unavailable'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Remove Product Summary and table for now, as per screenshot */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  greeting: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  vendorName: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#333333',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  shopCardCentered: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  productSummaryContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  productSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E5E5',
  },
  productSummaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.2,
  },
  manageProductsButton: {
    backgroundColor: '#333333',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  manageProductsButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  productSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productRowLast: {
    borderBottomWidth: 0,
  },
  productRowUnavailable: {
    opacity: 0.5,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 85,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  statusBadgeText: {
    fontWeight: '600',
    fontSize: 12,
  },
  statusActiveText: {
    color: '#059669',
  },
  statusInactiveText: {
    color: '#6B7280',
  },
  noProductsText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '500',
  },
  shopAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  shopAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  shopInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F2937',
    textAlign: 'center',
  },
  shopDetail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  profileBtn: {
    backgroundColor: '#333333',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  profileBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
});

export default VendorDashboardScreen;
