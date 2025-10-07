//Product Management screen

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { SessionManager } from '../../../utils/sessionManager';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductManagement'>;

const ProductManagementScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', price: '', category_id: '', uom: '', status: 'Available' });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentVendorProfile, setCurrentVendorProfile] = useState<any | null>(null);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const uomOptions = ['kg', 'piece', 'pack', 'liter', 'box', 'bottle'];
  const [saving, setSaving] = useState(false);

  // Helper function to get vendor's market section category
  const getVendorCategory = () => {
    if (currentVendorProfile?.market_sections?.name) {
      return currentVendorProfile.market_sections.name;
    }
    if (currentVendorProfile?.category) {
      return currentVendorProfile.category;
    }
    
    const businessName = currentVendorProfile?.business_name?.toLowerCase() || '';
    if (businessName.includes('fish') || businessName.includes('isda')) return 'Fish';
    if (businessName.includes('meat') || businessName.includes('karne')) return 'Meat';
    if (businessName.includes('vegetable') || businessName.includes('gulay')) return 'Vegetables';
    if (businessName.includes('fruit') || businessName.includes('prutas')) return 'Fruits';
    if (businessName.includes('grocery')) return 'Grocery';
    
    return 'General';
  };

  // Helper function to get filtered product categories based on vendor's market section
  const getFilteredCategories = () => {
    const vendorSection = getVendorCategory().toLowerCase();
    
    if (vendorSection.includes('grocery')) {
      return categories.filter(category => 
        category.name.toLowerCase().includes('grocery')
      );
    }
    
    return categories.filter(category => {
      const categoryName = category.name.toLowerCase();
      
      if (vendorSection.includes('meat') || vendorSection.includes('karne')) {
        return categoryName.includes('beef') || 
               categoryName.includes('chicken') || 
               categoryName.includes('pork');
      }
      
      if (vendorSection.includes('fish') || vendorSection.includes('isda')) {
        return categoryName.includes('fish') || 
               categoryName.includes('isda') ||
               categoryName.includes('seafood');
      }
      
      if (vendorSection.includes('vegetable') || vendorSection.includes('gulay')) {
        return categoryName.includes('vegetable') || 
               categoryName.includes('gulay') ||
               categoryName.includes('leafy') ||
               categoryName.includes('root');
      }
      
      if (vendorSection.includes('fruit') || vendorSection.includes('prutas')) {
        return categoryName.includes('fruit') || 
               categoryName.includes('prutas') ||
               categoryName.includes('citrus') ||
               categoryName.includes('tropical');
      }
      
      return true;
    });
  };

  // Helper function to get the appropriate category ID for the vendor's market section
  const getAutoCategoryId = () => {
    const vendorSection = getVendorCategory().toLowerCase();
    
    if (vendorSection.includes('grocery')) {
      const groceryCategory = categories.find(category => 
        category.name.toLowerCase().includes('grocery')
      );
      return groceryCategory?.id || null;
    }
    
    return null;
  };

  // Helper function to get filtered products based on selected category
  const getFilteredProducts = () => {
    if (!form.category_id) {
      return [];
    }

    return availableProducts.filter(product => product.category_id === form.category_id);
  };

  // Get current vendor profile
  const getCurrentVendorProfile = async () => {
    try {
      const session = SessionManager.getSession();
      if (!session) {
        Alert.alert('Error', 'Please login to manage products');
        return;
      }

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
        console.error('Error fetching vendor profile:', vendorError);
        return null;
      }

      setCurrentVendorProfile(vendorData);
      return vendorData;
    } catch (err) {
      console.error('Error getting current vendor:', err);
      return null;
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    console.log('Fetching products...');

    try {
      const session = SessionManager.getSession();
      if (!session?.vendorId) {
        console.error('No vendor ID in session');
        setError('Please login again to manage products.');
        setProducts([]);
        setLoading(false);
        return;
      }

      // Clear any stale data first
      setProducts([]);

      console.log('Fetching with vendor ID:', session.vendorId);
      const { data, error: prodError } = await supabase
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
        .eq('vendor_id', session.vendorId)
        .order('created_at', { ascending: false });

      if (prodError) {
        console.error('Supabase error details:', prodError);
        setError(`Failed to load products: ${prodError.message}`);
        setProducts([]);
      } else {
        console.log('Products fetched successfully:', data?.length || 0, 'items');
        console.log('Product data:', data);
        setProducts(data || []);
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
      await getCurrentVendorProfile();
      await fetchProducts();
    };

    initialize();

    // Fetch categories from Supabase
    const fetchCategories = async () => {
      try {
        const { data, error: catError } = await supabase
          .from('product_categories')
          .select('*')
          .order('name', { ascending: true });
        if (!catError && data) {
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
  }, []);

  // Fetch all products when component loads
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching all products:', error);
          setAvailableProducts([]);
        } else {
          console.log('Products fetched:', data?.length || 0);
          setAvailableProducts(data || []);
        }
      } catch (err) {
        console.error('Network error fetching all products:', err);
        setAvailableProducts([]);
      }
    };

    fetchAllProducts();
  }, []);



  // Auto-set category based on vendor's market section
  useEffect(() => {
    if (currentVendorProfile && categories.length > 0 && !form.category_id) {
      const autoCategoryId = getAutoCategoryId();
      if (autoCategoryId) {
        setForm(prev => ({ ...prev, category_id: autoCategoryId }));
      }
    }
  }, [currentVendorProfile, categories, form.category_id]);

  const openAddModal = () => {
    setEditProduct(null);
    const autoCategoryId = getAutoCategoryId();

    setForm({
      name: '',
      price: '',
      category_id: autoCategoryId || '',
      uom: '',
      status: 'Available'
    });
    setShowUomDropdown(false);
    setShowCategoryDropdown(false);
    setModalVisible(true);
  };

  const openEditModal = (vendorProduct: any) => {
    console.log('Opening edit modal for product:', vendorProduct);
    setEditProduct(vendorProduct);

    // Capitalize the first letter of status
    const formattedStatus = vendorProduct.status 
      ? vendorProduct.status.charAt(0).toUpperCase() + vendorProduct.status.slice(1) 
      : 'Available';

    setForm({
      name: vendorProduct.products?.name || '',
      price: vendorProduct.price?.toString() || '',
      category_id: vendorProduct.products?.category_id || '',
      uom: vendorProduct.uom || '',
      status: formattedStatus
    });

    setShowUomDropdown(false);
    setShowCategoryDropdown(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditProduct(null);
    setForm({ name: '', price: '', category_id: '', uom: '', status: 'Available' });
    setShowUomDropdown(false);
    setShowCategoryDropdown(false);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim() || !form.category_id) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    console.log('Saving product with form data:', form);
    console.log('Edit product data:', editProduct);

    try {
      const vendorProfile = currentVendorProfile || await getCurrentVendorProfile();
      if (!vendorProfile) {
        Alert.alert('Error', 'Unable to load vendor profile');
        setSaving(false);
        return;
      }

      if (editProduct) {
        // Update existing product
        console.log('Updating product with ID:', editProduct.id, 'with data:', {
          price: form.price,
          uom: form.uom,
          status: form.status.toLowerCase()
        });

        // First verify the product exists and belongs to the vendor
        const { data: checkProduct, error: checkError } = await supabase
          .from('vendor_products')
          .select('id')
          .eq('id', editProduct.id)
          .eq('vendor_id', vendorProfile.id)
          .single();

        if (!checkProduct) {
          console.error('Product not found or not owned by vendor:', checkError);
          Alert.alert('Error', 'Product not found or you do not have permission to edit it');
          setSaving(false);
          return;
        }

        const { data: updateData, error: updateError } = await supabase
          .from('vendor_products')
          .update({
            price: form.price,
            uom: form.uom,
            status: form.status.toLowerCase()
          })
          .eq('id', editProduct.id)
          .eq('vendor_id', vendorProfile.id)
          .select();

        console.log('Update response:', { updateData, updateError });
        if (updateError) {
          console.error('Update error:', updateError);
          Alert.alert('Error', 'Failed to update product');
        } else {
          // Immediately update the UI
          setProducts(prevProducts =>
            prevProducts.map(p =>
              p.id === editProduct.id
                ? {
                    ...p,
                    price: form.price,
                    uom: form.uom,
                    status: form.status.toLowerCase()
                  }
                : p
            )
          );
          
          // Show success message and close modal
          Alert.alert('Success', 'Product updated successfully');
          closeModal();
        }
      } else {
        // Check if product already exists
        const { data: existingProduct, error: findError } = await supabase
          .from('products')
          .select('id')
          .eq('name', form.name)
          .eq('category_id', form.category_id)
          .single();

        let productId;

        if (existingProduct) {
          // Product exists, use its ID
          productId = existingProduct.id;
          console.log('Using existing product ID:', productId);
        } else {
          // Create new product
          const { data: productData, error: insertError } = await supabase
            .from('products')
            .insert({
              name: form.name,
              description: '',
              category_id: form.category_id
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            Alert.alert('Error', 'Failed to create product');
            setSaving(false);
            return;
          }
          productId = productData.id;
          console.log('Created new product ID:', productId);
        }

        // Check current user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('Current authenticated user:', user);
        console.log('Auth error:', authError);
        
        // Create vendor product entry
        console.log('Creating vendor product with data:', {
          vendor_id: vendorProfile.id,
          product_id: productId,
          price: form.price,
          uom: form.uom,
          status: form.status.toLowerCase()
        });
        
        const { error: vendorProductError } = await supabase
          .from('vendor_products')
          .insert({
            vendor_id: vendorProfile.id,
            product_id: productId,
            price: form.price,
            uom: form.uom,
            status: form.status.toLowerCase()
          });

        if (vendorProductError) {
          console.error('Vendor product error:', vendorProductError);
          Alert.alert('Error', 'Failed to add product to vendor');
        } else {
          Alert.alert('Success', 'Product added successfully');
          closeModal();
          fetchProducts();
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }

    setSaving(false);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = (vendorProduct: any) => {
    if (!vendorProduct?.id) {
      console.error('Invalid product data:', vendorProduct);
      Alert.alert('Error', 'Cannot delete: Invalid product data');
      return;
    }

    console.log('Attempting to delete product:', {
      id: vendorProduct.id,
      name: vendorProduct.products?.name,
      vendor_id: vendorProduct.vendor_id
    });
    
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${vendorProduct.products?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(vendorProduct.id);
            try {
              const session = SessionManager.getSession();
              if (!session?.vendorId) {
                setDeletingId(null);
                Alert.alert('Error', 'Please login again to delete products');
                return;
              }

              // Delete the vendor product
              const { error } = await supabase
                .from('vendor_products')
                .delete()
                .match({ 
                  id: vendorProduct.id,
                  vendor_id: session.vendorId 
                });

              console.log('Delete response:', { error });
              if (error) {
                console.error('Delete error:', error);
                Alert.alert('Error', 'Failed to delete product');
              } else {
                // First update UI
                setProducts(prevProducts => 
                  prevProducts.filter(p => p.id !== vendorProduct.id)
                );

                // Update the UI and show success message
                Alert.alert('Success', 'Product deleted successfully');
                
                // Remove from local state immediately
                setProducts(prevProducts => {
                  const filtered = prevProducts.filter(p => p.id !== vendorProduct.id);
                  return filtered;
                });
                
                // Clear the deleting state
                setDeletingId(null);
              }
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchProducts}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
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
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.products?.name}</Text>
              <Text style={styles.productCategory}>
                {item.products?.product_categories?.name || 'No Category'}
              </Text>
            </View>
            <Text style={styles.productPrice}>{item.price}/{item.uom || 'piece'}</Text>
            <Text style={[styles.statusBadge, item.status === 'available' ? styles.statusActive : styles.statusInactive]}>
              {item.status === 'available' ? 'Available' : 'Unavailable'}
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
              <Text style={styles.iconText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleDelete(item)}
              disabled={deletingId === item.id}
            >
              <Text style={styles.iconText}>
                {deletingId === item.id ? '⏳' : '🗑️'}
              </Text>
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

      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowUomDropdown(false);
            setShowCategoryDropdown(false);
            setModalVisible(false);
          }}
        >
          <TouchableOpacity style={styles.modalCardCustom} activeOpacity={1} onPress={() => { }}>
            <Text style={styles.modalTitleCustom}>{editProduct ? 'Edit Product' : 'Add New Product'}</Text>
            <View style={styles.imagePlaceholder} />

            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Product Category:</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={[styles.inputVertical, getVendorCategory().toLowerCase().includes('grocery') && styles.inputDisabled]}
                  onPress={() => {
                    if (!getVendorCategory().toLowerCase().includes('grocery')) {
                      setShowCategoryDropdown(!showCategoryDropdown);
                    }
                  }}
                >
                  <Text style={[styles.dropdownPlaceholder, form.category_id && styles.dropdownSelected]}>
                    {form.category_id ? 
                      categories.find(cat => cat.id === form.category_id)?.name || 'Select category' : 
                      'Select category'
                    }
                  </Text>
                </TouchableOpacity>
                {showCategoryDropdown && (
                  <View style={styles.dropdownMenu}>
                    <ScrollView
                      style={styles.scrollableContainer}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {getFilteredCategories().map((category, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setForm(f => ({
                              ...f,
                              category_id: category.id,
                              name: '',
                              price: '',
                              uom: ''
                            }));
                            setShowCategoryDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemText}>{category.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <Text style={styles.marketSectionText}>Market Section: {getVendorCategory()}</Text>
            </View>

            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Product Name:</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={[styles.inputVertical, editProduct && styles.inputDisabled]}
                  value={form.name}
                  editable={false}
                  placeholder="Product name"
                  autoCorrect={false}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Price:</Text>
              <View style={styles.priceRow}>
                <Text style={styles.currency}>₱</Text>
                <TextInput 
                  style={styles.inputPrice} 
                  placeholder="Auto-filled from database" 
                  value={form.price} 
                  onChangeText={text => setForm(f => ({ ...f, price: text }))} 
                  keyboardType="numeric" 
                />
              </View>
            </View>

            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Unit of Measurement:</Text>
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
                    {uomOptions.map((uom, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setForm(f => ({ ...f, uom }));
                          setShowUomDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropdownItemText}>{uom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldRowVertical}>
              <Text style={styles.fieldLabelVertical}>Availability:</Text>
              <View style={styles.availabilityRow}>
                <TouchableOpacity
                  style={[styles.availabilityBtn, form.status === 'Available' && styles.availabilityBtnActive]}
                  onPress={() => setForm(f => ({ ...f, status: 'Available' }))}
                >
                  <Text style={[styles.availabilityBtnText, form.status === 'Available' && styles.availabilityBtnTextActive]}>Available</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.availabilityBtn, form.status === 'Unavailable' && styles.availabilityBtnActive]}
                  onPress={() => setForm(f => ({ ...f, status: 'Unavailable' }))}
                >
                  <Text style={[styles.availabilityBtnText, form.status === 'Unavailable' && styles.availabilityBtnTextActive]}>Unavailable</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.submitBtnText}>{saving ? 'Saving...' : 'Submit'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'center',
  },
  addBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  productRow: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productRowUnavailable: {
    opacity: 0.6,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748B',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 12,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 8,
  },
  iconText: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProducts: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  refreshBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardCustom: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitleCustom: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fieldRowVertical: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 12,
    minWidth: 60,
  },
  fieldLabelVertical: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  marketSectionText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginRight: 8,
  },
  inputPrice: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#222',
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
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.7,
  },
  dropdownContainer: {
    width: '100%',
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownMenuScrollable: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollableContainer: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownSelected: {
    color: '#374151',
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  availabilityBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  availabilityBtnActive: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  availabilityBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  availabilityBtnTextActive: {
    color: '#22C55E',
  },
  modalButtons: {
    marginTop: 24,
    gap: 12,
  },
  submitBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductManagementScreen;