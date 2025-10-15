import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, Image, Alert, Platform, PermissionsAndroid, Switch } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { SessionManager } from '../../../utils/sessionManager';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopProfile'>;

interface VendorProfile {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  business_type: string;
  phone_number?: string;
  products_services_description?: string;
  stall?: {
    stall_number: string;
    location_description?: string;
  };
}

const ShopProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Get the current session to show logged-in user's info
  const session = SessionManager.getSession();
  const [formData, setFormData] = useState({
    stallNo: '',
    businessName: '',
    contactNo: '',
    // store a compact representation (JSON string) of the schedule
    operatingHours: ''
  });

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const createInitialSchedule = () => {
    const base: Record<string, { open: boolean; start: string; end: string }> = {};
    DAYS.forEach((d) => {
      if (d === 'Saturday' || d === 'Sunday') {
        base[d] = { open: false, start: '9:00 AM', end: '5:00 PM' };
      } else {
        base[d] = { open: true, start: '9:00 AM', end: '5:00 PM' };
      }
    });
    return base;
  };

  const [hoursSchedule, setHoursSchedule] = useState<Record<string, { open: boolean; start: string; end: string }>>(createInitialSchedule());
  const [openDropdown, setOpenDropdown] = useState<{ day: string | null; field: 'start' | 'end' | null }>({ day: null, field: null });

  const TIMES_AM = [
    '6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM'
  ];

  const TIMES_PM = [
    '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM'
  ];

  const selectTime = (day: string, field: 'start' | 'end', value: string) => {
    setHoursSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setOpenDropdown({ day: null, field: null });
  };

  useEffect(() => {
    const fetchVendorProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the current logged-in vendor from session
        const session = SessionManager.getSession();
        console.log('ShopProfile session:', session);
        if (!session) {
          console.log('No session found in shop profile');
          setError('Please login to view profile');
          setLoading(false);
          return;
        }

        // Fetch current vendor profile with stall information
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select('*')
          .eq('id', session.vendorId)
          .single();

        if (vendorError) {
          console.error('Vendor error:', vendorError);
          setError('Failed to load vendor profile');
          setLoading(false);
          return;
        }

        // Fetch stall information separately
        let stallData = null;
        if (vendorData?.id) {
          const { data: stalls } = await supabase
            .from('stalls')
            .select('stall_number, location_description')
            .eq('vendor_profile_id', vendorData.id)
            .maybeSingle();

          stallData = stalls;
        }

        // Combine vendor and stall data
        const vendorWithStall = {
          ...vendorData,
          stall: stallData
        };

        setVendor(vendorWithStall);
        setFormData({
          stallNo: stallData?.stall_number || '',
          businessName: vendorData.business_name || '',
          contactNo: vendorData.phone_number || '',
          operatingHours: vendorData?.operating_hours || ''
        });

        // restore profile image if saved
        if (vendorData?.profile_image_url) {
          setProfileImage(vendorData.profile_image_url);
        } else if (session?.vendorId) {
          try {
            const b64 = await AsyncStorage.getItem(`vendor_avatar_${session.vendorId}`);
            if (b64) setProfileImage(`data:image/jpeg;base64,${b64}`);
          } catch (e) {
            // ignore
          }
        }

        // restore hours schedule if saved (stored as JSON string)
        if (vendorData?.operating_hours) {
          try {
            const parsed = JSON.parse(vendorData.operating_hours);
            // validate parsed shape minimally
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
  }, []);

  const handleImagePicker = async () => {
    if (!isEditing) return;

    const chooseLibrary = async () => {
      try {
        const options = {
          mediaType: 'photo' as MediaType,
          includeBase64: true,
          maxHeight: 2000,
          maxWidth: 2000,
          quality: 0.8 as PhotoQuality,
        };
        launchImageLibrary(options, async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage) return;
          if (response.assets && response.assets[0]) {
            const asset = response.assets[0];
            if (asset.base64 && session?.vendorId) {
              try {
                await AsyncStorage.setItem(`vendor_avatar_${session.vendorId}`, asset.base64);
                setProfileImage(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
              } catch (e) {
                console.warn('Failed to save avatar locally', e);
                setProfileImage(asset.uri || null);
              }
            } else {
              setProfileImage(asset.uri || null);
            }
          }
        });
      } catch (err) {
        console.warn('Library pick failed', err);
      }
    };

    const takePhoto = async () => {
      try {
        // Request camera permission on Android
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: 'Camera Permission',
            message: 'App needs access to your camera to take a profile picture.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          });
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission denied', 'Cannot use camera without permission.');
            return;
          }
        }

        const options = {
          mediaType: 'photo' as MediaType,
          includeBase64: true,
          maxHeight: 2000,
          maxWidth: 2000,
          quality: 0.8 as PhotoQuality,
          saveToPhotos: true,
        };
        launchCamera(options, async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage) return;
          if (response.assets && response.assets[0]) {
            const asset = response.assets[0];
            if (asset.base64 && session?.vendorId) {
              try {
                await AsyncStorage.setItem(`vendor_avatar_${session.vendorId}`, asset.base64);
                setProfileImage(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
              } catch (e) {
                console.warn('Failed to save avatar locally', e);
                setProfileImage(asset.uri || null);
              }
            } else {
              setProfileImage(asset.uri || null);
            }
          }
        });
      } catch (err) {
        console.warn('Camera failed', err);
      }
    };

    // Present simple choice
    Alert.alert('Upload Photo', 'Choose photo source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      // serialize schedule into formData
      const serialized = JSON.stringify(hoursSchedule);
      setFormData((prev) => ({ ...prev, operatingHours: serialized }));

      let publicUrl: string | null = null;
      if (profileImage) {
        try {
          // fetch the local file and convert to blob
          const response = await fetch(profileImage);
          const blob = await response.blob();
          const filename = `avatars/${session?.vendorId || 'unknown'}_${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('vendor-avatars').upload(filename, blob, { upsert: true });
          if (uploadError) {
            console.warn('Upload error', uploadError);
          } else {
            const { data } = supabase.storage.from('vendor-avatars').getPublicUrl(filename);
            publicUrl = data?.publicUrl || null;
          }
        } catch (err) {
          console.warn('Failed to upload profile image', err);
        }
      }

      // prepare update payload
      const payload: any = {
        business_name: formData.businessName,
        phone_number: formData.contactNo,
        operating_hours: serialized, // Always save the serialized schedule
      };
      if (publicUrl) payload.profile_image_url = publicUrl;

      if (!session?.vendorId) {
        throw new Error('No vendor session found');
      }

      console.log('📝 Updating vendor profile with payload:', payload);
      console.log('🔑 Session vendorId:', session.vendorId);
      console.log('👤 Current auth user:', (await supabase.auth.getUser()).data.user?.id);
      
      const { data: updateData, error: updateError } = await supabase
        .from('vendor_profiles')
        .update(payload)
        .eq('id', session.vendorId)
        .select();

      console.log('Update response:', { updateData, updateError });

      if (updateError) {
        console.error('Failed to update vendor profile', updateError);
        Alert.alert('Save failed', 'Could not save profile. Please try again.');
      } else if (!updateData || updateData.length === 0) {
        console.error('No rows updated - possible RLS issue or wrong vendorId');
        Alert.alert('Save failed', 'No changes were saved. Please check permissions.');
      } else {
        // update local vendor state
        setVendor((prev) => prev ? ({ ...prev, business_name: formData.businessName, phone_number: formData.contactNo, /* keep other fields */ }) : prev);
        if (publicUrl) setProfileImage(publicUrl);
        // update session so other screens (like dashboard) can reflect the change immediately
        try {
          const current = SessionManager.getSession();
          if (current) {
            SessionManager.setSession({ ...current, businessName: formData.businessName });
          }
        } catch (e) {
          // ignore
        }
        Alert.alert('Saved', 'Profile updated successfully', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to dashboard to trigger refresh
              navigation.goBack();
            }
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred while saving.');
    }
    setLoading(false);
  };

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
    <ScrollView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Picture Section */}
      <View style={styles.profilePictureSection}>
        <View style={styles.profilePictureContainer}>
          <TouchableOpacity
            style={styles.profilePicture}
            onPress={handleImagePicker}
            disabled={!isEditing}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileInitial}>
                {session?.firstName?.charAt(0) || 'V'}
              </Text>
            )}
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity
              style={styles.editIconButton}
              onPress={handleImagePicker}
            >
              <Text style={styles.editIcon}>📷</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Edit Profile Title */}
      <Text style={styles.editProfileTitle}>Edit Profile</Text>

      {/* Form Section */}
      <View style={styles.formSection}>
        {/* Logged-in User Info */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Logged in as</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>
              {session?.firstName} {session?.lastName}
              {session?.isActualOccupant ? ' (Actual Occupant)' : ' (Vendor)'}
            </Text>
          </View>
        </View>

        {/* Show vendor info if logged in as actual occupant */}
        {session?.isActualOccupant && vendor && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vendor</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{vendor.first_name} {vendor.last_name}</Text>
            </View>
          </View>
        )}
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
          <TextInput
            style={[styles.input, !isEditing && styles.inputDisabled]}
            value={formData.contactNo}
            onChangeText={(text) => setFormData({ ...formData, contactNo: text })}
            placeholder="Enter contact number"
            keyboardType="phone-pad"
            editable={isEditing}
          />
        </View>

        {/* Operating Hours Schedule */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Operating Hours</Text>
          <View style={styles.scheduleContainer}>
            {DAYS.map((day) => {
              const entry = hoursSchedule[day];
              if (!isEditing) {
                // read-only mode: no switches, just show day and times (or Closed)
                return (
                  <View key={day} style={styles.scheduleRow}>
                    <Text style={styles.dayLabel}>{day}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {entry.open ? (
                        <>
                          <View style={[styles.timeInput, { justifyContent: 'center' }]}>
                            <Text style={styles.timeInputText}>{entry.start}</Text>
                          </View>
                          <Text style={styles.timeSeparator}>to</Text>
                          <View style={[styles.timeInput, { justifyContent: 'center' }]}>
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

              // edit mode: interactive controls
              return (
                <View key={day} style={[styles.scheduleRow, { opacity: entry.open ? 1 : 0.5 }] }>
                  <Text style={styles.dayLabel}>{day}</Text>
                  <View style={styles.switchContainer}>
                    <Switch
                      value={entry.open}
                      onValueChange={(val) => {
                        if (!isEditing) return;
                        setHoursSchedule((prev) => ({ ...prev, [day]: { ...prev[day], open: val } }));
                      }}
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
                          if (!isEditing) return;
                          setOpenDropdown({ day, field: 'start' });
                        }}
                        style={[styles.timeInput]}
                      >
                        <Text style={styles.timeInputText}>{entry.start}</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeSeparator}>to</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isEditing) return;
                          setOpenDropdown({ day, field: 'end' });
                        }}
                        style={[styles.timeInput]}
                      >
                        <Text style={styles.timeInputText}>{entry.end}</Text>
                      </TouchableOpacity>

                      {openDropdown.day === day && openDropdown.field && (
                        <View style={styles.dropdownBox}>
                          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                            {(openDropdown.field === 'start' ? TIMES_AM : TIMES_PM).map((t) => (
                              <TouchableOpacity key={t} style={styles.dropdownItem} onPress={() => selectTime(day, openDropdown.field as 'start' | 'end', t)}>
                                <Text style={styles.dropdownItemText}>{t}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  ) : (
                    // when closed, hide times to keep UI clean
                    <View style={{ flex: 1 }} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        

        {/* Save/Edit Toggle Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={async () => {
            if (isEditing) {
              // user is saving changes: persist schedule into formData as JSON and save
              try {
                const serialized = JSON.stringify(hoursSchedule);
                setFormData((prev) => ({ ...prev, operatingHours: serialized }));
              } catch (e) {
                console.warn('Failed to serialize hours schedule', e);
              }
              await saveProfile();
            }
            setIsEditing(!isEditing);
          }}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  profilePictureSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineToggle: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineToggleActive: {
    backgroundColor: '#fff',
  },
  onlineKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    position: 'absolute',
    left: 2,
  },
  onlineKnobActive: {
    left: 26,
    backgroundColor: '#22C55E',
  },
  onlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#666',
  },
  editIconButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editIcon: {
    fontSize: 16,
    color: '#fff',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  editProfileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  greeting: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  editButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  formSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 25,
    marginTop: -10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#374151',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#666',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
  },
  paymentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  paymentBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentBtnIcon: {
    backgroundColor: '#F3F4F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentIconText: {
    fontSize: 18,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  qrCodePlaceholder: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  qrText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  qrSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  /* Operating hours schedule styles */
  scheduleContainer: {
    backgroundColor: '#fff'
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
    flexWrap: 'nowrap',
  },
  dayLabel: {
    width: 80,
    fontSize: 14,
    color: '#374151',
  },
  switchContainer: {
    width: 50,
    alignItems: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 88,
    backgroundColor: '#F9FAFB',
    color: '#374151',
  },
  timeSeparator: {
    marginHorizontal: 8,
    color: '#6B7280',
  },
  openIndicator: {
    marginLeft: 8,
    fontSize: 14,
  },
  openText: {
    color: '#22C55E',
    fontWeight: '600',
  },
  closedText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  timeInputText: {
    color: '#374151',
    fontSize: 14,
  },
  dropdownBox: {
    position: 'absolute',
    top: 42,
  right: 20,
  width: 120,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    maxHeight: 220,
    zIndex: 999,
    // shadow / elevation for prominence
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
});

export default ShopProfileScreen;
