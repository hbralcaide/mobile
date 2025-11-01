import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, Image,
  Alert, Platform, PermissionsAndroid, Switch, Modal, NativeSyntheticEvent, NativeScrollEvent, Animated
} from 'react-native';
import { Buffer } from 'buffer';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import RNFS from 'react-native-fs';
import { SessionManager } from '../../../utils/sessionManager';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
//import { BlurView } from '@react-native-community/blur';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  stall?: {
    stall_number: string;
    location_description?: string;
  };
}

/* -------------------- Compact Save Modal (with icon fallback) -------------------- */
/* SaveModal (fixed: compact overlay + reliable icon fallback) */
const SaveModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  // Fallback-rendering component for the icon
  const IconSafe: React.FC<{ size?: number; color?: string; style?: any }> = ({ size = 56, color = '#22C55E', style }) => {
    // Use Ionicons (will render correctly when vector icons are installed and native fonts are bundled).
    // If for any reason the font isn't rendering, the fallback below provides a consistent look (styled ✓).
    // We don't try to "detect" font loading — instead we always render Ionicons and also render a fallback
    // that will look correct if the icon font doesn't show (the fallback is visible layer if needed).
    return (
      <View style={[styles.iconWrapper, style]}>
        {/* Primary icon (native vector) */}
        <Ionicons name="checkmark-circle" size={size} color={color} />
        {/* Fallback (will be visually identical if the vector font fails) */}
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
          .select('*')
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

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#22C55E" /></View>;
  if (error) return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  if (!vendor) return <View style={styles.centered}><Text>No vendor profile found.</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profilePictureSection}>
        <View style={styles.profilePictureContainer}>
          <TouchableOpacity style={styles.profilePicture} onPress={handleImagePicker} disabled={!isEditing}>
            {profileImage ? <Image source={{ uri: profileImage }} style={styles.profileImage} /> : <Text style={styles.profileInitial}>{(session?.firstName || vendor.first_name || 'V').charAt(0)}</Text>}
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity style={styles.editIconButton} onPress={handleImagePicker}>
              <Text style={styles.editIcon}>📷</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.editProfileTitle}>
          {session?.firstName ? `${session.firstName} ${session.lastName || ''}` : `${vendor.first_name} ${vendor.last_name || ''}`}
        </Text>
      </View>

      <View style={styles.formSection}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Stall No.</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{formData.stallNo}</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={[styles.input, !isEditing && styles.inputDisabled]}
            value={formData.businessName}
            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
            placeholder="Enter business name"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contact No.</Text>
          <View style={styles.contactInputContainer}>
            <Text style={styles.contactPrefix}>+63</Text>
            <TextInput
              style={[styles.input, styles.contactInput, !isEditing && styles.inputDisabled]}
              value={formData.contactNo}
              onChangeText={(text) => {
                const sanitized = text.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, contactNo: sanitized });
              }}
              placeholder="Enter contact number"
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              editable={isEditing}
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Operating Hours</Text>
          <View style={styles.scheduleContainer}>
            {DAYS.map((day) => {
              const entry = hoursSchedule[day];
              if (!isEditing) {
                return (
                  <View key={day} style={styles.scheduleRow}>
                    <Text style={styles.dayLabel}>{day}</Text>
                    <View style={styles.rowWithGap}>
                      {entry.open ? (
                        <>
                          <View style={[styles.timeInput, styles.centeredJustify]}>
                            <Text style={styles.timeInputText}>{entry.start}</Text>
                          </View>
                          <Text style={styles.timeSeparator}>to</Text>
                          <View style={[styles.timeInput, styles.centeredJustify]}>
                            <Text style={styles.timeInputText}>{entry.end}</Text>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.closedText}>Closed</Text>
                      )}
                    </View>
                  </View>
                );
              }

              return (
                <View key={day} style={[styles.scheduleRow, entry.open ? styles.opacity1 : styles.opacity05]}> 
                  <Text style={styles.dayLabel}>{day}</Text>
                  <View style={styles.switchContainer}>
                    <Switch
                      value={entry.open}
                      onValueChange={(val) => setHoursSchedule((prev) => ({ ...prev, [day]: { ...prev[day], open: val } }))}
                      disabled={!isEditing}
                      trackColor={{ true: '#22C55E', false: '#9CA3AF' }}
                      ios_backgroundColor="#9CA3AF"
                      thumbColor={entry.open ? '#FFFFFF' : '#6B7280'}
                    />
                    <Text style={[styles.openIndicator, entry.open ? styles.openText : styles.closedText]}>{entry.open ? 'Open' : 'Closed'}</Text>
                  </View>

                  {entry.open ? (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setCurrentEditingTime({ day, field: 'start', currentValue: entry.start });
                          setTimePickerVisible(true);
                        }}
                        style={[styles.timeInput]}
                      >
                        <Text style={styles.timeInputText}>{entry.start}</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeSeparator}>to</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setCurrentEditingTime({ day, field: 'end', currentValue: entry.end });
                          setTimePickerVisible(true);
                        }}
                        style={[styles.timeInput]}
                      >
                        <Text style={styles.timeInputText}>{entry.end}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.flex1} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
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
          <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Edit Profile'}</Text>
        </TouchableOpacity>
      </View>

      <SaveModal visible={saveModalVisible} onClose={() => setSaveModalVisible(false)} />

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
    </ScrollView>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: 'red', fontSize: 16, fontWeight: '500' },

  profilePictureSection: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
  profilePictureContainer: { position: 'relative' },
  profilePicture: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  profileInitial: { fontSize: 40, fontWeight: 'bold', color: '#666' },
  editIconButton: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff'
  },
  editIcon: { fontSize: 16, color: '#fff' },
  profileImage: { width: '100%', height: '100%', borderRadius: 50 },

  editProfileTitle: { fontSize: 22, fontWeight: '700', color: '#333', textAlign: 'center', marginTop: 12 },

  formSection: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 22, marginTop: 12
  },

  inputGroup: { marginBottom: 18 },
  label: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, backgroundColor: '#F9FAFB', color: '#374151'
  },
  inputDisabled: { backgroundColor: '#F5F5F5', color: '#666' },
  readOnlyInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8F8F8'
  },
  readOnlyText: { fontSize: 16, color: '#666' },

  contactInputContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, backgroundColor: '#F9FAFB', overflow: 'hidden'
  },
  contactPrefix: { fontSize: 16, color: '#374151', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#E5E7EB', borderRightWidth: 1, borderRightColor: '#D1D5DB' },
  contactInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#374151' },

  saveButton: {
    backgroundColor: '#4CAF50', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 20, marginBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  scheduleContainer: { backgroundColor: '#fff' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'nowrap' },
  dayLabel: { width: 80, fontSize: 14, color: '#374151' },
  switchContainer: { width: 50, alignItems: 'center' },
  timeInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    width: 88, backgroundColor: '#F9FAFB', color: '#374151'
  },
  timeInputText: { color: '#374151', fontSize: 14 },
  timeSeparator: { marginHorizontal: 8, color: '#6B7280' },
  openIndicator: { marginLeft: 8, fontSize: 14 },
  openText: { color: '#22C55E', fontWeight: '600' },
  closedText: { color: '#9CA3AF', fontWeight: '600' },

  /* Save modal styles (compact) */
/* Add these styles (replace or merge into your StyleSheet) */
  /* backdrop dims the screen and centers the card */
  saveModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  /* the white card */
  saveModalCard: {
    width: 300,
    maxWidth: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  saveModalIcon: {
    marginBottom: 10,
  },
  saveModalTitle: {
    fontSize: 20,
    color: '#22C55E',
    fontWeight: '700',
    marginBottom: 6,
  },
  saveModalMessage: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  saveModalOkButton: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 26,
  },
  saveModalOkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  /* icon wrapper: renders Ionicons and a fallback layered on top (fallback visible if font shows as glyph box) */
  iconWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* fallback circle behind/check — will match icon size and style */
  iconFallbackContainer: {
    position: 'absolute',
    backgroundColor: '#E6F9EE',
    borderWidth: 2,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    color: '#22C55E',
    fontWeight: '800',
  },


  /* time picker */
  timePickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  timePickerContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '86%', maxWidth: 380, elevation: 8 },
  timePickerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  timePickerContent: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 250, marginBottom: 20, position: 'relative' },
  pickerColumn: { flex: 1, height: 250, position: 'relative' },
  pickerScrollContent: { paddingVertical: VERTICAL_PADDING },
  pickerItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { fontSize: 28, color: '#B0B0B0', fontWeight: '400' },
  pickerItemTextSelected: { fontSize: 34, color: '#111', fontWeight: '800' },
  pickerHighlight: { position: 'absolute', top: '50%', left: 8, right: 8, height: ITEM_HEIGHT, marginTop: -ITEM_HEIGHT / 2, backgroundColor: 'rgba(232,245,233,0.9)', borderRadius: 8, zIndex: -1 },
  timeSeparatorColon: { fontSize: 32, color: '#1F2937', fontWeight: '600', marginHorizontal: 8 },
  timePickerButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  timePickerCancelButton: { flex: 1, paddingVertical: 12, marginRight: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center' },
  timePickerCancelText: { fontSize: 16, color: '#666' },
  timePickerConfirmButton: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4CAF50', alignItems: 'center' },
  timePickerConfirmText: { fontSize: 16, color: '#fff', fontWeight: 'bold' }
});

export default ShopProfileScreen;
