import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, Image,
  Alert, Platform, PermissionsAndroid, Switch, Modal, NativeSyntheticEvent, NativeScrollEvent, Animated, StatusBar
} from 'react-native';
import { Buffer } from 'buffer';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import RNFS from 'react-native-fs';
import { SessionManager } from '../../../utils/sessionManager';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopProfile'>;

const AVATAR_BUCKET = 'vendor-avatars';

interface VendorProfile {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  business_type: string;
  phone_number?: string;
  products_services_description?: string;
  profile_image_url?: string;
  market_section_id?: string;
  default_category_id?: string;
  stall?: {
    stall_number: string;
    location_description?: string;
  };
  market_sections?: {
    id: string;
    name: string;
  };
}

interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  market_section_id?: string;
}

/* -------------------- Compact Save Modal (with icon fallback) -------------------- */
/* SaveModal (fixed: compact overlay + reliable icon fallback) */
const SaveModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  // Fallback-rendering component for the icon
  const IconSafe: React.FC<{ size?: number; style?: any }> = ({ size = 56, style }) => {
    return (
      <View style={[styles.iconWrapper, style]}>
        {/* Fallback checkmark only */}
        <View style={[styles.iconFallbackContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.iconFallbackText, { fontSize: Math.round(size * 0.45) }]}>✓</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      {/* Backdrop */}
      <View style={styles.saveModalBackdrop}>
        {/* Centered card */}
        <View style={styles.saveModalCard}>
          <IconSafe size={64} style={styles.saveModalIcon} />
          <Text style={styles.saveModalTitle}>Saved</Text>
          <Text style={styles.saveModalMessage}>Profile updated successfully</Text>
          <TouchableOpacity style={styles.saveModalOkButton} onPress={onClose}>
            <Text style={styles.saveModalOkText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/* -------------------- Time picker (smooth) -------------------- */

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTime: (time: string) => void;
  initialTime?: string;
}

const ITEM_HEIGHT = 50;
const VERTICAL_PADDING = 100;

const TimePickerModal: React.FC<TimePickerModalProps> = ({ visible, onClose, onSelectTime, initialTime }) => {
  const hours = useMemo(() => ['1','2','3','4','5','6','7','8','9','10','11','12'], []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => (i < 10 ? `0${i}` : `${i}`)), []);
  const periods = useMemo(() => ['AM','PM'], []);

  const [selectedHour, setSelectedHour] = useState<string>('9');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('AM');

  const hoursRef = useRef<ScrollView | null>(null);
  const minutesRef = useRef<ScrollView | null>(null);
  const periodRef = useRef<ScrollView | null>(null);

  // Animated scalers for subtle selection pulse on change (small UX polish)
  const hourScale = useRef(new Animated.Value(1)).current;
  const minuteScale = useRef(new Animated.Value(1)).current;
  const periodScale = useRef(new Animated.Value(1)).current;

  // Only initialize scroll positions when the modal becomes visible or when an initialTime is provided.
  // Use a prevVisibleRef to ensure the initialization logic runs only when the modal opens (visible transitions false -> true).
  const prevVisibleRef = useRef<boolean>(false);
  useEffect(() => {
    // Only run initialization when the modal becomes visible (first frame after open)
    if (!visible) {
      prevVisibleRef.current = false;
      return;
    }
    if (prevVisibleRef.current) {
      // already open, skip re-initialization
      return;
    }
    // modal just opened
    prevVisibleRef.current = true;

    if (initialTime) {
      const match = initialTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        const h = match[1];
        const m = match[2];
        const p = match[3].toUpperCase();
        // set initial selection values
        setSelectedHour(h);
        setSelectedMinute(m);
        setSelectedPeriod(p);
        // ensure scroll positions align with those values without animating
        setTimeout(() => {
          scrollToValue(hoursRef, hours, h, false);
          scrollToValue(minutesRef, minutes, m, false);
          scrollToValue(periodRef, periods, p, false);
        }, 60);
        return;
      }
    }
    // Align columns to current values on open without animating.
    setTimeout(() => {
      scrollToValue(hoursRef, hours, selectedHour, false);
      scrollToValue(minutesRef, minutes, selectedMinute, false);
      scrollToValue(periodRef, periods, selectedPeriod, false);
    }, 60);
  }, [visible, initialTime, hours, minutes, periods, selectedHour, selectedMinute, selectedPeriod]);

  const scrollToValue = (ref: React.RefObject<ScrollView | null>, list: string[], value: string, animated = true) => {
    const idx = list.indexOf(value);
    if (idx >= 0 && ref.current) {
      try {
        (ref.current as any).scrollTo({ y: idx * ITEM_HEIGHT, animated });
      } catch {}
    }
  };

  // Pulse animation helper: quick scale up then back down
  const pulse = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.06, duration: 120, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  // Trigger a small pulse when selection changes to visually emphasize the new value.
  useEffect(() => { pulse(hourScale); }, [selectedHour, hourScale]);
  useEffect(() => { pulse(minuteScale); }, [selectedMinute, minuteScale]);
  useEffect(() => { pulse(periodScale); }, [selectedPeriod, periodScale]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>, items: string[], setter: (v: string) => void, ref: React.RefObject<ScrollView | null>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const safeIdx = Math.max(0, Math.min(items.length - 1, idx));
    setter(items[safeIdx]);
    if (ref.current) {
      try {
        (ref.current as any).scrollTo({ y: safeIdx * ITEM_HEIGHT, animated: true });
      } catch {}
    }
  };

  const renderColumn = (items: string[], selectedValue: string, setter: (v: string) => void, ref: React.RefObject<ScrollView | null>, animatedScale?: Animated.Value) => (
    <View style={styles.pickerColumn}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pickerScrollContent}
  snapToInterval={ITEM_HEIGHT}
  decelerationRate="fast"
  // useMomentum end gives a single reliable callback after the scroll settles
  onMomentumScrollEnd={(e) => onScrollEnd(e, items, setter, ref)}
      >
        {items.map((it) => {
          const isSelected = it === selectedValue;
          return (
            <TouchableOpacity
              key={it}
              onPress={() => { setter(it); scrollToValue(ref, items, it, true); }}
              activeOpacity={0.7}
              style={styles.pickerItem}
            >
              <Animated.Text
                style={[
                  isSelected ? styles.pickerItemTextSelected : styles.pickerItemText,
                  // apply animated scale only when an animated value is provided
                  animatedScale ? { transform: [{ scale: isSelected ? animatedScale : 1 }] } : undefined
                ]}
              >
                {it}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.pickerHighlight} pointerEvents="none" />
    </View>
  );

  const handleConfirm = () => {
    const time = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
    onSelectTime(time);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.timePickerOverlay}>
        <View style={styles.timePickerContainer}>
          <Text style={styles.timePickerTitle}>Select Time</Text>
          <View style={styles.timePickerContent}>
            {renderColumn(hours, selectedHour, setSelectedHour, hoursRef)}
            <Text style={styles.timeSeparatorColon}>:</Text>
            {renderColumn(minutes, selectedMinute, setSelectedMinute, minutesRef)}
            {renderColumn(periods, selectedPeriod, setSelectedPeriod, periodRef)}
          </View>
          <View style={styles.timePickerButtons}>
            <TouchableOpacity style={styles.timePickerCancelButton} onPress={onClose}>
              <Text style={styles.timePickerCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timePickerConfirmButton} onPress={handleConfirm}>
              <Text style={styles.timePickerConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* -------------------- Main component -------------------- */

const ShopProfileScreen: React.FC<Props> = () => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileUploadUri, setProfileUploadUri] = useState<string | null>(null);
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const session = SessionManager.getSession();
  const [formData, setFormData] = useState({
    stallNo: '',
    businessName: '',
    contactNo: '',
    operatingHours: ''
  });

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const createInitialSchedule = () => {
    const base: Record<string, { open: boolean; start: string; end: string }> = {};
    DAYS.forEach((d) => {
      if (d === 'Saturday' || d === 'Sunday') base[d] = { open: false, start: '9:00 AM', end: '5:00 PM' };
      else base[d] = { open: true, start: '9:00 AM', end: '5:00 PM' };
    });
    return base;
  };

  const [hoursSchedule, setHoursSchedule] = useState<Record<string, { open: boolean; start: string; end: string }>>(createInitialSchedule());
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [currentEditingTime, setCurrentEditingTime] = useState<{ day: string; field: 'start' | 'end'; currentValue: string } | null>(null);
  
  // Category selection state
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  useEffect(() => {
    const fetchVendorProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!session) {
          setError('Please login to view profile');
          setLoading(false);
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
          console.error('Vendor fetch error', vendorError);
          setError('Failed to load vendor profile');
          setLoading(false);
          return;
        }

        let stallData = null;
        if (vendorData?.id) {
          const { data: stalls } = await supabase
            .from('stalls')
            .select('stall_number, location_description')
            .eq('vendor_profile_id', vendorData.id)
            .maybeSingle();
          stallData = stalls;
        }

        const stallInfo = stallData || (vendorData?.stall_number ? {
          stall_number: vendorData.stall_number,
          location_description: vendorData.complete_address || ''
        } : null);

        const vendorWithStall = { ...vendorData, stall: stallInfo };
        setVendor(vendorWithStall);

        setFormData({
          stallNo: stallInfo?.stall_number || vendorData?.stall_number || '',
          businessName: vendorData.business_name || '',
          contactNo: vendorData.phone_number || '',
          operatingHours: vendorData?.operating_hours || ''
        });

        if (vendorData?.profile_image_url) setProfileImage(vendorData.profile_image_url);
        else if (session?.vendorId) {
          try {
            const b64 = await AsyncStorage.getItem(`vendor_avatar_${session.vendorId}`);
            if (b64) setProfileImage(`data:image/jpeg;base64,${b64}`);
          } catch {}
        }

        if (vendorData?.operating_hours) {
          try {
            const parsed = JSON.parse(vendorData.operating_hours);
            if (typeof parsed === 'object' && parsed !== null) {
              setHoursSchedule((prev) => ({ ...prev, ...parsed }));
            }
          } catch (err) {
            console.warn('Invalid operating_hours JSON in vendor profile', err);
          }
        }

        // Set default category if exists
        if (vendorData?.default_category_id) {
          console.log('Setting default category from profile:', vendorData.default_category_id);
          setSelectedCategoryId(vendorData.default_category_id);
        }

        // Fetch product categories filtered by vendor's market section
        console.log('Fetching categories for market_section_id:', vendorData?.market_section_id);
        const { data: categoriesData, error: catError } = await supabase
          .from('product_categories')
          .select('*')
          .order('name');

        console.log('Categories fetched:', categoriesData?.length, 'Error:', catError);

        if (!catError && categoriesData) {
          // Filter categories based on vendor's market_section_id
          let filteredCategories = categoriesData;
          
          if (vendorData?.market_section_id) {
            console.log('Filtering by market_section_id:', vendorData.market_section_id);
            // Filter by matching market_section_id
            filteredCategories = categoriesData.filter((cat: ProductCategory) => 
              cat.market_section_id === vendorData.market_section_id
            );
            console.log('Filtered categories by ID:', filteredCategories.length);
          }
          
          // If no categories match by ID, fall back to name-based filtering
          if (filteredCategories.length === 0 && vendorData?.market_sections?.name) {
            console.log('Falling back to name-based filtering for:', vendorData.market_sections.name);
            const sectionName = vendorData.market_sections.name.toLowerCase();
            filteredCategories = categoriesData.filter((cat: ProductCategory) => {
              const catName = cat.name.toLowerCase();
              
              if (sectionName.includes('meat') || sectionName.includes('karne')) {
                return catName.includes('beef') || catName.includes('chicken') || 
                       catName.includes('pork') || catName.includes('meat');
              }
              
              if (sectionName.includes('fish') || sectionName.includes('isda')) {
                return catName.includes('fish') || catName.includes('isda') || 
                       catName.includes('seafood');
              }
              
              if (sectionName.includes('vegetable') || sectionName.includes('gulay')) {
                return catName.includes('vegetable') || catName.includes('gulay');
              }
              
              if (sectionName.includes('fruit') || sectionName.includes('prutas')) {
                return catName.includes('fruit') || catName.includes('prutas');
              }
              
              // For grocery or general, show all categories
              return true;
            });
            console.log('Filtered categories by name:', filteredCategories.length);
          }
          
          console.log('Final filtered categories:', filteredCategories.map(c => c.name));
          setCategories(filteredCategories);
        }

      } catch (err) {
        console.error('Error fetching vendor profile:', err);
        setError('Failed to load profile data');
      }
      setLoading(false);
    };

    fetchVendorProfile();
  }, [session]);

  const handleImagePicker = async () => {
    if (!isEditing) return;

    const chooseLibrary = async () => {
      try {
        const options = { mediaType: 'photo' as MediaType, includeBase64: true, maxHeight: 2000, maxWidth: 2000, quality: 0.8 as PhotoQuality };
        launchImageLibrary(options, async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage) return;
          if (response.assets && response.assets[0]) {
            const asset = response.assets[0];
            try {
              if (asset.base64 && session?.vendorId) {
                await AsyncStorage.setItem(`vendor_avatar_${session.vendorId}`, asset.base64);
                const mime = asset.type || 'image/jpeg';
                setProfileImage(`data:${mime};base64,${asset.base64}`);
              }
              if (asset.uri) {
                setProfileUploadUri(asset.uri);
                if (!asset.base64) setProfileImage(asset.uri);
              } else {
                Alert.alert('Error', 'Could not get image from picker.');
              }
            } catch (e) {
              console.warn('Failed handling picked image', e);
              setProfileImage(asset.uri || null);
            }
          }
        });
      } catch (err) { console.warn('Library pick failed', err); }
    };

    const takePhoto = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: 'Camera Permission', message: 'App needs access to your camera to take a profile picture.',
            buttonNeutral: 'Ask Me Later', buttonNegative: 'Cancel', buttonPositive: 'OK'
          });
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission denied', 'Cannot use camera without permission.'); return; }
        }
        const options = { mediaType: 'photo' as MediaType, includeBase64: true, maxHeight: 2000, maxWidth: 2000, quality: 0.8 as PhotoQuality, saveToPhotos: true };
        launchCamera(options, async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage) return;
          if (response.assets && response.assets[0]) {
            const asset = response.assets[0];
            try {
              if (asset.base64 && session?.vendorId) {
                await AsyncStorage.setItem(`vendor_avatar_${session.vendorId}`, asset.base64);
                const mime = asset.type || 'image/jpeg';
                setProfileImage(`data:${mime};base64,${asset.base64}`);
              }
              if (asset.uri) {
                setProfileUploadUri(asset.uri);
                if (!asset.base64) setProfileImage(asset.uri);
              } else {
                Alert.alert('Error', 'Could not get image from camera.');
              }
            } catch (e) {
              console.warn('Failed handling captured image', e);
              setProfileImage(asset.uri || null);
            }
          }
        });
      } catch (err) { console.warn('Camera failed', err); }
    };

    Alert.alert('Upload Photo', 'Choose photo source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const b64ToArrayBuffer = (base64: string): ArrayBuffer => {
    // Use Buffer.from to decode base64 into bytes and return an ArrayBuffer view
    const buf = Buffer.from(base64, 'base64');
    // buf.buffer may be larger than the sliced view we need, so slice using byteOffset/byteLength
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const businessNameCurrent = formData.businessName;
      const phoneCurrent = formData.contactNo;
      const serialized = JSON.stringify(hoursSchedule);

      let publicUrl: string | null = null;
      if (profileUploadUri || (profileImage && profileImage.startsWith('data:'))) {
        try {
          let base64Data: string | null = null;
          let detectedMime: string | null = null;

          if (profileImage && profileImage.startsWith('data:')) {
            const commaIdx = profileImage.indexOf(',');
            const header = profileImage.substring(5, commaIdx);
            const semi = header.indexOf(';');
            detectedMime = semi > -1 ? header.substring(0, semi) : header;
            base64Data = profileImage.slice(commaIdx + 1);
          }
          if (!base64Data && profileUploadUri) {
            const filePath = profileUploadUri.replace('file://', '');
            base64Data = await RNFS.readFile(filePath, 'base64');
            const lower = filePath.toLowerCase();
            if (lower.endsWith('.png')) detectedMime = 'image/png';
            else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) detectedMime = 'image/jpeg';
          }

          if (base64Data) {
            const arrayBuffer = b64ToArrayBuffer(base64Data);
            const mime = detectedMime || 'image/jpeg';
            const ext = mime === 'image/png' ? 'png' : 'jpg';
            const filename = `avatars/${session?.vendorId || 'unknown'}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from(AVATAR_BUCKET)
              .upload(filename, arrayBuffer, { upsert: false, contentType: mime });
            if (uploadError) {
              console.warn('Upload error:', uploadError);
            } else {
              const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename);
              publicUrl = data?.publicUrl || null;
            }
          }
        } catch (e) {
          console.warn('Failed during file read/upload:', e);
        }
      }

      const payload: any = {
        business_name: businessNameCurrent,
        phone_number: phoneCurrent,
        operating_hours: serialized,
        default_category_id: selectedCategoryId,
      };
      if (publicUrl) payload.profile_image_url = publicUrl;

      const profileId = vendor?.id || session?.vendorId;
      if (!profileId) {
        Alert.alert('Save failed', 'Could not determine profile ID to update.');
        setLoading(false);
        return;
      }

      const { data: updateData, error: updateError } = await supabase
        .from('vendor_profiles')
        .update(payload)
        .eq('id', profileId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error', updateError);
        Alert.alert('Save failed', 'Could not save profile. Please try again.');
      } else if (!updateData) {
        Alert.alert('Save failed', 'No changes were saved. Please check permissions.');
      } else {
        setVendor((prev) => (prev ? { ...prev, business_name: businessNameCurrent, phone_number: phoneCurrent, profile_image_url: publicUrl || prev.profile_image_url } : prev));
        if (publicUrl) setProfileImage(publicUrl);
        try {
          const current = SessionManager.getSession();
          if (current) SessionManager.setSession({ ...current, businessName: businessNameCurrent });
        } catch {}
        setSaveModalVisible(true);
      }
    } catch (err) {
      console.error('Unexpected save error', err);
      Alert.alert('Error', 'An unexpected error occurred while saving.');
    }
    setLoading(false);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#4CAF50" /></View>;
  if (error) return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  if (!vendor) return <View style={styles.centered}><Text>No vendor profile found.</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profilePictureContainer}>
            <TouchableOpacity style={styles.profilePicture} onPress={handleImagePicker} disabled={!isEditing}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {(session?.firstName || vendor.first_name || 'V').charAt(0)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {isEditing && (
              <TouchableOpacity style={styles.editIconButton} onPress={handleImagePicker}>
                <Text style={styles.editIcon}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {session?.firstName ? `${session.firstName} ${session.lastName || ''}` : `${vendor.first_name} ${vendor.last_name || ''}`}
            </Text>
            <View style={styles.stallBadge}>
              <Text style={styles.stallBadgeText}>Stall {formData.stallNo}</Text>
            </View>
          </View>
        </View>

        {/* Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Shop Information</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.businessName}
              onChangeText={(text) => setFormData({ ...formData, businessName: text })}
              placeholder="Enter business name"
              placeholderTextColor="#999"
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Number</Text>
            <View style={styles.contactInputContainer}>
              <View style={styles.contactPrefixContainer}>
                <Text style={styles.contactPrefix}>+63</Text>
              </View>
              <TextInput
                style={[styles.contactInput, !isEditing && styles.inputDisabled]}
                value={formData.contactNo}
                onChangeText={(text) => {
                  const sanitized = text.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, contactNo: sanitized });
                }}
                placeholder="9XX XXX XXXX"
                placeholderTextColor="#999"
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                editable={isEditing}
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* Default Product Category Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Default Product Category</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Main Category</Text>
            <Text style={styles.helperText}>
              Select your main product category. This will be automatically selected when adding products.
            </Text>
            <TouchableOpacity
              style={[styles.categoryPickerButton, !isEditing && styles.inputDisabled]}
              onPress={() => {
                if (isEditing) setCategoryPickerVisible(true);
              }}
              disabled={!isEditing}
            >
              <Text style={[styles.categoryPickerText, !selectedCategoryId && styles.placeholderText]}>
                {selectedCategoryId 
                  ? categories.find(c => c.id === selectedCategoryId)?.name || 'Select category'
                  : 'Select category'}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Operating Hours Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Operating Hours</Text>
          </View>

          <View style={styles.scheduleContainer}>
            {DAYS.map((day, index) => {
              const entry = hoursSchedule[day];
              const isLastDay = index === DAYS.length - 1;
              
              if (!isEditing) {
                return (
                  <View key={day} style={[styles.scheduleRow, !isLastDay && styles.scheduleRowBorder]}>
                    <Text style={styles.dayLabel}>{day.substring(0, 3)}</Text>
                    <View style={styles.scheduleTimeContainer}>
                      {entry.open ? (
                        <View style={styles.timeRangeContainer}>
                          <Text style={styles.timeText}>{entry.start}</Text>
                          <Text style={styles.timeSeparatorDash}>-</Text>
                          <Text style={styles.timeText}>{entry.end}</Text>
                        </View>
                      ) : (
                        <Text style={styles.closedTextBold}>Closed</Text>
                      )}
                    </View>
                  </View>
                );
              }

              return (
                <View key={day} style={[styles.scheduleRowEdit, !isLastDay && styles.scheduleRowBorder]}> 
                  <View style={styles.dayWithSwitchContainer}>
                    <Text style={[styles.dayLabelEdit, !entry.open && styles.dayLabelDisabled]}>
                      {day.substring(0, 3)}
                    </Text>
                    <Switch
                      value={entry.open}
                      onValueChange={(val) => setHoursSchedule((prev) => ({ ...prev, [day]: { ...prev[day], open: val } }))}
                      disabled={!isEditing}
                      trackColor={{ true: '#4CAF50', false: '#E0E0E0' }}
                      ios_backgroundColor="#E0E0E0"
                      thumbColor="#FFFFFF"
                      style={styles.switchCompact}
                    />
                  </View>

                  {entry.open ? (
                    <View style={styles.timeInputsContainer}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setCurrentEditingTime({ day, field: 'start', currentValue: entry.start });
                          setTimePickerVisible(true);
                        }}
                        style={styles.timeInputButton}
                      >
                        <Text style={styles.timeInputButtonText}>{entry.start}</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeSeparatorEdit}>to</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setCurrentEditingTime({ day, field: 'end', currentValue: entry.end });
                          setTimePickerVisible(true);
                        }}
                        style={styles.timeInputButton}
                      >
                        <Text style={styles.timeInputButtonText}>{entry.end}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.closedPlaceholder}>
                      <Text style={styles.closedPlaceholderText}>Closed all day</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={async () => {
            if (isEditing) {
              try {
                const serialized = JSON.stringify(hoursSchedule);
                setFormData((prev) => ({ ...prev, operatingHours: serialized }));
              } catch (e) {
                console.warn('Failed to serialize hours schedule', e);
              }
              await saveProfile();
              setIsEditing(false);
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Text style={styles.actionButtonText}>{isEditing ? 'Save Changes' : 'Edit Profile'}</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SaveModal visible={saveModalVisible} onClose={() => setSaveModalVisible(false)} />

      {/* Category Picker Modal */}
      <Modal
        visible={categoryPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.categoryPickerModal}>
            <View style={styles.categoryPickerHeader}>
              <Text style={styles.categoryPickerTitle}>Select Default Category</Text>
              <TouchableOpacity onPress={() => setCategoryPickerVisible(false)}>
                <Text style={styles.categoryPickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryList}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === category.id && styles.categoryItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(category.id);
                    setCategoryPickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.categoryItemText,
                    selectedCategoryId === category.id && styles.categoryItemTextSelected
                  ]}>
                    {category.name}
                  </Text>
                  {selectedCategoryId === category.id && (
                    <Text style={styles.categoryItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              {categories.length === 0 && (
                <Text style={styles.noCategoriesText}>
                  No categories available for your market section
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => {
          setTimePickerVisible(false);
          setCurrentEditingTime(null);
        }}
        onSelectTime={(time) => {
          if (currentEditingTime) {
            setHoursSchedule((prev) => ({
              ...prev,
              [currentEditingTime.day]: {
                ...prev[currentEditingTime.day],
                [currentEditingTime.field]: time
              }
            }));
          }
        }}
        initialTime={currentEditingTime?.currentValue}
      />
    </View>
  );
};

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  // Fallback icon styles
  iconSafeFallback: {
    backgroundColor: '#E6F9EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  iconSafeText: {
    color: '#22C55E',
    fontWeight: '800',
  },
  rowWithGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centeredJustify: {
    justifyContent: 'center',
  },
  opacity1: {
    opacity: 1,
  },
  opacity05: {
    opacity: 0.5,
  },
  flex1: {
    flex: 1,
  },
  
  // Main container
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA',
  },
  centered: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  errorText: { 
    color: '#E53935', 
    fontSize: 16, 
    fontWeight: '600',
  },

  // Header with gradient effect
  headerGradient: {
    backgroundColor: '#4CAF50',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  profilePictureContainer: { 
    position: 'relative',
    marginRight: 12,
  },
  profilePicture: {
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#F0F0F0',
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 2,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#333333',
  },
  editIconButton: {
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    width: 22, 
    height: 22, 
    borderRadius: 11,
    backgroundColor: '#333333', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editIcon: { 
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: -1,
  },
  profileImage: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  stallBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignSelf: 'flex-start',
  },
  stallBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
  },

  // Info Cards
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardHeaderIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.2,
  },

  // Form inputs
  inputGroup: { 
    marginBottom: 8,
  },
  label: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#6B7280', 
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 8,
    fontSize: 13, 
    backgroundColor: '#FAFAFA', 
    color: '#1F2937',
    fontWeight: '500',
  },
  inputDisabled: { 
    backgroundColor: '#F9FAFB', 
    color: '#9CA3AF',
    borderColor: '#F0F0F0',
  },
  readOnlyInput: {
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    backgroundColor: '#F9FAFB',
  },
  readOnlyText: { 
    fontSize: 13, 
    color: '#9CA3AF', 
    fontWeight: '500',
  },

  // Contact input
  contactInputContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderRadius: 6, 
    backgroundColor: '#FAFAFA', 
    overflow: 'hidden',
  },
  contactPrefixContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  contactPrefix: { 
    fontSize: 13, 
    color: '#4B5563', 
    fontWeight: '600',
  },
  contactInput: { 
    flex: 1, 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    fontSize: 13, 
    color: '#1F2937',
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontWeight: '500',
  },

  // Operating Hours
  scheduleContainer: { 
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    padding: 2,
  },
  scheduleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  scheduleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scheduleRowEdit: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: { 
    width: 40, 
    fontSize: 12, 
    color: '#1F2937',
    fontWeight: '600',
  },
  dayLabelEdit: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    minWidth: 40,
  },
  dayLabelDisabled: {
    color: '#9CA3AF',
  },
  dayWithSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchCompact: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  scheduleTimeContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  timeSeparatorDash: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  closedTextBold: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },
  switchContainer: { 
    width: 55, 
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  timeInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeInputButton: {
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 6, 
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minWidth: 70,
  },
  timeInputButtonText: { 
    color: '#1F2937', 
    fontSize: 11,
    fontWeight: '600',
  },
  timeSeparatorEdit: { 
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '500',
    marginHorizontal: 2,
  },
  closedPlaceholder: {
    flex: 1,
    alignItems: 'flex-end',
  },
  closedPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
  },
  timeInput: {
    borderWidth: 1, 
    borderColor: '#E5E5E5', 
    borderRadius: 6, 
    paddingHorizontal: 12, 
    paddingVertical: 10,
    width: 90, 
    backgroundColor: '#F9F9F9', 
    color: '#333333',
  },
  timeInputText: { 
    color: '#333333', 
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  timeSeparator: { 
    marginHorizontal: 4, 
    color: '#999999',
    fontSize: 13,
  },
  openIndicator: { 
    fontSize: 11,
    fontWeight: '600',
  },
  openText: { color: '#22C55E' },
  closedText: { color: '#E53935' },

  // Action Button
  actionButton: {
    backgroundColor: '#333333',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: 10,
  },

  /* Save modal styles */
  saveModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  saveModalCard: {
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
  saveModalIcon: {
    marginBottom: 16,
  },
  saveModalTitle: {
    fontSize: 24,
    color: '#22C55E',
    fontWeight: '800',
    marginBottom: 8,
  },
  saveModalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  saveModalOkButton: {
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
  saveModalOkText: {
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

  /* Time picker */
  timePickerOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  timePickerContainer: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 28, 
    width: '88%', 
    maxWidth: 380, 
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  timePickerTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#1F2937', 
    marginBottom: 24, 
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  timePickerContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    height: 250, 
    marginBottom: 28, 
    position: 'relative',
  },
  pickerColumn: { 
    flex: 1, 
    height: 250, 
    position: 'relative',
  },
  pickerScrollContent: { 
    paddingVertical: VERTICAL_PADDING,
  },
  pickerItem: { 
    height: ITEM_HEIGHT, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  pickerItemText: { 
    fontSize: 22, 
    color: '#D1D5DB', 
    fontWeight: '400',
  },
  pickerItemTextSelected: { 
    fontSize: 34, 
    color: '#1F2937', 
    fontWeight: '800',
  },
  pickerHighlight: { 
    position: 'absolute', 
    top: '50%', 
    left: 8, 
    right: 8, 
    height: ITEM_HEIGHT, 
    marginTop: -ITEM_HEIGHT / 2, 
    backgroundColor: 'rgba(0,0,0,0.03)', 
    borderRadius: 12, 
    zIndex: -1,
    borderWidth: 2,
    borderColor: '#333333',
  },
  timeSeparatorColon: { 
    fontSize: 36, 
    color: '#1F2937', 
    fontWeight: '800', 
    marginHorizontal: 8,
  },
  timePickerButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8,
    gap: 12,
  },
  timePickerCancelButton: { 
    flex: 1, 
    paddingVertical: 16, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: '#E5E7EB', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  timePickerCancelText: { 
    fontSize: 16, 
    color: '#6B7280',
    fontWeight: '600',
  },
  timePickerConfirmButton: { 
    flex: 1, 
    paddingVertical: 16, 
    borderRadius: 12, 
    backgroundColor: '#333333', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  timePickerConfirmText: { 
    fontSize: 16, 
    color: '#FFFFFF', 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Category picker styles
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  categoryPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  categoryPickerText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  dropdownIcon: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryPickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },
  categoryPickerClose: {
    fontSize: 28,
    color: '#9CA3AF',
    fontWeight: '300',
    lineHeight: 28,
  },
  categoryList: {
    paddingHorizontal: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  categoryItemText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    fontWeight: '500',
  },
  categoryItemTextSelected: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  categoryItemCheck: {
    fontSize: 20,
    color: '#0EA5E9',
    fontWeight: '700',
  },
  noCategoriesText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});

export default ShopProfileScreen;
