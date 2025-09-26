import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, Image, Alert, Platform, PermissionsAndroid } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { launchImageLibrary, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import OperatingHoursModal from '../../OperatingHoursModal';

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

interface OperatingHours {
  [key: string]: {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  };
}

const ShopProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({});
  const [formData, setFormData] = useState({
    stallNo: '',
    businessName: '',
    contactNo: '',
    operatingHours: '5:00 AM - 5:00 PM (Mon-Sun)'
  });

  useEffect(() => {
    const fetchVendorProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please login to view profile');
          setLoading(false);
          return;
        }

        // Fetch current vendor profile with stall information
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select('*')
          .eq('auth_user_id', user.id)
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
          operatingHours: '5:00 AM - 5:00 PM (Mon-Sun)'
        });

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

    // Request permission for Android
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your photos to select a profile picture.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Cannot access photos without permission.');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }

    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as PhotoQuality,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        setProfileImage(response.assets[0].uri || null);
      }
    });
  };

  const formatOperatingHours = (hours: OperatingHours): string => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const openDays = daysOfWeek.filter(day => hours[day]?.isOpen);
    
    if (openDays.length === 0) {
      return 'Closed';
    }
    
    if (openDays.length === 7) {
      const firstDay = hours[daysOfWeek[0]];
      const formatTime = (time: string) => {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      };
      return `${formatTime(firstDay.openTime)} - ${formatTime(firstDay.closeTime)} (Daily)`;
    }
    
    // For mixed schedules, show a summary
    return `${openDays.length} days open`;
  };

  const handleOperatingHoursSave = (hours: OperatingHours) => {
    setOperatingHours(hours);
    const formattedHours = formatOperatingHours(hours);
    setFormData(prev => ({
      ...prev,
      operatingHours: formattedHours
    }));
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
                {vendor.first_name?.charAt(0) || 'V'}
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
            onChangeText={(text) => setFormData({...formData, businessName: text})}
            placeholder="Enter business name"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contact No.</Text>
          <TextInput
            style={[styles.input, !isEditing && styles.inputDisabled]}
            value={formData.contactNo}
            onChangeText={(text) => setFormData({...formData, contactNo: text})}
            placeholder="Enter contact number"
            keyboardType="phone-pad"
            editable={isEditing}
          />
        </View>

        {/* Operating Hours Section with right-aligned Edit */}
        <View style={styles.inputGroup}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>Operating Hours</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.operatingHoursContainer}>
            <OperatingHoursModal
              visible={true}
              onClose={() => setIsEditing(false)}
              onSave={handleOperatingHoursSave}
              initialHours={operatingHours}
              embedded={true}
              disabled={!isEditing}
            />
          </View>
        </View>

        {/* Save/Edit Toggle Button */}
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={() => setIsEditing(!isEditing)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#666',
  },
  inputText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  inputTextDisabled: {
    color: '#666',
  },
  inputArrow: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  operatingHoursContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 8,
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
});

export default ShopProfileScreen;
