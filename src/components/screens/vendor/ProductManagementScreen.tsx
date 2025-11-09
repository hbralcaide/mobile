//Product Management screen

import React, { useEffect, useState, useCallback } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { SessionManager } from '../../../utils/sessionManager';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductManagement'>;

/* Success Modal Component - matches ShopProfileScreen design */
const SuccessModal: React.FC<{ visible: boolean; onClose: () => void; title: string; message: string }> = ({ visible, onClose, title, message }) => {
  const IconSafe: React.FC<{ size?: number; style?: any }> = ({ size = 56, style }) => {
    return (
      <View style={[successModalStyles.iconWrapper, style]}>
        <View style={[successModalStyles.iconFallbackContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[successModalStyles.iconFallbackText, { fontSize: Math.round(size * 0.45) }]}>✓</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={successModalStyles.backdrop}>
        <View style={successModalStyles.card}>
          <IconSafe size={64} style={successModalStyles.icon} />
          <Text style={successModalStyles.title}>{title}</Text>
          <Text style={successModalStyles.message}>{message}</Text>
          <TouchableOpacity style={successModalStyles.okButton} onPress={onClose}>
            <Text style={successModalStyles.okText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/* Delete Confirmation Modal - black/white theme */
const DeleteConfirmModal: React.FC<{ 
  visible: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  productName: string;
}> = ({ visible, onClose, onConfirm, productName }) => {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={deleteModalStyles.backdrop}>
        <View style={deleteModalStyles.card}>
          <Text style={deleteModalStyles.title}>Delete Product</Text>
          <Text style={deleteModalStyles.message}>
            Are you sure you want to delete "{productName}"?
          </Text>
          <View style={deleteModalStyles.buttonRow}>
            <TouchableOpacity style={deleteModalStyles.cancelButton} onPress={onClose}>
              <Text style={deleteModalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={deleteModalStyles.deleteButton} onPress={onConfirm}>
              <Text style={deleteModalStyles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ProductManagementScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', price: '', category_id: '', uom: '', status: 'Available' });
  const [activeTab, setActiveTab] = useState<'available' | 'unavailable'>('available');
  const [showProductNameDropdown, setShowProductNameDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentVendorProfile, setCurrentVendorProfile] = useState<any | null>(null);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const uomOptions = ['kg', 'piece', 'pack', 'liter', 'box', 'bottle'];
  const [saving, setSaving] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [successModal, setSuccessModal] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });

  // Helper function to get vendor's market section category
  const getVendorCategory = useCallback(() => {
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
  }, [currentVendorProfile]);

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
  const getAutoCategoryId = useCallback(() => {
    const vendorSection = getVendorCategory().toLowerCase();
    
    if (vendorSection.includes('grocery')) {
      const groceryCategory = categories.find(category => 
        category.name.toLowerCase().includes('grocery')
      );
      return groceryCategory?.id || null;
    }
    
    return null;
  }, [categories, getVendorCategory]);

  // Helper function to get filtered products based on selected category
  // Excludes products that are already added to vendor's product list
  const getFilteredProducts = useCallback(() => {
    if (!form.category_id) {
      return [];
    }

    // Get list of product IDs that are already added
    const existingProductIds = products.map(p => p.product_id);

    // Filter by category and exclude already added products
    return availableProducts.filter(product => 
      product.category_id === form.category_id && 
      !existingProductIds.includes(product.id)
    );
  }, [form.category_id, availableProducts, products]);

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
      
      // If vendor has a default category, auto-select it
      if (vendorData?.default_category_id && !form.category_id) {
        setForm(prev => ({ ...prev, category_id: vendorData.default_category_id }));
      }
      
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
        const { data, error: supabaseError } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        if (supabaseError) {
          console.error('Error fetching all products:', supabaseError);
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
  // Show product dropdown when category is selected
  useEffect(() => {
    if (form.category_id) {
      const filteredProducts = getFilteredProducts();
      if (filteredProducts.length > 0 && !editProduct) {
        setShowProductNameDropdown(true);
      }
    }
  }, [form.category_id, availableProducts, editProduct, getFilteredProducts]);

  useEffect(() => {
    if (currentVendorProfile && categories.length > 0 && !form.category_id) {
      // Use default_category_id from profile first, fallback to auto-detection
      const categoryId = currentVendorProfile.default_category_id || getAutoCategoryId();
      if (categoryId) {
        setForm(prev => ({ ...prev, category_id: categoryId }));
      }
    }
  }, [currentVendorProfile, categories, form.category_id, getAutoCategoryId]);

  const openAddModal = () => {
    setEditProduct(null);
    
    // Use default_category_id from vendor profile if available
    const defaultCategoryId = currentVendorProfile?.default_category_id || getAutoCategoryId();

    setForm({
      name: '',
      price: '',
      category_id: defaultCategoryId || '',
      uom: '',
      status: 'Available'
    });
    setShowProductNameDropdown(false);
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
    setShowProductNameDropdown(false);
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
          closeModal();
          setSuccessModal({ visible: true, title: 'Success', message: 'Product updated successfully' });
        }
      } else {
        // Check if product already exists
        const { data: existingProduct } = await supabase
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
          closeModal();
          fetchProducts();
          setSuccessModal({ visible: true, title: 'Success', message: 'Product added successfully' });
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }

    setSaving(false);
  };

  const [_deletingId, setDeletingId] = useState<string | null>(null);
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

    setDeleteTarget(vendorProduct);
    setConfirmDeleteVisible(true);
  };

  const performDelete = async () => {
    if (!deleteTarget?.id) {
      setConfirmDeleteVisible(false);
      return;
    }
    setDeletingId(deleteTarget.id);
    try {
      const session = SessionManager.getSession();
      if (!session?.vendorId) {
        setDeletingId(null);
        setConfirmDeleteVisible(false);
        Alert.alert('Error', 'Please login again to delete products');
        return;
      }

      const { error: supabaseError } = await supabase
        .from('vendor_products')
        .delete()
        .match({ id: deleteTarget.id, vendor_id: session.vendorId });

      if (supabaseError) {
        console.error('Delete error:', supabaseError);
        setConfirmDeleteVisible(false);
        Alert.alert('Error', 'Failed to delete product');
      } else {
        setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
        setConfirmDeleteVisible(false);
        setSuccessModal({ visible: true, title: 'Success', message: 'Product deleted successfully' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setConfirmDeleteVisible(false);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
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

  // Counts for tabs
  const availableCount = products.filter(p => (p.status || '').toLowerCase() === 'available').length;
  const unavailableCount = products.filter(p => (p.status || '').toLowerCase() === 'unavailable').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Product Management</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ Add Product</Text>
        </TouchableOpacity>

      {/* Tabs: Available | Unavailable */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'available' && styles.tabButtonActive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'available' ? styles.tabTextActive : styles.tabTextInactive,
          ]}>Available ({availableCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'unavailable' && styles.tabButtonActive]}
          onPress={() => setActiveTab('unavailable')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'unavailable' ? styles.tabTextActive : styles.tabTextInactive,
          ]}>Unavailable ({unavailableCount})</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={products.filter(p => {
          const status = (p.status || '').toLowerCase();
          return activeTab === 'available' ? status === 'available' : status === 'unavailable';
        })}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.rightAction}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.rightActionText}>Delete</Text>
              </TouchableOpacity>
            )}
            onSwipeableOpen={() => handleDelete(item)}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openEditModal(item)}
              style={[styles.productRow, item.status === 'unavailable' && styles.productRowUnavailable]}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.products?.name}</Text>
                <Text style={styles.productCategory} numberOfLines={1} ellipsizeMode="tail">
                  {item.products?.product_categories?.name || 'No Category'}
                </Text>
              </View>
              <Text style={styles.productPrice}>{item.price}/{item.uom || 'piece'}</Text>
              <View
                style={[
                  styles.statusDot,
                  ((item.status || '').toLowerCase() === 'available')
                    ? styles.statusDotAvailable
                    : styles.statusDotUnavailable,
                ]}
              />
            </TouchableOpacity>
          </Swipeable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.noProducts}>
              {activeTab === 'available' ? 'No available products.' : 'No unavailable products.'}
            </Text>
          </View>
        }
      />
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowUomDropdown(false);
            setShowCategoryDropdown(false);
            setShowProductNameDropdown(false);
            setModalVisible(false);
          }}
        >
          <TouchableOpacity style={styles.modalCardCustom} activeOpacity={1} onPress={() => { }}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitleCustom}>{editProduct ? 'Edit Product' : 'Add New Product'}</Text>

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
                  style={styles.inputVertical}
                  value={form.name}
                  onChangeText={text => {
                    setForm(f => ({ ...f, name: text }));
                    if (form.category_id) {
                      setShowProductNameDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (form.category_id) {
                      setShowProductNameDropdown(true);
                    } else {
                      Alert.alert('Notice', 'Please select a product category first');
                    }
                  }}
                  placeholder="Type or select product"
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
                      {getFilteredProducts().filter((productItem: any) =>
                        form.name.length === 0 || productItem.name.toLowerCase().includes(form.name.toLowerCase())
                      ).map((productItem: any, index: number) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.dropdownItem}
                          onPress={() => {
                            const price = productItem.base_price || productItem.price || productItem.basePrice || '';
                            const unit = productItem.unit || productItem.uom || 'piece';
                            
                            setForm(f => ({
                              ...f,
                              name: productItem.name,
                              price: price.toString(),
                              uom: unit
                            }));
                            setShowProductNameDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemText}>
                            {productItem.name}
                            {(productItem.base_price || productItem.price || productItem.basePrice) &&
                              ` - ₱${productItem.base_price || productItem.price || productItem.basePrice}/${productItem.unit || productItem.uom || 'piece'}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
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
                  <View style={styles.dropdownMenuScrollable}>
                    <ScrollView
                      style={styles.scrollableContainer}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
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
                    </ScrollView>
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
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.submitBtnText}>{saving ? 'Saving...' : (editProduct ? 'Save' : 'Add')}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal - black/white theme */}
      <DeleteConfirmModal
        visible={confirmDeleteVisible}
        onClose={() => setConfirmDeleteVisible(false)}
        onConfirm={performDelete}
        productName={deleteTarget?.products?.name || ''}
      />

      {/* Success Modal - matches ShopProfileScreen design */}
      <SuccessModal
        visible={successModal.visible}
        onClose={() => setSuccessModal({ visible: false, title: '', message: '' })}
        title={successModal.title}
        message={successModal.message}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 15,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 16,
    alignSelf: 'center',
  },
  addBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  productRow: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  productRowUnavailable: {
    opacity: 0.5,
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
    flexShrink: 1,
  },
  productCategory: {
    fontSize: 12,
    color: '#6B7280',
    flexShrink: 1,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotAvailable: {
    backgroundColor: '#22C55E',
  },
  statusDotUnavailable: {
    backgroundColor: '#9CA3AF',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  iconText: {
    fontSize: 16,
  },
  rightAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginVertical: 4,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  rightActionText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProducts: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#333333',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalCardCustom: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalTitleCustom: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  imagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldRowVertical: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 10,
    minWidth: 50,
  },
  fieldLabelVertical: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  marketSectionText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currency: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 6,
  },
  inputPrice: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  inputVertical: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    width: '100%',
    color: '#1F2937',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.6,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 180,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 5,
  },
  dropdownMenuScrollable: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 180,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 5,
  },
  scrollableContainer: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownSelected: {
    color: '#1F2937',
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  availabilityBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  availabilityBtnActive: {
    borderColor: '#333333',
    backgroundColor: '#F5F5F5',
  },
  availabilityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  availabilityBtnTextActive: {
    color: '#1F2937',
  },
  modalButtons: {
    marginTop: 20,
    gap: 10,
    flexDirection: 'row',
  },
  submitBtn: {
    backgroundColor: '#333333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogCard: {
    borderRadius: 12,
  },
  dialogTitle: {
    color: '#1F2937',
    fontWeight: '700',
    fontSize: 17,
  },
  dialogMessage: {
    color: '#4B5563',
    fontSize: 14,
  },
  dialogActions: {
    gap: 8,
  },
  dialogBtn: {
    borderRadius: 8,
  },
});

/* Delete Modal Styles - black/white theme */
const deleteModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: 300,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    color: '#1F2937',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  cancelText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

/* Success Modal Styles - matches ShopProfileScreen design */
const successModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: 300,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: '#22C55E',
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  okButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 140,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  okText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackContainer: {
    position: 'absolute',
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default ProductManagementScreen;