import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import MapViewComponent from '../../map/MapView';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Market'>;

interface CustomerHomeProps extends Props {
  onLogout?: () => void;
}

  // Colors used on the map for each section prefix — keep in sync with MapView.tsx
  const sectionColorMap: { [key: string]: string } = {
    'fish': '#00BCD4',           // F-
    'fruits & vegetables': '#4CAF50', // FV-
    'dried fish': '#FF9800',     // DF-
    'grocery': '#2196F3',        // G-
    'rice & grain': '#FFC107',   // RG-
    'variety': '#9C27B0',        // V-
    'meat': '#F44336',           // M-
    'eatery': '#FF6B6B',         // E-
  };
  const getSectionColor = (categoryName?: string) => {
    if (!categoryName) return '#4CAF50';
    const key = categoryName.toLowerCase();
    return sectionColorMap[key] || '#4CAF50';
  };

// Helper function to get today's operating hours
const getTodayOperatingHours = (operatingHours: string | null | undefined): string => {
  if (!operatingHours) return 'Hours not available';

  try {
    // Parse JSON format from database
    const schedule = JSON.parse(operatingHours as string);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const daySchedule = schedule[today];

    if (daySchedule) {
      if (daySchedule.open === false) {
        return 'Closed today';
      }
      if (daySchedule.start && daySchedule.end) {
        return `${daySchedule.start} - ${daySchedule.end}`;
      }
    }

    return 'Hours not available';
  } catch (error) {
    // If it's not JSON, try to parse as simple text format
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    if (typeof operatingHours !== 'string') return 'Hours not available';

    // If it's a simple time format without days (e.g., "5:00 AM - 5:00 PM")
    if (!operatingHours.includes('Monday') && !operatingHours.includes('Tuesday')) {
      return operatingHours;
    }

    // Parse format like "Monday-Friday: 5:00 AM - 5:00 PM, Saturday-Sunday: 6:00 AM - 4:00 PM"
    const parts = operatingHours.split(',').map((p) => p.trim());

    for (const part of parts) {
      const [dayRange, time] = part.split(':').map((s) => s.trim());
      if (!dayRange || !time) continue;

      if (dayRange.includes('-')) {
        const [startDay, endDay] = dayRange.split('-').map((d) => d.trim());
        const startIdx = days.indexOf(startDay);
        const endIdx = days.indexOf(endDay);
        const todayIdx = days.indexOf(today);

        if (startIdx !== -1 && endIdx !== -1 && todayIdx !== -1) {
          if (startIdx <= todayIdx && todayIdx <= endIdx) {
            return time;
          }
        }
      } else if (dayRange === today) {
        return time;
      }
    }

    return operatingHours; // Fallback to full text
  }
};

const CustomerHome: React.FC<CustomerHomeProps> = ({ navigation, route }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{id: string; name: string; data?: any} | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [stallsInCategory, setStallsInCategory] = useState<any[]>([]);
  const [loadingStalls, setLoadingStalls] = useState(false);
  const [showStallList, setShowStallList] = useState(false);
  const [focusStall, setFocusStall] = useState<string | undefined>(route.params?.focusStall);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Product search and filter states
  const [searchMode, setSearchMode] = useState<'category' | 'product'>('category');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'price' | 'distance' | 'status'>('alphabetical');
  
  // Direction modal states
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  // Handle focusing on a specific stall when navigating from VendorDetails
  useEffect(() => {
    if (route.params?.focusStall) {
      const stallNumber = route.params.focusStall;
      const stallName = route.params.stallName;
      
      console.log('Focusing on stall:', stallNumber);
      
      // Show an alert confirming the stall
      Alert.alert(
        'Stall Location',
        `Showing ${stallName || 'Vendor'} at Stall ${stallNumber}`,
        [{ text: 'OK' }]
      );
      
      // Set the focus stall for the map to zoom to
      setFocusStall(stallNumber);
      
      // Clear the params after handling
      navigation.setParams({ focusStall: undefined, stallName: undefined });
    }
  }, [route.params, navigation]);

  const toggleBanner = () => {
    const toValue = isExpanded ? 400 : 0; // 400 to partially hide, showing header
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setIsExpanded(!isExpanded);
    });
  };

  const hideBanner = useCallback(() => {
    if (isExpanded) {
      Animated.spring(translateY, {
        toValue: 400, // Collapse the bottom sheet
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        setIsExpanded(false);
      });
    }
  }, [isExpanded, translateY]);

  // Keyboard listener to collapse bottom sheet when typing
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // Collapse the bottom sheet when keyboard appears
      if (isExpanded) {
        hideBanner();
      }
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [isExpanded, hideBanner]);

  const handleCategoryPress = (category: string) => {
    // Toggle category selection for highlighting
    const newCategory = selectedCategory === category ? null : category;
    setSelectedCategory(newCategory);
    setSelectedSubcategory(null);
    
    // Collapse bottom sheet when category is selected to show map
    if (newCategory && isExpanded) {
      hideBanner();
    }
    
    // Don't fetch vendors - just show on map
    // Fetch vendors when category is selected
    if (!newCategory) {
      setStallsInCategory([]);
      setProductCategories([]);
    }
    // If a new category was selected, fetch product subcategories for that market section
    if (newCategory) {
      fetchProductCategories(newCategory);
    }
  };

  // Fetch product_categories for the selected market section (e.g., Meat -> Pork, Beef)
  const fetchProductCategories = async (sectionName: string) => {
    setLoadingCategories(true);
    try {
      // Try to resolve market_section id by name (case-insensitive)
      const { data: msData, error: msError } = await supabase
        .from('market_sections')
        .select('id')
        .ilike('name', sectionName)
        .limit(1)
        .maybeSingle();

      if (msError) throw msError;

      const msId = msData?.id;

      // If we have a market_section id, fetch product_categories by that id
      let cats: any[] = [];
      if (msId) {
        const { data: pcData, error: pcError } = await supabase
          .from('product_categories')
          .select('id, name, description')
          .eq('market_section_id', msId)
          .order('name');

        if (pcError) throw pcError;
        cats = pcData || [];
      }

      setProductCategories(cats);
    } catch (err) {
      console.warn('Failed to fetch product categories for', sectionName, err);
      setProductCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchStallsByCategory = async (category: string, subcategoryName?: string | null) => {
    setLoadingStalls(true);
    
    try {
      // Map category names to prefixes
      const categoryPrefixMap: { [key: string]: string } = {
        'fish': 'F-%',
        'fruits & vegetables': 'FV-%',
        'dried fish': 'DF-%',
        'grocery': 'G-%',
        'rice & grain': 'RG-%',
        'variety': 'V-%',
        'meat': 'M-%',
        'eatery': 'E-%',
      };

      const prefix = categoryPrefixMap[category.toLowerCase()];
      
      if (!prefix) {
        setLoadingStalls(false);
        return;
      }

      // If a subcategory is selected, we need to filter vendors who sell products in that subcategory
      if (subcategoryName && subcategoryName.toLowerCase() !== 'all') {
        // Find the product_category id for the selected subcategory
        const { data: pcData, error: pcError } = await supabase
          .from('product_categories')
          .select('id')
          .ilike('name', subcategoryName)
          .limit(1)
          .maybeSingle();

        if (pcError) throw pcError;
        
        const subcategoryId = pcData?.id;

        if (subcategoryId) {
          // Get vendors who have products in this subcategory and match the stall prefix
          const { data: vpData, error: vpError } = await supabase
            .from('vendor_products')
            .select(`
              vendor_id,
              vendor_profiles!inner(
                id,
                business_name,
                first_name,
                last_name,
                stall_number,
                phone_number,
                category,
                operating_hours,
                profile_image_url
              ),
              products!inner(
                id,
                category_id
              )
            `)
            .eq('products.category_id', subcategoryId)
            .ilike('vendor_profiles.stall_number', prefix);

          if (vpError) throw vpError;

          // Deduplicate vendors (same vendor may have multiple products in the subcategory)
          const vendorMap = new Map();
          (vpData || []).forEach((item: any) => {
            const vendor = item.vendor_profiles;
            if (vendor && !vendorMap.has(vendor.id)) {
              vendorMap.set(vendor.id, vendor);
            }
          });

          const vendors = Array.from(vendorMap.values()).sort((a: any, b: any) => 
            (a.stall_number || '').localeCompare(b.stall_number || '')
          );

          setStallsInCategory(vendors);
          setLoadingStalls(false);
          return;
        }
      }

      // No subcategory filter - fetch all vendors by stall prefix who have products
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(`
          id, 
          business_name, 
          first_name, 
          last_name, 
          stall_number, 
          phone_number, 
          category, 
          operating_hours,
          profile_image_url,
          vendor_products!inner(id)
        `)
        .ilike('stall_number', prefix)
        .order('stall_number');

      if (error) throw error;

      setStallsInCategory(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      Alert.alert('Error', 'Failed to load vendors');
    } finally {
      setLoadingStalls(false);
    }
  };

  // Search for products and get vendors who sell them
  const searchProductsAndVendors = async (query: string) => {
    if (query.trim().length < 2) {
      setProductSearchResults([]);
      setStallsInCategory([]);
      return;
    }

    setLoadingStalls(true);
    
    try {
      const searchTerm = `%${query}%`;
      
      // Search for products and get vendor information with prices
      const { data, error } = await supabase
        .from('vendor_products')
        .select(`
          id,
          price,
          vendor_id,
          vendor_profiles!inner(
            id,
            business_name,
            first_name,
            last_name,
            stall_number,
            phone_number,
            category,
            operating_hours,
            profile_image_url
          ),
          products!inner(
            id,
            name,
            category_id,
            product_categories ( id, name )
          )
        `)
        .ilike('products.name', searchTerm)
        .eq('status', 'available');

      if (error) throw error;

      // Group by vendor and get lowest price per vendor
      const vendorMap = new Map();
      
      // If a subcategory is selected, pre-filter rows to those matching the subcategory
      const prefiltered = (data || []).filter((item: any) => {
        if (!selectedSubcategory || selectedSubcategory.toLowerCase() === 'all') return true;
        const sub = selectedSubcategory.toLowerCase();
        const pc = item.products?.product_categories;
        let names: string[] = [];
        if (Array.isArray(pc)) names = pc.map((p: any) => (p?.name || '').toLowerCase());
        else if (pc && typeof pc === 'object') names = [(pc.name || '').toLowerCase()];
        // Match against product_categories' names first
        if (names.some(n => n.includes(sub))) return true;
        // Fallback to product name matching
        const prodName = (item.products?.name || '').toString().toLowerCase();
        if (prodName.includes(sub)) return true;
        return false;
      });

      prefiltered.forEach((item: any) => {
        const vendorId = item.vendor_profiles.id;
        const productName = item.products.name;
        
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            ...item.vendor_profiles,
            minPrice: item.price,
            maxPrice: item.price,
            productName: productName,
            productCount: 1,
          });
        } else {
          const existing = vendorMap.get(vendorId);
          existing.minPrice = Math.min(existing.minPrice, item.price);
          existing.maxPrice = Math.max(existing.maxPrice, item.price);
          existing.productCount += 1;
        }
      });

      let vendors = Array.from(vendorMap.values());
      
      // Apply sorting
      vendors = sortVendors(vendors);
      
      setProductSearchResults(vendors);
      setStallsInCategory(vendors);
      setSearchMode('product');
      
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'Failed to search products');
    } finally {
      setLoadingStalls(false);
    }
  };

  // Helper function to check if vendor is currently open
  const isVendorOpen = useCallback((operatingHours: any): boolean => {
    if (!operatingHours) return false;

    try {
      const now = new Date();
      const nowLocal = now;
      const currentDay = nowLocal.toLocaleDateString('en-US', { weekday: 'long' });
      const currentMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes();

      // Parse operating hours (can be JSON string or object)
      const hours = typeof operatingHours === 'string' ? JSON.parse(operatingHours) : operatingHours;

      // Try multiple possible keys for the current day (e.g., 'Saturday', 'saturday', 'Sat')
      const possibleKeys = [
        currentDay,
        currentDay.toLowerCase(),
        currentDay.slice(0, 3),
        currentDay.slice(0, 3).toLowerCase(),
        currentDay.charAt(0).toUpperCase() + currentDay.slice(1).toLowerCase(),
      ];

      let daySchedule: any = null;
      for (const k of possibleKeys) {
        if (hours && Object.prototype.hasOwnProperty.call(hours, k)) {
          daySchedule = hours[k];
          break;
        }
      }

      // If schedule is not an object keyed by day, handle some common alternate structures
      if (!daySchedule && Array.isArray(hours)) {
        // e.g., [{ day: 'Saturday', start: '4:14 AM', end: '5:00 PM', open: true }, ...]
        daySchedule = hours.find((e: any) => {
          if (!e) return false;
          const d = e.day || e.name || e.weekday;
          if (!d) return false;
          const dn = String(d).toLowerCase();
          return dn.includes(currentDay.toLowerCase()) || dn === currentDay.slice(0,3).toLowerCase();
        }) || null;
      }

      if (!daySchedule) return false;

      // Support both schemas: { isClosed: true } or { open: false }
      if ((daySchedule.isClosed === true) || (daySchedule.open === false)) return false;

      // Extract start/end strings (may be e.g. "9:00 AM" or "09:00")
      const startStr = daySchedule.start || daySchedule.openAt || daySchedule.open_time || null;
      const endStr = daySchedule.end || daySchedule.closeAt || daySchedule.close_time || null;
      if (!startStr || !endStr) return false;

      const parseToMinutes = (t: string | null): number | null => {
        if (!t) return null;
        const s = String(t).trim();
        // Accept formats like '4:14 AM', '4:14AM', '04:14', '4:14 a.m.', '16:14'
        const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp]\.?\s*[Mm]\.?))?$/);
        if (!m) return null;
        let hh = parseInt(m[1].replace(/^0+/, '') || '0', 10);
        const mm = parseInt(m[2], 10);
        const ampmRaw = m[3];
        if (ampmRaw) {
          const up = ampmRaw.replace(/\./g, '').toUpperCase();
          if (up.startsWith('P') && hh !== 12) hh += 12;
          if (up.startsWith('A') && hh === 12) hh = 0;
        }
        return hh * 60 + mm;
      };

      const startMin = parseToMinutes(startStr);
      const endMin = parseToMinutes(endStr);
      if (startMin === null || endMin === null) return false;

      // Normal range
      if (startMin <= endMin) {
        return currentMinutes >= startMin && currentMinutes <= endMin;
      }
      // Overnight range: open from start -> 23:59 and 00:00 -> end
      return currentMinutes >= startMin || currentMinutes <= endMin;
    } catch (error) {
      console.log('Error checking operating hours:', error);
      return false;
    }
  }, []);

  // Sort vendors based on selected criteria
  const sortVendors = useCallback((vendors: any[]) => {
    const sorted = [...vendors];
    
    switch (sortBy) {
      case 'alphabetical':
        return sorted.sort((a, b) => 
          (a.business_name || a.first_name).localeCompare(b.business_name || b.first_name)
        );
      
      case 'price':
        return sorted.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
      
      case 'distance':
        // TODO: Implement distance calculation based on user location and stall location
        // For now, sort by stall number as a proxy
        return sorted.sort((a, b) => {
          const aNum = a.stall_number || '';
          const bNum = b.stall_number || '';
          return aNum.localeCompare(bNum);
        });
      
      case 'status':
        // Sort by open/closed status - open vendors first
        return sorted.sort((a, b) => {
          const aOpen = isVendorOpen(a.operating_hours);
          const bOpen = isVendorOpen(b.operating_hours);
          
          if (aOpen && !bOpen) return -1;
          if (!aOpen && bOpen) return 1;
          return 0;
        });
      
      default:
        return sorted;
    }
  }, [sortBy, isVendorOpen]);

  // Re-sort when sort option changes
  useEffect(() => {
    if (searchMode === 'product' && productSearchResults.length > 0) {
      const sorted = sortVendors(productSearchResults);
      setStallsInCategory(sorted);
    }
  }, [sortBy, searchMode, productSearchResults, sortVendors]);

  // Debounced search function
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    try {
      // Search in multiple tables
      const searchTerm = `%${query}%`;
      
      // 1. Search stalls by stall number
      const { data: stallData } = await supabase
        .from('stalls_mapped_view')
        .select('stall_id, stall_number, poi_id, poi_name')
        .or(`stall_number.ilike.${searchTerm},poi_name.ilike.${searchTerm}`)
        .limit(20);
      
      // 2. Search products
      const { data: productData } = await supabase
        .from('products')
        .select('id, name, category, vendor_id, vendors:vendor_profiles(business_name, stall_number)')
        .ilike('name', searchTerm)
        .limit(20);
      
      // 3. Search vendors by business name
      const { data: vendorData } = await supabase
        .from('vendor_profiles')
        .select('id, business_name, stall_number, first_name, last_name')
        .or(`business_name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`)
        .limit(20);
      
      // Combine and format results
      const results: any[] = [];
      
      // Add stall results
      stallData?.forEach(stall => {
        results.push({
          type: 'stall',
          id: stall.stall_id,
          title: stall.stall_number,
          subtitle: stall.poi_name || 'Market Stall',
          data: stall,
        });
      });
      
      // Add product results
      productData?.forEach(product => {
        results.push({
          type: 'product',
          id: product.id,
          title: product.name,
          subtitle: `${product.category} - Stall ${(product.vendors as any)?.stall_number || 'N/A'}`,
          data: product,
        });
      });
      
      // Add vendor results
      vendorData?.forEach(vendor => {
        results.push({
          type: 'vendor',
          id: vendor.id,
          title: vendor.business_name || `${vendor.first_name} ${vendor.last_name}`,
          subtitle: `Stall ${vendor.stall_number || 'N/A'}`,
          data: vendor,
        });
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchResultClick = (result: any) => {
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    
    if (result.type === 'stall') {
      // Focus on stall on map
      setFocusStall(result.data.stall_number);
      handleStallClick(result.data.stall_number);
    } else if (result.type === 'product') {
      // Navigate to vendor who sells this product
      const vendorData = result.data.vendors;
      if (vendorData && vendorData.stall_number) {
        setFocusStall(vendorData.stall_number);
        handleStallClick(vendorData.stall_number);
      }
    } else if (result.type === 'vendor') {
      // Navigate to vendor details
      if (result.data.stall_number) {
        setFocusStall(result.data.stall_number);
      }
      navigation.navigate('VendorDetails', {
        vendorId: result.data.id,
        vendorName: result.data.business_name || `${result.data.first_name} ${result.data.last_name}`,
      });
    }
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

  // Render a vendor card (extracted so we can add dev logging safely)
  const renderVendorCard = useCallback(({ item: vendor }: { item: any }) => {
    try {
      const _openState = isVendorOpen(vendor.operating_hours);
      if (__DEV__) console.log(`VendorHoursCheck id=${vendor.id} open=${_openState} operating_hours=${String(vendor.operating_hours)}`);
    } catch (e) {
      if (__DEV__) console.log('VendorHoursCheck error', e);
    }

    return (
      <TouchableOpacity
        style={styles.vendorCard}
        onPress={() => {
          // Set focus to the vendor's stall to show pathfinding
          if (vendor.stall_number) {
            setFocusStall(vendor.stall_number);
            setSelectedVendor(vendor);
            setShowDirectionModal(true);
          } else {
            Alert.alert('No Location', 'Stall location not available');
          }
        }}
      >
        {vendor.profile_image_url ? (
          <Image 
            source={{ uri: vendor.profile_image_url }} 
            style={styles.vendorAvatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.vendorAvatarPlaceholder}>
            <Text style={styles.vendorAvatarText}>
              {(vendor.business_name || vendor.first_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>
            {vendor.business_name || `${vendor.first_name} ${vendor.last_name}`}
          </Text>
          <Text style={styles.vendorStall}>🏪 Stall {vendor.stall_number}</Text>
          {vendor.category && (
            <Text style={styles.vendorSection}>📍 {vendor.category}</Text>
          )}
          {searchMode === 'product' && vendor.productName && (
            <Text style={styles.vendorProduct}>🛒 {vendor.productName}</Text>
          )}
          {searchMode === 'product' && vendor.minPrice && (
            <Text style={styles.vendorPrice}>
              💰 ₱{vendor.minPrice.toFixed(2)}
              {vendor.maxPrice && vendor.maxPrice !== vendor.minPrice && ` - ₱${vendor.maxPrice.toFixed(2)}`}
            </Text>
          )}
          {vendor.operating_hours && searchMode !== 'product' && (
            <Text style={styles.vendorHours}>
              🕒 {getTodayOperatingHours(vendor.operating_hours)}
            </Text>
          )}
        </View>
        <View style={styles.vendorStatus}>
          <Text style={styles.vendorStatusDot}>●</Text>
        </View>
      </TouchableOpacity>
    );
  }, [isVendorOpen, searchMode]);

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
          onVendorClick={(vendorId) => {
            console.log('Navigating to vendor:', vendorId);
            navigation.navigate('VendorDetails', { vendorId, vendorName: vendorId });
          }}
          focusStall={focusStall}
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
            transform: [{ translateY: translateY }],
            backgroundColor: getSectionColor(selectedCategory || undefined),
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

        {/* Welcome Message or Category Header */}
        {!selectedCategory ? (
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to</Text>
            <Text style={styles.welcomeSubtitle}>Mapalengke</Text>
            <View style={styles.separator} />
            <Text style={styles.promptText}>What are you looking for?</Text>
            <Text style={styles.hintText}>Search or Select Category</Text>
          </View>
        ) : (
          <View style={styles.categoryHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedCategory(null);
                setStallsInCategory([]);
              }}
            >
              <Text style={styles.backButtonText}>← {selectedCategory}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subcategory selector (e.g., Meat -> Pork, Beef, Chicken) */}
        {selectedCategory && (
          <View style={styles.subcategoryContainer}>
            {loadingCategories ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : productCategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subcategoryScroll}>
                <TouchableOpacity
                  style={[styles.subcategoryButton, !selectedSubcategory && styles.subcategoryButtonActive]}
                  onPress={() => {
                    setSelectedSubcategory(null);
                    // refresh list for category - show all vendors
                    if (searchQuery.trim().length >= 2) searchProductsAndVendors(searchQuery);
                    else fetchStallsByCategory(selectedCategory, null);
                  }}
                >
                  <Text style={[
                    styles.subcategoryText,
                    !selectedSubcategory && styles.subcategoryTextActive,
                    !selectedSubcategory && { color: getSectionColor(selectedCategory || undefined) }
                  ]}>All</Text>
                </TouchableOpacity>

                {productCategories.map((pc) => (
                  <TouchableOpacity
                    key={pc.id}
                    style={[styles.subcategoryButton, selectedSubcategory === pc.name && styles.subcategoryButtonActive]}
                    onPress={() => {
                      const name = pc.name;
                      setSelectedSubcategory(name);
                      // If there's an active search, re-run it filtered; otherwise fetch stalls/vendors for this subcategory
                      if (searchQuery.trim().length >= 2) {
                        searchProductsAndVendors(searchQuery);
                      } else {
                        fetchStallsByCategory(selectedCategory, name);
                      }
                    }}
                  >
                    <Text style={[
                      styles.subcategoryText,
                      selectedSubcategory === pc.name && styles.subcategoryTextActive,
                      selectedSubcategory === pc.name && { color: getSectionColor(selectedCategory || undefined) }
                    ]}>{pc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={selectedCategory ? "Search products..." : "Search stalls, products, or vendors..."}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (selectedCategory) {
                // Search for products when in category mode
                searchProductsAndVendors(text);
              } else {
                // General search
                handleSearch(text);
              }
            }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setProductSearchResults([]);
                if (selectedCategory) {
                  fetchStallsByCategory(selectedCategory);
                }
              }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons (shown when in category or product search mode) */}
        {selectedCategory && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterButton, sortBy === 'alphabetical' && styles.filterButtonActive]}
                onPress={() => setSortBy('alphabetical')}
              >
                <Text style={[styles.filterButtonText, sortBy === 'alphabetical' && styles.filterButtonTextActive]}>
                  A-Z
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.filterButton, sortBy === 'price' && styles.filterButtonActive]}
                onPress={() => setSortBy('price')}
              >
                <Text style={[styles.filterButtonText, sortBy === 'price' && styles.filterButtonTextActive]}>
                  💰 Price
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.filterButton, sortBy === 'distance' && styles.filterButtonActive]}
                onPress={() => setSortBy('distance')}
              >
                <Text style={[styles.filterButtonText, sortBy === 'distance' && styles.filterButtonTextActive]}>
                  📍 Distance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterButton, sortBy === 'status' && styles.filterButtonActive]}
                onPress={() => setSortBy('status')}
              >
                <Text style={[styles.filterButtonText, sortBy === 'status' && styles.filterButtonTextActive]}>
                  🟢 Open/Closed
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedCategory && (
          <View style={styles.searchResultsContainer}>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={3}
                removeClippedSubviews={true}
                nestedScrollEnabled
                style={styles.searchResultsList}
                renderItem={({ item: result }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => handleSearchResultClick(result)}
                  >
                    <View style={styles.searchResultContent}>
                      <Text style={styles.searchResultTitle}>{result.title}</Text>
                      <Text style={styles.searchResultSubtitle}>{result.subtitle}</Text>
                    </View>
                    <View style={[styles.searchResultTypeBadge, 
                      result.type === 'stall' && styles.stallBadge,
                      result.type === 'product' && styles.productBadge,
                      result.type === 'vendor' && styles.vendorBadge
                    ]}>
                      <Text style={styles.searchResultTypeText}>
                        {result.type === 'stall' ? 'Stall' : result.type === 'product' ? 'Product' : 'Vendor'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : null}
          </View>
        )}

        {/* Vendor List or Category Buttons */}
        {selectedCategory ? (
          <View 
            style={styles.vendorListContainer}
          >
            {loadingStalls ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : stallsInCategory.length > 0 ? (
              <FlatList
                data={stallsInCategory}
                keyExtractor={(item) => item.id}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                contentContainerStyle={styles.vendorListContent}
                showsVerticalScrollIndicator={false}
                renderItem={renderVendorCard}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No vendors found in this category</Text>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryButtonsContainer}
            style={styles.categoryButtons}
          >
            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Fish') }]}
              onPress={() => handleCategoryPress('Fish')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Fish</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Meat') }]}
              onPress={() => handleCategoryPress('Meat')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Meat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Fruits & Vegetables') }]}
              onPress={() => handleCategoryPress('Fruits & Vegetables')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Fruits & Vegetables</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Rice & Grain') }]}
              onPress={() => handleCategoryPress('Rice & Grain')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Rice & Grain</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Grocery') }]}
              onPress={() => handleCategoryPress('Grocery')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Grocery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Dried Fish') }]}
              onPress={() => handleCategoryPress('Dried Fish')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Dried Fish</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: getSectionColor('Eatery') }]}
              onPress={() => handleCategoryPress('Eatery')}
            >
              <Text style={[styles.categoryButtonText, styles.categoryButtonTextOnColor]}>Eatery</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Search Bar removed as requested */}
      </Animated.View>

      {/* Hidden Banner Indicator */}
      {!isExpanded && (
        <TouchableOpacity
          style={[styles.hiddenIndicator, { backgroundColor: getSectionColor(selectedCategory || undefined) }]}
          onPress={toggleBanner}
        >
          <Text style={styles.hiddenIndicatorText}>↑</Text>
        </TouchableOpacity>
      )}

      {/* Stall List Modal */}
      <Modal
        visible={showStallList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowStallList(false);
          setSelectedCategory(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedCategory} Stalls ({stallsInCategory.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowStallList(false);
                  setSelectedCategory(null);
                }}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            {loadingStalls ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading stalls...</Text>
              </View>
            ) : (
              <FlatList
                data={stallsInCategory}
                keyExtractor={(item) => item.stall_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stallItem}
                    onPress={() => {
                      setShowStallList(false);
                      handleStallClick(item.stall_number);
                    }}
                  >
                    <Text style={styles.stallNumber}>{item.stall_number}</Text>
                    <Text style={styles.stallHint}>Tap to view vendor</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No stalls found in this category</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Direction Modal */}
      <Modal
        visible={showDirectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDirectionModal(false)}
      >
        <TouchableOpacity 
          style={styles.directionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDirectionModal(false)}
        >
          <TouchableOpacity 
            style={styles.directionModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.directionCloseButton}
              onPress={() => setShowDirectionModal(false)}
            >
              <Text style={styles.directionCloseButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Header with icon */}
            <View style={styles.directionModalHeader}>
              <View style={styles.directionIconContainer}>
                <Text style={styles.directionIcon}>🧭</Text>
              </View>
              <Text style={styles.directionModalTitle}>Navigation</Text>
            </View>

            {/* Vendor Info */}
            {selectedVendor && (
              <View style={styles.directionModalBody}>
                <View style={styles.directionVendorCard}>
                  {selectedVendor.profile_image_url ? (
                    <Image 
                      source={{ uri: `${selectedVendor.profile_image_url}?v=${Date.now()}` }} 
                      style={styles.directionVendorImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.directionVendorImagePlaceholder}>
                      <Text style={styles.directionVendorInitial}>
                        {(selectedVendor.business_name || selectedVendor.first_name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.directionVendorInfo}>
                    <Text style={styles.directionVendorName}>
                      {selectedVendor.business_name || `${selectedVendor.first_name} ${selectedVendor.last_name}`}
                    </Text>
                    <View style={styles.directionStallBadge}>
                      <Text style={styles.directionStallIcon}>📍</Text>
                      <Text style={styles.directionStallText}>Stall {selectedVendor.stall_number}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.directionMessage}>
                  Follow the blue path on the map to reach your destination
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.directionModalActions}>
              <TouchableOpacity
                style={styles.directionSecondaryButton}
                onPress={() => {
                  setShowDirectionModal(false);
                  if (selectedVendor) {
                    navigation.navigate('VendorDetails', {
                      vendorId: selectedVendor.id,
                      vendorName: selectedVendor.business_name || `${selectedVendor.first_name} ${selectedVendor.last_name}`,
                    });
                  }
                }}
              >
                <Text style={styles.directionSecondaryButtonText}>View Details</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.directionPrimaryButton}
                onPress={() => {
                  setShowDirectionModal(false);
                  // Hide the bottom sheet to show the map and direction
                  hideBanner();
                }}
              >
                <Text style={styles.directionPrimaryButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  searchBarContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  clearButton: {
    position: 'absolute',
    right: 30,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
    marginTop: -3,
  },
  searchResultsContainer: {
    maxHeight: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultContent: {
    flex: 1,
    marginRight: 10,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  searchResultTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stallBadge: {
    backgroundColor: '#E3F2FD',
  },
  productBadge: {
    backgroundColor: '#FFF3E0',
  },
  vendorBadge: {
    backgroundColor: '#F3E5F5',
  },
  searchResultTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  categoryHeader: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 15,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryHeaderSubtitle: {
    fontSize: 14,
    color: '#E8F5E8',
    marginBottom: 5,
  },
  categoryHeaderCount: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  vendorListContainer: {
    flex: 1,
    maxHeight: 400,
  },
  vendorListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#66BB6A',
    borderRadius: 15,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 100,
  },
  vendorAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 14,
  },
  vendorAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#7E57C2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  vendorAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  vendorStall: {
    fontSize: 13,
    color: '#E8F5E8',
  },
  vendorSection: {
    fontSize: 12,
    color: '#E8F5E8',
    marginTop: 2,
  },
  vendorHours: {
    fontSize: 12,
    color: '#E8F5E8',
    marginTop: 2,
  },
  vendorStatus: {
    marginLeft: 10,
  },
  vendorStatusDot: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  categoryButtons: {
    marginBottom: 25,
  },
  categoryButtonsContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  subcategoryContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  subcategoryScroll: {
    paddingVertical: 6,
    gap: 8,
  },
  subcategoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  subcategoryButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  subcategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subcategoryTextActive: {
    color: '#4CAF50',
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
  categoryButtonTextOnColor: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
  stallHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  // Filter styles
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterButtonTextActive: {
    color: '#4CAF50',
  },
  // Product search styles
  vendorProduct: {
    fontSize: 12,
    color: '#E8F5E8',
    marginTop: 2,
  },
  vendorPrice: {
    fontSize: 13,
    color: '#FFD700',
    marginTop: 2,
    fontWeight: '600',
  },
  // Direction Modal Styles
  directionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  directionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  directionCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  directionCloseButtonText: {
    fontSize: 20,
    color: '#666666',
    fontWeight: '600',
  },
  directionModalHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  directionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  directionIcon: {
    fontSize: 40,
  },
  directionModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
  directionModalBody: {
    padding: 24,
  },
  directionVendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  directionVendorImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  directionVendorImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  directionVendorInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  directionVendorInfo: {
    flex: 1,
  },
  directionVendorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 6,
  },
  directionStallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  directionStallIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  directionStallText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  directionMessage: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  directionModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  directionSecondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  directionSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  directionPrimaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  directionPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CustomerHome;