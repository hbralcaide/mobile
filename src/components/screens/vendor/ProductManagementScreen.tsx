//Product Management screen


import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductManagement'>;

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  image_url?: string;
}

const ProductManagementScreen: React.FC<Props> = ({ navigation }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', price: '', category_id: '', uom: '', status: 'Available' });
  const [productInput, setProductInput] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  const [showProductNameDropdown, setShowProductNameDropdown] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentVendorProfile, setCurrentVendorProfile] = useState<any | null>(null);
  const uomOptions = ['kg', 'piece', 'pack'];
  const [saving, setSaving] = useState(false);

  // Predefined product names for fish category with prices
  const fishProductNames = [
    { name: 'Barracuda / Barakuda', price: '25' },
    { name: 'Croaker / Alakaak', price: '30' },
    { name: 'Emperor Snapper / Bitlya', price: '45' },
    { name: 'Espada Fish / Diwit', price: '35' },
    { name: 'Frigate Tuna / Tulingan', price: '40' },
    { name: 'Grouper / Lapu-Lapu', price: '55' },
    { name: 'Mackerel / Alumahan', price: '20' },
    { name: 'Milkfish / Bangus', price: '15' },
    { name: 'Pompano / Pampano', price: '50' },
    { name: 'Red Snapper / Maya-maya', price: '60' },
    { name: 'Sardines / Sardinas', price: '12' },
    { name: 'Tilapia / Tilapya', price: '18' },
    { name: 'Yellowfin Tuna / Tambakol', price: '65' }
  ];

  // Test network connectivity to Supabase
  const testConnection = async () => {
    try {
      console.log('Testing connection to Supabase...');
      const { data, error: connError } = await supabase.from('product_categories').select('count').limit(1);
      console.log('Connection test result:', { data, error: connError });
      return !connError;
    } catch (err) {
      console.error('Connection test failed:', err);
      return false;
    }
  };

  // Get current vendor profile
  const getCurrentVendorProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: vendorProfile, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select(`
          *,
          market_sections (
            name
          )
        `)
        .eq('auth_user_id', user.id)
        .single();

      if (vendorError) {
        console.error('Error fetching vendor profile:', vendorError);
        return null;
      }

      // Debug: Log the vendor profile data to see what we're getting
      console.log('Vendor Profile Data:', JSON.stringify(vendorProfile, null, 2));

      setCurrentVendorProfile(vendorProfile);
      return vendorProfile;
    } catch (err) {
      console.error('Error getting current vendor:', err);
      return null;
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Attempting to fetch vendor products from Supabase...');
      
      // Get current vendor profile first
      const vendorProfile = currentVendorProfile || await getCurrentVendorProfile();
      if (!vendorProfile) {
        setError('Unable to load vendor profile. Please login again.');
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data, error: prodError } = await supabase
        .from('vendor_products')
        .select(`
          *,
          products (
            name,
            description
          )
        `)
        .eq('vendor_id', vendorProfile.id)
        .order('created_at', { ascending: false });
        
      console.log('Supabase response:', { data, error: prodError, count: data?.length });
      
      if (prodError) {
        console.error('Supabase error details:', prodError);
        setError(`Failed to load products: ${prodError.message}`);
        setProducts([]);
      } else {
        console.log('Products fetched successfully:', data?.length || 0, 'items');
        setProducts(data || []);
        
        // Debug: Log each product
        if (data && data.length > 0) {
          console.log('Product details:');
          data.forEach((product, index) => {
            console.log(`${index + 1}:`, product.products?.name, '- Price:', product.price, '- Status:', product.status);
          });
        }
      }
    } catch (networkError) {
      console.error('Network error details:', networkError);
      setError('Network connection failed. Please check your internet connection.');
      setProducts([]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    const initialize = async () => {
      // Test connection first
      testConnection();
      // Load vendor profile and then products
      await getCurrentVendorProfile();
      await fetchProducts();
    };
    
    initialize();
    
    // Fetch categories from Supabase
    const fetchCategories = async () => {
      try {
        console.log('Fetching categories from product_categories table...');
        const { data, error: catError } = await supabase
          .from('product_categories')
          .select('*')
          .order('name', { ascending: true });
        if (!catError && data) {
          console.log('Categories fetched successfully:', data);
          setCategories(data);
        } else {
          console.error('Error fetching categories:', catError);
          setCategories([]);
        }
      } catch (networkError) {
        console.error('Network error fetching categories:', networkError);
        setCategories([]);
      }
    };
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditProduct(null);
    
    // Infer category from business name if no market section assigned
    const inferredCategory = currentVendorProfile?.business_name?.toLowerCase().includes('fish') ? 'Fish' : 'General';
    
    setForm({ 
      name: '', 
      price: '', 
      category_id: '', 
      uom: '', 
      status: 'Available' 
    });
    setCategoryInput(
      currentVendorProfile?.market_sections?.name || 
      currentVendorProfile?.category || 
      inferredCategory
    );
    setModalVisible(true);
  };

  const openEditModal = (vendorProduct: any) => {
    setEditProduct(vendorProduct);
    
    // Infer category from business name if no market section assigned
    const inferredCategory = currentVendorProfile?.business_name?.toLowerCase().includes('fish') ? 'Fish' : 'General';
    
    setForm({
      name: vendorProduct.products?.name || '',
      price: String(vendorProduct.price || ''),
      category_id: '',
      uom: vendorProduct.uom || '',
      status: vendorProduct.status === 'available' ? 'Available' : 'Unavailable'
    });
    setCategoryInput(
      currentVendorProfile?.market_sections?.name || 
      currentVendorProfile?.category || 
      inferredCategory
    );
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            console.log('Deleting vendor product with ID:', id);
            const result = await supabase.from('vendor_products').delete().eq('id', id);
            if (result.error) {
              console.error('Delete error:', result.error);
              Alert.alert('Error', 'Failed to delete product.');
            } else {
              console.log('Vendor product deleted successfully');
              Alert.alert('Success', 'Product deleted successfully!');
              await fetchProducts();
            }
          } catch (deleteError) {
            console.error('Unexpected delete error:', deleteError);
            Alert.alert('Error', 'An unexpected error occurred while deleting the product.');
          }
        }
      }
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.name || !form.price || !form.uom) {
        Alert.alert('Error', 'Product name, price, and unit of measurement are required.');
        setSaving(false);
        return;
      }
      
      // Get current vendor profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to manage products.');
        setSaving(false);
        return;
      }
      
      const { data: vendorProfile } = await supabase
        .from('vendor_profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      if (!vendorProfile) {
        Alert.alert('Error', 'Vendor profile not found. Please contact support.');
        setSaving(false);
        return;
      }
      
      // First, find or create the product in the products table
      let productId;
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('name', form.name)
        .single();
      
      if (existingProduct) {
        productId = existingProduct.id;
        console.log('Using existing product ID:', productId);
      } else {
        // Create new product in products table
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({ 
            name: form.name,
            description: `${form.name} - Fresh fish product`
          })
          .select('id')
          .single();
        
        if (productError || !newProduct) {
          console.error('Failed to create product:', productError);
          Alert.alert('Error', 'Failed to create product.');
          setSaving(false);
          return;
        }
        
        productId = newProduct.id;
        console.log('Created new product with ID:', productId);
      }
      
      // Now create or update the vendor_products record
      const vendorProductData = {
        product_id: productId,
        vendor_id: vendorProfile.id,
        price: Number(form.price),
        uom: form.uom,
        status: form.status === 'Available' ? 'available' : 'unavailable',
        visibility: true
      };
      
      console.log('Saving vendor product data:', vendorProductData);
      
      let result;
      if (editProduct) {
        console.log('Updating vendor product:', editProduct.id);
        result = await supabase
          .from('vendor_products')
          .update(vendorProductData)
          .eq('id', editProduct.id);
      } else {
        console.log('Inserting new vendor product');
        result = await supabase
          .from('vendor_products')
          .insert(vendorProductData);
      }
      
      console.log('Save result:', result);
      
      if (result.error) {
        console.error('Error saving vendor product:', result.error);
        Alert.alert('Error', `Failed to ${editProduct ? 'update' : 'create'} product: ${result.error.message}`);
      } else {
        Alert.alert('Success', `Product ${editProduct ? 'updated' : 'created'} successfully!`);
        setModalVisible(false);
        setCategoryInput('');
        setForm({ name: '', price: '', category_id: '', uom: '', status: 'Available' });
        // Refresh the product list
        await fetchProducts();
      }
    } catch (saveError) {
      console.error('Unexpected error saving product:', saveError);
      Alert.alert('Error', 'An unexpected error occurred while saving the product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#22C55E" /></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Product Management</Text>
      <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
        <Text style={styles.addBtnText}>+ Add Product</Text>
      </TouchableOpacity>
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.productRow, item.status === 'unavailable' && styles.productRowUnavailable]}>
            <Text style={styles.productName}>{item.products?.name}</Text>
            <Text style={styles.productPrice}>{item.price}/{item.uom || 'piece'}</Text>
            <Text style={[styles.statusBadge, item.status === 'available' ? styles.statusActive : styles.statusInactive]}>
              {item.status === 'available' ? 'Available' : 'Unavailable'}
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
              <Text style={styles.iconText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
              <Text style={styles.iconText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.noProducts}>No products found.</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchProducts}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchProducts}
      />

      {/* Modal for Add/Edit */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => {
            setShowProductNameDropdown(false);
            setShowUomDropdown(false);
          }}
        >
          <TouchableOpacity style={styles.modalCardCustom} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.modalTitleCustom}>{editProduct ? 'Edit Product' : 'Add New Product'}</Text>
            <View style={styles.imagePlaceholder} />
            
            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Category:</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>
                  {currentVendorProfile?.market_sections?.name || 
                   currentVendorProfile?.category || 
                   (currentVendorProfile?.business_name?.toLowerCase().includes('fish') ? 'Fish' : 'Pending Assignment')}
                </Text>
              </View>
            </View>
            
            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Product Name:</Text>
              <View style={styles.dropdownContainer}>
                <TextInput 
                  style={styles.inputVertical} 
                  placeholder="Select product name" 
                  value={form.name} 
                  onChangeText={text => {
                    setForm(f => ({ ...f, name: text }));
                    setShowProductNameDropdown(true);
                  }}
                  onFocus={() => setShowProductNameDropdown(true)}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {showProductNameDropdown && (
                  <View style={styles.dropdownMenuScrollable}>
                    <ScrollView 
                      style={styles.scrollableContainer}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {fishProductNames.filter(productItem => 
                        form.name.length === 0 || 
                        productItem.name.toLowerCase().includes(form.name.toLowerCase())
                      ).map((productItem, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.dropdownItem}
                          onPress={() => {
                            console.log('Selected product:', productItem.name, 'Price:', productItem.price);
                            setForm(f => ({ 
                              ...f, 
                              name: productItem.name,
                              price: productItem.price 
                            }));
                            setShowProductNameDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemText}>{productItem.name} - ₱{productItem.price}/kg</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Price:</Text>
              <View style={styles.priceRow}><Text style={styles.currency}>₱</Text>
                <TextInput style={styles.inputPrice} placeholder="Price" value={form.price} onChangeText={text => setForm(f => ({ ...f, price: text }))} keyboardType="numeric" /></View></View>
            <View style={styles.fieldRowVertical}><Text style={styles.fieldLabelVertical}>Unit of Measurement:</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={styles.inputVertical} 
                  onPress={() => setShowUomDropdown(!showUomDropdown)}
                >
                  <Text style={[styles.dropdownPlaceholder, form.uom && styles.dropdownSelected]}>
                    {form.uom || 'Select unit'}
                  </Text>
                </TouchableOpacity>
                {showUomDropdown && (
                  <View style={styles.dropdownMenu}>
                    {uomOptions.map(uom => (
                      <TouchableOpacity
                        key={uom}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setForm(f => ({ ...f, uom: uom }));
                          setShowUomDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{uom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View></View>
            <View style={styles.fieldRowVertical}><Text style={styles.fieldLabelVertical}>Availability:</Text>
              <View style={styles.dropdownBoxCustom}>
                {['Available', 'Unavailable'].map(status => (
                  <TouchableOpacity key={status} style={[styles.dropdownOptionCustom, form.status === status && styles.dropdownSelectedCustom]} onPress={() => setForm(f => ({ ...f, status }))}>
                    <Text style={form.status === status ? styles.dropdownSelectedTextCustom : styles.dropdownTextCustom}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View></View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.submitBtnText}>{saving ? 'Saving...' : 'Submit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtnCustom} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnTextCustom}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldRowVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 18,
    width: '100%',
  },
  fieldLabelVertical: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputVertical: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    width: '100%',
    color: '#222',
  },
  dropdownContainer: {
    width: '100%',
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    zIndex: 10,
    maxHeight: 160,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
  },
  dropdownMenuScrollable: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    zIndex: 10,
    maxHeight: 200,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
  },
  scrollableContainer: {
    maxHeight: 200,
    borderRadius: 12,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownSelected: {
    color: '#222',
  },
  dropdownListEnhanced: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    zIndex: 10,
    maxHeight: 160,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
  },
  dropdownListItemEnhanced: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
    backgroundColor: '#fff',
  },
  dropdownListItemSelected: {
    backgroundColor: '#22C55E',
    color: '#fff',
  },
  flex1: {
    flex: 1,
  },
  dropdownList: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    zIndex: 10,
    maxHeight: 140,
    elevation: 5,
  },
  dropdownListItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  dropdownListText: {
    fontSize: 15,
    color: '#222',
  },
  pickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    width: '100%',
    color: '#222',
  },
  modalCardCustom: {
    backgroundColor: '#fff',
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 32,
    width: '92%',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
  },
  modalTitleCustom: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  imagePlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
    marginBottom: 28,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
    justifyContent: 'flex-start',
  },
  fieldLabel: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: 'bold',
    width: 130,
    marginRight: 8,
    letterSpacing: 0.2,
  },
  inputCustom: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    flex: 1,
    color: '#222',
  },
  dropdownBoxCustom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dropdownOptionCustom: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 6,
    marginBottom: 4,
  },
  dropdownSelectedCustom: {
    backgroundColor: '#22C55E',
  },
  dropdownTextCustom: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dropdownSelectedTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currency: {
    fontSize: 18,
    color: '#178a50',
    marginRight: 6,
  },
  inputPrice: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    backgroundColor: '#fff',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 36,
    marginTop: 22,
    marginBottom: 10,
    alignSelf: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 19,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  cancelBtnCustom: {
    backgroundColor: '#A3A3A3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 36,
    alignSelf: 'center',
    marginBottom: 4,
    shadowColor: '#A3A3A3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
  },
  cancelBtnTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 16,
  },
  addBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  productRowUnavailable: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },
  productName: {
    fontSize: 16,
    color: '#222',
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    color: '#333',
    width: 80,
    textAlign: 'right',
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusActive: {
    backgroundColor: '#22C55E',
    color: '#fff',
  },
  statusInactive: {
    backgroundColor: '#A3A3A3',
    color: '#fff',
  },
  iconBtn: {
    marginLeft: 8,
    padding: 4,
  },
  iconText: {
    fontSize: 18,
  },
  noProducts: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  refreshBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  refreshBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusSelect: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    fontWeight: 'bold',
    fontSize: 15,
    backgroundColor: '#F3F3F3',
    color: '#333',
  },
  saveBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginRight: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelBtn: {
    backgroundColor: '#A3A3A3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  // ...existing code...
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  dropdownLabel: {
    fontSize: 15,
    color: '#22C55E',
    fontWeight: 'bold',
    marginRight: 8,
    width: 70,
  },
  dropdownBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dropdownOption: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 6,
    marginBottom: 4,
  },
  dropdownText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dropdownSelectedText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  readOnlyInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F8F9FA',
    width: '100%',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default ProductManagementScreen;
