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
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  PanResponder,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import MapViewComponent from '../../map/MapView';
import { supabase } from '../../../services/supabase';
// Navigation modal removed

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryColor, setSelectedCategoryColor] = useState<string>('#FFFFFF');
  const [mainCategories, setMainCategories] = useState<any[]>([]);
  const [loadingMainCategories, setLoadingMainCategories] = useState(false);
  const [stallsInCategory, setStallsInCategory] = useState<any[]>([]);
  const [loadingStalls, setLoadingStalls] = useState(false);
  // Removed Market List modal state
  const [focusStall, setFocusStall] = useState<string | undefined>(route.params?.focusStall);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('disconnected');
  
  // Product search and filter states
  const [searchMode, setSearchMode] = useState<'category' | 'product'>('category');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'price' | 'distance' | 'status'>('alphabetical');
  
  // Direction modal removed

  // Removed My Stops modal state and shopping list context

  // Removed debug for direction modal

  // PanRespononder for draggable bottom sheet - only on drag handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to significant vertical gestures to avoid conflicts
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down (positive dy) when expanded
        // or dragging up (negative dy) when collapsed
        if (isExpanded && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else if (!isExpanded && gestureState.dy < 0) {
          translateY.setValue(400 + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged more than 100px, toggle the sheet state
        if (gestureState.dy > 100 && isExpanded) {
          // Collapse the sheet
          Animated.spring(translateY, {
            toValue: 400,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start(() => {
            setIsExpanded(false);
          });
        } else if (gestureState.dy < -100 && !isExpanded) {
          // Expand the sheet
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start(() => {
            setIsExpanded(true);
          });
        } else {
          // Snap back to current state
          Animated.spring(translateY, {
            toValue: isExpanded ? 0 : 400,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Handle focusing on a specific stall when navigating from VendorDetails
  useEffect(() => {
    if (route.params?.focusStall) {
  const stallNumber = route.params.focusStall;
      
      console.log('Focusing on stall:', stallNumber);
      
      // Set the focus stall for the map to zoom to
      setFocusStall(stallNumber);
      
  // Clear the params after handling
  navigation.setParams({ focusStall: undefined, stallName: undefined });
    }
  }, [route.params, navigation]);

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

  // Removed keyboard listener - keep bottom sheet visible when typing

  const handleCategoryPress = (categoryId: string, categoryName: string, marketSectionName?: string) => {
    // Toggle category selection for highlighting
    const newCategory = selectedCategory === categoryName ? null : categoryName;
    setSelectedCategory(newCategory);
    setSelectedCategoryId(newCategory ? categoryId : null);
    
    // Clear search when selecting a category
    setSearchQuery('');
    setSearchResults([]);
    
    // Set the color based on market section
    if (newCategory && marketSectionName) {
      const color = getSectionColor(marketSectionName);
      setSelectedCategoryColor(color);
    } else {
      setSelectedCategoryColor('#FFFFFF');
    }
    
    // Collapse bottom sheet when category is selected to show map
    if (newCategory && isExpanded) {
      hideBanner();
    }
    
    // Fetch vendors for this product category
    if (!newCategory) {
      setStallsInCategory([]);
    } else {
      fetchVendorsByProductCategory(categoryId, categoryName);
    }
  };

  // Fetch vendors who sell products in a specific product category
  const fetchVendorsByProductCategory = useCallback(async (categoryId: string, categoryName: string) => {
    setLoadingStalls(true);
    
    console.log('Fetching vendors for category:', categoryName, 'ID:', categoryId);
    
    try {
      // Special handling for Variety and Eatery - show ALL vendors in these sections
      // regardless of whether they have products
      const isVarietyOrEatery = categoryName.toLowerCase().includes('variety') || 
                                 categoryName.toLowerCase().includes('eatery');
      
      if (isVarietyOrEatery) {
        console.log('Special handling for Variety/Eatery - showing all vendors');
        
        // Get market_section_id for this category
        const { data: categoryData, error: catError } = await supabase
          .from('product_categories')
          .select('market_section_id, market_sections(name)')
          .eq('id', categoryId)
          .single();
        
        if (catError) throw catError;
        
        // Fetch all vendors in this market section
        const { data: vendorData, error: vendorError } = await supabase
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
            market_section_id,
            status
          `)
          .eq('market_section_id', categoryData.market_section_id)
          .eq('status', 'Active')
          .order('stall_number');
        
        if (vendorError) throw vendorError;
        
        console.log('Variety/Eatery vendors fetched:', vendorData?.length || 0);
        setStallsInCategory(vendorData || []);
        setLoadingStalls(false);
        return;
      }
      
      // Normal flow: Get vendors who have products in this category
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
            profile_image_url,
            status
          ),
          products!inner(
            id,
            category_id
          )
        `)
        .eq('products.category_id', categoryId)
        .eq('vendor_profiles.status', 'Active');

      if (vpError) throw vpError;

      console.log('Vendor products data:', vpData);
      console.log('Number of results:', vpData?.length || 0);

      // Deduplicate vendors
      const vendorMap = new Map();
      (vpData || []).forEach((item: any) => {
        const vendor = item.vendor_profiles;
        if (vendor && !vendorMap.has(vendor.id)) {
          vendorMap.set(vendor.id, vendor);
          console.log('Adding vendor:', vendor.business_name, 'Stall:', vendor.stall_number);
        }
      });

      const vendors = Array.from(vendorMap.values()).sort((a: any, b: any) => 
        (a.stall_number || '').localeCompare(b.stall_number || '')
      );

      console.log('Final vendor list:', vendors.length, 'vendors');
      setStallsInCategory(vendors);
    } catch (err) {
      console.error('Failed to fetch vendors for category:', categoryName, err);
      setStallsInCategory([]);
    } finally {
      setLoadingStalls(false);
    }
  }, []);

  // Fetch all main categories from product_categories
  const fetchMainCategories = async () => {
    setLoadingMainCategories(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select(`
          id, 
          name, 
          description, 
          market_section_id,
          market_sections (
            id,
            name
          )
        `)
        .order('name');

      if (error) throw error;
      setMainCategories(data || []);
    } catch (err) {
      console.error('Failed to fetch main categories:', err);
      setMainCategories([]);
    } finally {
      setLoadingMainCategories(false);
    }
  };

  // Fetch main categories on component mount
  useEffect(() => {
    fetchMainCategories();
  }, []);

  // Realtime subscription for product_categories changes
  useEffect(() => {
    console.log('[CATEGORY REALTIME] Setting up subscription for category buttons...');

    const categoryChannel = supabase
      .channel('category-buttons-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_categories',
        },
        (payload) => {
          console.log('[CATEGORY REALTIME] product_categories change detected:', payload.eventType);
          // Refresh categories whenever a category is added, updated, or deleted
          fetchMainCategories();
        }
      )
      .subscribe((status) => {
        console.log('[CATEGORY REALTIME] Subscription status:', status);
      });

    return () => {
      console.log('[CATEGORY REALTIME] Unsubscribing from category changes');
      categoryChannel.unsubscribe();
    };
  }, []);

  // Supabase Realtime subscription for vendor_products and products changes
  useEffect(() => {
    // Only subscribe if a category is selected
    if (!selectedCategoryId || !selectedCategory) {
      setRealtimeStatus('no-category');
      return;
    }

    console.log('[REALTIME] Setting up subscription for category:', selectedCategory, selectedCategoryId);
    setRealtimeStatus('connecting');

    // Subscribe to vendor_products, products, AND vendor_profiles changes
    // This ensures we catch all changes that might affect this category
    const channel = supabase
      .channel(`market-realtime-${selectedCategoryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_products',
        },
        async (payload) => {
          console.log('[REALTIME] vendor_products change detected:', payload.eventType);
          
          // Get the product to check if it belongs to our category
          const productId = (payload.new as any)?.product_id || (payload.old as any)?.product_id;
          if (productId) {
            const { data: product } = await supabase
              .from('products')
              .select('category_id')
              .eq('id', productId)
              .single();
            
            // Only refresh if this product belongs to the selected category
            if (product && product.category_id === selectedCategoryId) {
              console.log('[REALTIME] Change affects current category, refreshing...');
              setRealtimeStatus('active');
              fetchVendorsByProductCategory(selectedCategoryId, selectedCategory);
            }
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
          console.log('[REALTIME] products change detected:', payload.eventType);
          
          // Check if this product belongs to our category
          const categoryId = (payload.new as any)?.category_id || (payload.old as any)?.category_id;
          if (categoryId === selectedCategoryId) {
            console.log('[REALTIME] Product change affects current category, refreshing...');
            setRealtimeStatus('active');
            fetchVendorsByProductCategory(selectedCategoryId, selectedCategory);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_profiles',
        },
        (payload) => {
          console.log('[REALTIME] vendor_profiles change detected:', payload.eventType);
          // Refresh vendor list when any vendor is added, updated, or deleted
          console.log('[REALTIME] Vendor profile changed, refreshing vendor list...');
          setRealtimeStatus('active');
          fetchVendorsByProductCategory(selectedCategoryId, selectedCategory);
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('subscribed');
        } else if (status === 'CLOSED') {
          setRealtimeStatus('closed');
        } else if (status === 'CHANNEL_ERROR') {
          setRealtimeStatus('error');
        }
      });

    return () => {
      console.log('[REALTIME] Unsubscribing from channel');
      channel.unsubscribe();
      setRealtimeStatus('disconnected');
    };
  }, [selectedCategoryId, selectedCategory, fetchVendorsByProductCategory]);

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
      
      console.log('Searching for products:', query);
      console.log('Selected category:', selectedCategory);
      console.log('Selected category ID:', selectedCategoryId);
      
      // Build query for products and vendor information with prices
      let queryBuilder = supabase
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
            profile_image_url,
            status
          ),
          products!inner(
            id,
            name,
            category_id,
            product_categories ( id, name )
          )
        `)
        .ilike('products.name', searchTerm)
        .eq('status', 'available')
        .eq('vendor_profiles.status', 'Active');

      // If a category is selected, filter by that category
      if (selectedCategoryId) {
        console.log('Filtering by category ID:', selectedCategoryId);
        queryBuilder = queryBuilder.eq('products.category_id', selectedCategoryId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      
      console.log('Product search results:', data?.length || 0, 'items');

      // Group by vendor and get lowest price per vendor
      const vendorMap = new Map();
      
      // No subcategory filtering needed anymore since we're at category level
      const prefiltered = data || [];

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
      <View style={styles.vendorCardContainer}>
        <TouchableOpacity
          style={styles.vendorCard}
          activeOpacity={0.7}
          onPress={() => {
            console.log('Vendor card clicked:', vendor.business_name, vendor.stall_number);
            // Navigate directly to vendor details
            navigation.navigate('VendorDetails', {
              vendorId: vendor.id,
              vendorName: vendor.business_name || `${vendor.first_name} ${vendor.last_name}`,
            });
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
        </TouchableOpacity>
      </View>
    );
  }, [isVendorOpen, searchMode, navigation]);

  const handleLocationSelect = (locationId: string, locationName: string, locationData?: any) => {
    console.log('Location selected:', { locationId, locationName, locationData });
    setSelectedLocation({ id: locationId, name: locationName, data: locationData });
    // No stall/location alert; keep silent selection (banner still appears below)
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2C2C2C" />

      {/* Main Content - Indoor Map */}
      <View style={styles.mainContent}>
        {/* Search Bar - Top */}
        <View style={styles.topSearchBarContainer}>
          <TextInput
            style={styles.topSearchInput}
            placeholder={selectedCategory ? "Search products..." : "Search"}
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
              style={styles.topClearButton}
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

        {/* Top Category Chips */}
        <View style={styles.topCategoryContainer}>
          {loadingMainCategories ? (
            <View style={styles.categoryLoadingContainer}>
              <ActivityIndicator size="small" color="#666" />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topCategoryScrollContent}
            >
              {mainCategories.map((category) => {
                const marketSectionName = category.market_sections?.name;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.topCategoryChip,
                      selectedCategory === category.name && styles.topCategoryChipSelected
                    ]}
                    onPress={() => handleCategoryPress(category.id, category.name, marketSectionName)}
                  >
                    <Text style={[
                      styles.topCategoryChipText,
                      selectedCategory === category.name && styles.topCategoryChipTextSelected
                    ]}>
                      {category.name.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

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

      {/* Bottom Sheet Overlay (hidden unless needed) */}
      {(selectedCategory || (searchResults.length > 0)) && (
        <Animated.View
          style={[
            styles.greenBanner,
            {
              transform: [{ translateY: translateY }],
              backgroundColor: selectedCategoryColor,
            }
          ]}
        >
          {/* Drag Handle */}
          <View
            style={styles.dragHandleContainer}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />
          </View>

          {/* Category Header (no welcome sheet) */}
          {selectedCategory && (
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryHeaderText}>{selectedCategory}</Text>
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
            <View style={styles.vendorListContainer}>
            {/* Filter Options */}
            <View style={[styles.bottomSheetFilterContainer, styles.bottomSheetFilterContainerWhiteBorder]}>
              <Text style={[styles.bottomSheetFilterLabel, styles.bottomSheetFilterLabelWhite]}>Sort by:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                <TouchableOpacity
                  style={[
                    styles.bottomSheetFilterChip, 
                    styles.bottomSheetFilterChipDefault,
                    sortBy === 'alphabetical' && styles.bottomSheetFilterChipWhiteSelected
                  ]}
                  onPress={() => setSortBy('alphabetical')}
                >
                  <Text style={[
                    styles.bottomSheetFilterChipText, 
                    styles.bottomSheetFilterChipTextWhite,
                    sortBy === 'alphabetical' && { color: selectedCategoryColor }
                  ]}>
                    A-Z
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bottomSheetFilterChip, 
                    styles.bottomSheetFilterChipDefault,
                    sortBy === 'price' && styles.bottomSheetFilterChipWhiteSelected
                  ]}
                  onPress={() => setSortBy('price')}
                >
                  <Text style={[
                    styles.bottomSheetFilterChipText, 
                    styles.bottomSheetFilterChipTextWhite,
                    sortBy === 'price' && { color: selectedCategoryColor }
                  ]}>
                    Price
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bottomSheetFilterChip, 
                    styles.bottomSheetFilterChipDefault,
                    sortBy === 'distance' && styles.bottomSheetFilterChipWhiteSelected
                  ]}
                  onPress={() => setSortBy('distance')}
                >
                  <Text style={[
                    styles.bottomSheetFilterChipText, 
                    styles.bottomSheetFilterChipTextWhite,
                    sortBy === 'distance' && { color: selectedCategoryColor }
                  ]}>
                    Distance
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bottomSheetFilterChip, 
                    styles.bottomSheetFilterChipDefault,
                    sortBy === 'status' && styles.bottomSheetFilterChipWhiteSelected
                  ]}
                  onPress={() => setSortBy('status')}
                >
                  <Text style={[
                    styles.bottomSheetFilterChipText, 
                    styles.bottomSheetFilterChipTextWhite,
                    sortBy === 'status' && { color: selectedCategoryColor }
                  ]}>
                    Open Stalls
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

              {/* Vendor List */}
              {loadingStalls ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
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
          ) : null}
        </Animated.View>
      )}

      {/* Market List removed */}

      {/* Directions modal removed */}

      {/* My Stops removed */}

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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 1000,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 5,
    zIndex: 1001,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  dragHint: {
    fontSize: 12,
    color: '#666',
    opacity: 0.7,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
  },
  separator: {
    width: '80%',
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 15,
  },
  promptText: {
    fontSize: 16,
    color: '#2C2C2C',
    marginBottom: 5,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 14,
    color: '#999',
    opacity: 0.9,
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
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 15,
  },
  categoryHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  categoryHeaderSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  categoryHeaderCount: {
    fontSize: 12,
    color: '#999',
    opacity: 0.8,
  },
  vendorListContainer: {
    flex: 1,
    maxHeight: 400,
  },
  vendorListContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  vendorCardContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 95,
  },
  addToStopsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addToStopsIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  vendorAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  vendorAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorStall: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    marginBottom: 2,
  },
  vendorSection: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  vendorHours: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '500',
  },
  vendorStatus: {
    marginLeft: 12,
  },
  vendorStatusDot: {
    fontSize: 20,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  subcategoryButtonActive: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  subcategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  subcategoryTextActive: {
    color: '#FFFFFF',
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
  shoppingListIcon: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addStopIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  shoppingListIconText: {
    fontSize: 28,
  },
  addStopPlusIcon: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#4CAF50',
    width: 18,
    height: 18,
    textAlign: 'center',
    lineHeight: 18,
    borderRadius: 9,
    top: 0,
    left: 24,
  },
  topCategoryContainer: {
    position: 'absolute',
    top: 130,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
  },
  topSearchBarContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    zIndex: 101,
    paddingHorizontal: 20,
  },
  topSearchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
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
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  topClearButton: {
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
  topCategoryScrollContent: {
    paddingHorizontal: 6,
    gap: 8,
  },
  categoryLoadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  topCategoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topCategoryChipSelected: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
    elevation: 6,
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  topCategoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2C',
    letterSpacing: 0.5,
  },
  topCategoryChipTextSelected: {
    color: '#FFFFFF',
  },
  bottomSheetFilterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bottomSheetFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterScrollContent: {
    gap: 8,
  },
  bottomSheetFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
  },
  bottomSheetFilterChipSelected: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  bottomSheetFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  bottomSheetFilterChipTextSelected: {
    color: '#FFFFFF',
  },
  // Filter styles with white theme
  bottomSheetFilterContainerWhiteBorder: {
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  bottomSheetFilterLabelWhite: {
    color: '#FFFFFF',
  },
  bottomSheetFilterChipDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bottomSheetFilterChipWhiteSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  bottomSheetFilterChipTextWhite: {
    color: '#FFFFFF',
  },
});

export default CustomerHome;
