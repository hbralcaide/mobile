import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useShoppingList } from '../../../context/ShoppingListContext';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'ShoppingList'>;

interface ProductCategory {
  id: string;
  name: string;
}

interface ProductSearchResult {
  id: string;
  name: string;
  category_id: string;
  product_categories?: {
    id: string;
    name: string;
  };
  vendor_products: Array<{
    id: string;
    price: number;
    uom: string;
    vendor_profiles: {
      id: string;
      business_name: string;
      first_name: string;
      last_name: string;
      stall_number: string;
    };
  }>;
}

type SortOption = 'default' | 'price-low' | 'price-high' | 'stall';

const ShoppingListScreen: React.FC<Props> = ({ navigation }) => {
  const { items, addItem, removeItem, toggleDone, clearList, getUniqueStalls } = useShoppingList();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Color mapping based on map section colors
  const getCategoryColor = (categoryName?: string): string => {
    if (!categoryName) return '#4CAF50';
    const colorMap: { [key: string]: string } = {
      'fish': '#00BCD4',
      'seafood': '#00BCD4',
      'fruits': '#4CAF50',
      'vegetables': '#4CAF50',
      'fruits & vegetables': '#4CAF50',
      'dried fish': '#FF9800',
      'grocery': '#2196F3',
      'rice': '#FFC107',
      'grain': '#FFC107',
      'rice & grain': '#FFC107',
      'variety': '#9C27B0',
      'meat': '#F44336',
      'pork': '#F44336',
      'beef': '#F44336',
      'chicken': '#F44336',
      'poultry': '#F44336',
      'eatery': '#FF6B6B',
    };
    const key = categoryName.toLowerCase();
    return colorMap[key] || '#4CAF50';
  };

  // Category emoji mapping
  const getCategoryEmoji = (categoryName?: string): string => {
    if (!categoryName) return '📦';
    const emojiMap: { [key: string]: string } = {
      'meat': '🥩',
      'fish': '🐟',
      'seafood': '🦐',
      'vegetables': '🥬',
      'fruits': '🍎',
      'fruits & vegetables': '🥬',
      'poultry': '🍗',
      'pork': '🥓',
      'beef': '🥩',
      'chicken': '🍗',
      'dry goods': '🌾',
      'rice': '🍚',
      'grains': '🌾',
      'rice & grain': '🍚',
      'dried fish': '🐟',
      'grocery': '🛒',
      'eatery': '🍽️',
      'variety': '🏪',
    };
    const key = categoryName.toLowerCase();
    return emojiMap[key] || '📦';
  };

  // Group shopping list items by category
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, typeof items>();
    
    items.forEach((item) => {
      const categoryKey = item.categoryName || 'Other';
      
      if (!groups.has(categoryKey)) {
        groups.set(categoryKey, []);
      }
      groups.get(categoryKey)?.push(item);
    });
    
    return Array.from(groups.entries())
      .map(([category, categoryItems]) => ({
        category,
        items: categoryItems,
        count: categoryItems.length,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [items]);

  // Sort search results
  const sortedSearchResults = React.useMemo(() => {
    const results = [...searchResults];
    
    if (sortBy === 'price-low' || sortBy === 'price-high') {
      results.forEach(product => {
        product.vendor_products.sort((a, b) => {
          return sortBy === 'price-low' ? a.price - b.price : b.price - a.price;
        });
      });
    } else if (sortBy === 'stall') {
      results.forEach(product => {
        product.vendor_products.sort((a, b) => {
          return a.vendor_profiles.stall_number.localeCompare(b.vendor_profiles.stall_number);
        });
      });
    }
    
    return results;
  }, [searchResults, sortBy]);

  const toggleGroup = (category: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedGroups(newExpanded);
  };

  // Get unique categories from current search results
  const availableCategories = React.useMemo(() => {
    if (!searchResults.length) return [];
    
    const categoryMap = new Map<string, ProductCategory>();
    searchResults.forEach((product) => {
      if (product.product_categories && product.category_id) {
        categoryMap.set(product.category_id, {
          id: product.category_id,
          name: product.product_categories.name,
        });
      }
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchResults]);

  // Reset selected category if it's no longer available in search results
  useEffect(() => {
    if (selectedCategory && availableCategories.length > 0) {
      const categoryExists = availableCategories.some(cat => cat.id === selectedCategory);
      if (!categoryExists) {
        setSelectedCategory(null);
      }
    }
  }, [availableCategories, selectedCategory]);

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    setShowResults(true);

    try {
      let supabaseQuery = supabase
        .from('products')
        .select(`
          id,
          name,
          category_id,
          product_categories (
            id,
            name
          ),
          vendor_products!inner (
            id,
            price,
            uom,
            status,
            vendor_profiles!inner (
              id,
              business_name,
              first_name,
              last_name,
              stall_number
            )
          )
        `)
        .ilike('name', `%${query}%`)
        .eq('vendor_products.status', 'available');

      // Apply category filter if selected
      if (selectedCategory) {
        supabaseQuery = supabaseQuery.eq('category_id', selectedCategory);
      }

      const { data, error } = await supabaseQuery.limit(20);

      if (error) throw error;
      setSearchResults((data as any) || []);
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'Failed to search products');
    } finally {
      setSearching(false);
    }
  }, [selectedCategory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, searchProducts]);

  const handleAddToList = (product: ProductSearchResult, vendorProduct: ProductSearchResult['vendor_products'][0]) => {
    const vendor = vendorProduct.vendor_profiles;
    const vendorName = vendor.business_name || `${vendor.first_name} ${vendor.last_name}`;

    addItem({
      productName: product.name,
      productId: product.id,
      vendorName,
      vendorId: vendor.id,
      stallNumber: vendor.stall_number,
      price: vendorProduct.price,
      uom: vendorProduct.uom,
      categoryName: product.product_categories?.name,
      categoryId: product.category_id,
    });

    Alert.alert('Added!', `${product.name} added to your market list`);
  };

  const handleViewOnMap = () => {
    const stalls = getUniqueStalls();
    
    if (stalls.length === 0) {
      Alert.alert('Empty List', 'Add some products to your market list first!');
      return;
    }

    // Navigate to map with multiple stalls
    navigation.navigate('Market', {
      shoppingListStalls: stalls.map(s => s.stallNumber),
    });
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Market List',
      'Are you sure you want to remove all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearList,
        },
      ]
    );
  };

  const renderSearchResult = ({ item }: { item: ProductSearchResult }) => {
    const categoryColor = getCategoryColor(item.product_categories?.name);
    const categoryName = item.product_categories?.name || 'Other';

    return (
      <View style={styles.searchResultCard}>
        <View style={styles.searchResultHeader}>
          <Text style={styles.searchProductName}>{item.name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryBadgeText}>{categoryName}</Text>
          </View>
        </View>
        <Text style={styles.vendorCount}>
          {item.vendor_products.length} vendor{item.vendor_products.length > 1 ? 's' : ''} selling this
        </Text>
        
        {item.vendor_products.map((vp, _index) => {
          const vendor = vp.vendor_profiles;
          const vendorName = vendor.business_name || `${vendor.first_name} ${vendor.last_name}`;
          
          return (
            <View key={vp.id} style={styles.vendorOption}>
              <View style={styles.vendorOptionInfo}>
                <Text style={styles.vendorOptionName}>{vendorName}</Text>
                <Text style={styles.vendorOptionStall}>Stall {vendor.stall_number}</Text>
                <Text style={styles.vendorOptionPrice}>₱{vp.price.toFixed(2)} / {vp.uom}</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleAddToList(item, vp)}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Market List</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearAll}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && !searching && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => {
              setSearchQuery('');
              setShowResults(false);
              setSelectedCategory(null);
            }}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
        {searching && (
          <ActivityIndicator
            style={styles.searchLoader}
            size="small"
            color="#4CAF50"
          />
        )}
      </View>

      {/* Category Filter Tabs */}
      {showResults && searchQuery.trim() && availableCategories.length > 0 && (
        <View style={styles.categoryFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                !selectedCategory && styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  !selectedCategory && styles.categoryChipTextSelected,
                ]}
              >
                🛒 All
              </Text>
            </TouchableOpacity>

            {availableCategories.map((category) => {
              // Map category names to emojis
              const categoryEmojis: { [key: string]: string } = {
                'Meat': '🥩',
                'Fish': '🐟',
                'Vegetables': '🥬',
                'Fruits': '🍎',
                'Poultry': '🍗',
                'Seafood': '🦐',
                'Pork': '🥓',
                'Beef': '🥩',
                'Chicken': '🍗',
                'Dry Goods': '🌾',
                'Rice': '🍚',
                'Grains': '🌾',
              };

              const emoji = categoryEmojis[category.name] || '📦';
              const categoryColor = getCategoryColor(category.name);

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.id && [styles.categoryChipSelected, { backgroundColor: categoryColor }],
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  {selectedCategory !== category.id && (
                    <View style={[styles.categoryChipDot, { backgroundColor: categoryColor }]} />
                  )}
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === category.id && styles.categoryChipTextSelected,
                    ]}
                  >
                    {emoji} {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Search Results or Shopping List */}
      {showResults && searchQuery.trim() ? (
        <View style={styles.contentContainer}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {/* Sort Menu Button */}
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Text style={styles.sortButtonText}>⚡ Sort</Text>
            </TouchableOpacity>
          </View>

          {/* Sort Menu */}
          {showSortMenu && (
            <View style={styles.sortMenu}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'default' && styles.sortOptionSelected]}
                onPress={() => { setSortBy('default'); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === 'default' && styles.sortOptionTextSelected]}>
                  Default
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'price-low' && styles.sortOptionSelected]}
                onPress={() => { setSortBy('price-low'); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === 'price-low' && styles.sortOptionTextSelected]}>
                  💰 Price: Low to High
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'price-high' && styles.sortOptionSelected]}
                onPress={() => { setSortBy('price-high'); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === 'price-high' && styles.sortOptionTextSelected]}>
                  💰 Price: High to Low
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'stall' && styles.sortOptionSelected]}
                onPress={() => { setSortBy('stall'); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === 'stall' && styles.sortOptionTextSelected]}>
                  📍 Stall Number
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {sortedSearchResults.length > 0 ? (
            <FlatList
              data={sortedSearchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              contentContainerStyle={styles.searchResultsList}
            />
          ) : searching ? null : (
            <Text style={styles.emptyText}>No products found</Text>
          )}
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <Text style={styles.sectionTitle}>
            📋 My Market List ({items.length} item{items.length !== 1 ? 's' : ''})
          </Text>
          
          {items.length > 0 ? (
            <>
              <ScrollView style={styles.groupedListContainer}>
                {groupedItems.map((group) => {
                  const isExpanded = expandedGroups.has(group.category);
                  const categoryColor = getCategoryColor(group.category);
                  const categoryEmoji = getCategoryEmoji(group.category);

                  return (
                    <View key={group.category} style={styles.categoryGroup}>
                      {/* Category Header */}
                      <TouchableOpacity
                        style={[styles.categoryHeader, { borderLeftColor: categoryColor }]}
                        onPress={() => toggleGroup(group.category)}
                      >
                        <View style={styles.categoryHeaderLeft}>
                          <View style={[styles.categoryColorDot, { backgroundColor: categoryColor }]} />
                          <Text style={styles.categoryHeaderText}>
                            {categoryEmoji} {group.category}
                          </Text>
                          <Text style={styles.categoryCount}>({group.count} item{group.count !== 1 ? 's' : ''})</Text>
                        </View>
                        <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                      </TouchableOpacity>

                      {/* Category Items */}
                      {isExpanded && (
                        <View style={styles.categoryItems}>
                          {group.items.map((item) => (
                            <View key={item.id} style={[styles.listItem, item.isDone && styles.listItemDone]}>
                              <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => toggleDone(item.id)}
                              >
                                <View style={[styles.checkbox, item.isDone && styles.checkboxChecked]}>
                                  {item.isDone && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                              </TouchableOpacity>

                              <View style={styles.itemContent}>
                                <Text style={[styles.productName, item.isDone && styles.textDone]}>
                                  {item.productName}
                                </Text>
                                <Text style={styles.vendorInfo}>
                                  📍 {item.vendorName} • Stall {item.stallNumber}
                                </Text>
                                {item.price > 0 && (
                                  <Text style={styles.priceInfo}>
                                    ₱{item.price.toFixed(2)}{item.uom ? ` / ${item.uom}` : ''}
                                  </Text>
                                )}
                              </View>

                              <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => removeItem(item.id)}
                              >
                                <Text style={styles.removeButtonText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              
              <TouchableOpacity
                style={styles.viewMapButton}
                onPress={handleViewOnMap}
              >
                <Text style={styles.viewMapButtonText}>
                  🗺️ View Route on Map ({getUniqueStalls().length} stalls)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🛒</Text>
              <Text style={styles.emptyStateTitle}>Your market list is empty</Text>
              <Text style={styles.emptyStateText}>
                Search for products above and add them to your list
              </Text>
            </View>
          )}
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingRight: 50,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    position: 'absolute',
    right: 30,
    top: 24,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 15,
  },
  clearSearchText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  searchLoader: {
    position: 'absolute',
    right: 30,
    top: 24,
  },
  contentContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  shoppingList: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemDone: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  textDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  vendorInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  priceInfo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
  },
  removeButtonText: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchResultsList: {
    padding: 16,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  searchProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  vendorCount: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  vendorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 8,
  },
  vendorOptionInfo: {
    flex: 1,
  },
  vendorOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  vendorOptionStall: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  vendorOptionPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  viewMapButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  viewMapButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
  categoryFilterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
  },
  categoryChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryChipSelected: {
    borderColor: 'transparent',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sortMenu: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sortOptionSelected: {
    backgroundColor: '#F0F9FF',
    borderLeftColor: '#2196F3',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#666',
  },
  sortOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  groupedListContainer: {
    flex: 1,
  },
  categoryGroup: {
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  categoryCount: {
    fontSize: 14,
    color: '#999',
  },
  expandIcon: {
    fontSize: 16,
    color: '#999',
  },
  categoryItems: {
    backgroundColor: '#F8F8F8',
  },
});

export default ShoppingListScreen;
