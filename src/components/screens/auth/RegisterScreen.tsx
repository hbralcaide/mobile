import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  // ...existing code...
  // Market section dropdown
  const [marketSections, setMarketSections] = useState<{ id: number; name: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [marketSectionLoading, setMarketSectionLoading] = useState(true);
  const [marketSectionError, setMarketSectionError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchMarketSections = async () => {
      setMarketSectionLoading(true);
      setMarketSectionError(null);
      const { data, error } = await supabase
        .from('market_sections')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) {
        setMarketSectionError('Failed to load market sections');
        setMarketSections([]);
      } else if (Array.isArray(data)) {
        setMarketSections(data);
        console.log('Fetched market sections:', data);
      } else {
        setMarketSections([]);
      }
      setMarketSectionLoading(false);
    };
    fetchMarketSections();
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [actualOccupant, setActualOccupant] = useState('');
  const [actualOccupantFirstName, setActualOccupantFirstName] = useState('');
  const [actualOccupantLastName, setActualOccupantLastName] = useState('');
  const [actualOccupantUsername, setActualOccupantUsername] = useState('');
  const [actualOccupantPhone, setActualOccupantPhone] = useState('');
  const [showActualOccupant, setShowActualOccupant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Auto-capitalize first letter
  const handleFirstNameChange = (text: string) => {
    if (!text) {
      setFirstName('');
      generateUsername('', lastName);
      return;
    }
    const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    setFirstName(capitalized);
    generateUsername(capitalized, lastName);
  };

  const handleLastNameChange = (text: string) => {
    if (!text) {
      setLastName('');
      generateUsername(firstName, '');
      return;
    }
    const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    setLastName(capitalized);
    generateUsername(firstName, capitalized);
  };

  const handleActualOccupantFirstNameChange = (text: string) => {
    if (!text) {
      setActualOccupantFirstName('');
      updateActualOccupantFullName('', actualOccupantLastName);
      return;
    }
    const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    setActualOccupantFirstName(capitalized);
    updateActualOccupantFullName(capitalized, actualOccupantLastName);
  };

  const handleActualOccupantLastNameChange = (text: string) => {
    if (!text) {
      setActualOccupantLastName('');
      updateActualOccupantFullName(actualOccupantFirstName, '');
      return;
    }
    const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    setActualOccupantLastName(capitalized);
    updateActualOccupantFullName(actualOccupantFirstName, capitalized);
  };

  const updateActualOccupantFullName = (first: string, last: string) => {
    try {
      const fullName = `${first} ${last}`.trim();
      setActualOccupant(fullName);
      
      if (first && last) {
        generateActualOccupantUsernameFromNames(first, last);
      } else {
        setActualOccupantUsername('');
        if (!first && !last) {
          setActualOccupantPhone('');
        }
      }
    } catch (error) {
      console.error('Error updating actual occupant full name:', error);
    }
  };

  const handleActualOccupantToggle = (value: boolean) => {
    setShowActualOccupant(value);
    
    if (!value) {
      // Clear all actual occupant fields when toggle is turned off
      setActualOccupantFirstName('');
      setActualOccupantLastName('');
      setActualOccupant('');
      setActualOccupantUsername('');
      setActualOccupantPhone('');
    }
  };

  const handleActualOccupantPhoneChange = (text: string) => {
    try {
      // Remove all non-digit characters
      const digitsOnly = text.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = digitsOnly.slice(0, 10);
      
      // Format as Philippine mobile number (xxx xxx xxxx)
      let formatted = limitedDigits;
      if (limitedDigits.length >= 3) {
        formatted = limitedDigits.slice(0, 3);
        if (limitedDigits.length >= 6) {
          formatted += ' ' + limitedDigits.slice(3, 6);
          if (limitedDigits.length > 6) {
            formatted += ' ' + limitedDigits.slice(6);
          }
        } else if (limitedDigits.length > 3) {
          formatted += ' ' + limitedDigits.slice(3);
        }
      }
      
      setActualOccupantPhone(formatted);
    } catch (error) {
      console.error('Error formatting actual occupant phone number:', error);
      setActualOccupantPhone(text);
    }
  };

  // Generate username: first letter of firstname + full lastname (lowercase)
  const generateUsername = (first: string, last: string) => {
    if (!first || !last) {
      setUsername('');
      return;
    }

    try {
      // Remove spaces and special characters from last name
      const cleanLastName = last.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const baseUsername = `${first.charAt(0).toLowerCase()}${cleanLastName}`;
      
      // For demo purposes, we'll just use the base username
      // In a real app, you'd check against existing usernames in the database
      setUsername(baseUsername);
    } catch (error) {
      console.error('Error generating username:', error);
      setUsername('');
    }
  };

  // Generate username for actual occupant from separate first and last names
  const generateActualOccupantUsernameFromNames = (first: string, last: string) => {
    if (!first || !last) {
      setActualOccupantUsername('');
      return;
    }

    try {
      // Remove spaces and special characters from last name
      const cleanLastName = last.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const baseUsername = `${first.charAt(0).toLowerCase()}${cleanLastName}`;
      
      setActualOccupantUsername(baseUsername);
    } catch (error) {
      console.error('Error generating actual occupant username:', error);
      setActualOccupantUsername('');
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    try {
      // Remove all non-digit characters
      const digitsOnly = text.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = digitsOnly.slice(0, 10);
      
      // Format as Philippine mobile number (xxx xxx xxxx)
      let formatted = limitedDigits;
      if (limitedDigits.length >= 3) {
        formatted = limitedDigits.slice(0, 3);
        if (limitedDigits.length >= 6) {
          formatted += ' ' + limitedDigits.slice(3, 6);
          if (limitedDigits.length > 6) {
            formatted += ' ' + limitedDigits.slice(6);
          }
        } else if (limitedDigits.length > 3) {
          formatted += ' ' + limitedDigits.slice(3);
        }
      }
      
      setPhoneNumber(formatted);
    } catch (error) {
      console.error('Error formatting phone number:', error);
      setPhoneNumber(text);
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);

      // Basic validation
      if (!email || !password || !confirmPassword || !firstName || !lastName || !username || !phoneNumber) {
        Alert.alert('Error', 'Please fill out all required fields');
        return;
      }
      if (!selectedSection) {
        Alert.alert('Error', 'Please select the market section for your products');
        return;
      }
      // Only require actualOccupant (description) if you want it to be required, otherwise remove from required fields

      // Validate phone numbers
      const phoneDigits = phoneNumber.replace(/\D/g, '');
      
      if (phoneDigits.length !== 10) {
        Alert.alert('Error', 'Your phone number must be exactly 10 digits');
        return;
      }

      // Only validate actual occupant fields if toggle is enabled
      if (showActualOccupant) {
        if (!actualOccupantFirstName || !actualOccupantLastName || !actualOccupantUsername || !actualOccupantPhone) {
          Alert.alert('Error', 'Please fill out all actual occupant fields');
          return;
        }
        const actualOccupantPhoneDigits = actualOccupantPhone.replace(/\D/g, '');
        if (actualOccupantPhoneDigits.length !== 10) {
          Alert.alert('Error', 'Actual occupant phone number must be exactly 10 digits');
          return;
        }
      }

      if (password.length < 8) {
        Alert.alert('Error', 'Password must be at least 8 characters long');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      // Sign up with Supabase
      console.log('Starting signup process...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Disable email confirmation for mobile vendors
          // Admin handles approval manually
          emailRedirectTo: undefined,
          data: {
            role: 'vendor',
            user_type: 'vendor',
            first_name: firstName,
            last_name: lastName,
          },
        }
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        if (error.message.includes('User already registered')) {
          Alert.alert(
            'Account Already Exists',
            'An account with this email already exists. Please try logging in instead.',
            [
              {
                text: 'Go to Login',
                onPress: () => navigation.navigate('Login')
              },
              { text: 'Try Different Email' }
            ]
          );
          return;
        }
        if (error.message.includes('email not confirmed')) {
          Alert.alert(
            'Email Confirmation Required',
            'Please check your email and click the confirmation link to complete your registration.',
            [
              {
                text: 'Resend Email',
                onPress: async () => {
                  try {
                    const { error: resendError } = await supabase.auth.resend({
                      type: 'signup',
                      email: email,
                    });
                    if (resendError) {
                      Alert.alert('Error', 'Failed to resend confirmation email.');
                    } else {
                      Alert.alert('Success', 'Confirmation email resent! Please check your inbox.');
                    }
                  } catch (resendErr) {
                    console.error('Resend error:', resendErr);
                    Alert.alert('Error', 'Failed to resend confirmation email.');
                  }
                }
              },
              { text: 'OK' }
            ]
          );
          return;
        }
        throw new Error(error.message);
      }

      if (data?.user) {
        console.log('User created successfully:', data.user);
        
        // Create vendor profile record
        const vendorProfileData = {
          auth_user_id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone_number: `+63${phoneDigits}`,
          business_name: actualOccupant || `${firstName} ${lastName}'s Business`,
          business_type: 'General',
          username: username,
          role: 'vendor',
          status: 'Pending',
          application_status: 'pending',
          signup_method: 'self_registration',
          products_services_description: actualOccupant,
          market_section_id: selectedSection,
          ...(showActualOccupant && actualOccupantFirstName.trim().length > 0 && actualOccupantLastName.trim().length > 0 && {
            actual_occupant_first_name: actualOccupantFirstName,
            actual_occupant_last_name: actualOccupantLastName,
            actual_occupant_username: actualOccupantUsername,
            actual_occupant_phone: `+63${actualOccupantPhone.replace(/\D/g, '')}`,
          }),
        };

        console.log('Creating vendor profile:', vendorProfileData);

        const { data: profileData, error: profileError } = await supabase
          .from('vendor_profiles')
          .insert(vendorProfileData)
          .select();

        if (profileError) {
          console.error('Error creating vendor profile:', profileError);
          Alert.alert('Warning', 'User created but profile creation failed. Please contact support.');
        } else {
          console.log('Vendor profile created successfully:', profileData);
        }
        
        setShowSuccessModal(true);
        
        // Don't show the modal, go directly to login
        // setShowSuccessModal(true);
      } else {
        throw new Error('Failed to submit application');
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unexpected error occurred during registration');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Apply as Vendor</Text>
          <Text style={styles.subtitle}>Join Mapalengke marketplace</Text>
        </View>
        
        <View style={styles.form}>
          {/* Market Section Dropdown */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Market Section</Text>
            <Text style={styles.productsLabel}>Select the section that matches your products</Text>
            <View style={styles.dropdownContainer}>
              {marketSectionLoading ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : marketSectionError ? (
                <Text style={styles.errorText}>{marketSectionError}</Text>
              ) : (
                <Picker
                  selectedValue={selectedSection}
                  onValueChange={(itemValue: string) => setSelectedSection(itemValue)}
                  style={styles.dropdown}
                >
                  <Picker.Item label="Select section..." value="" />
                  {marketSections.map(section => (
                    <Picker.Item key={section.id} label={section.name} value={section.id.toString()} />
                  ))}
                </Picker>
              )}
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={handleFirstNameChange}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Enter your first name"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={handleLastNameChange}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Enter your last name"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              value={username}
              editable={false}
              placeholder="Auto-generated username"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Enter your email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>+63</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                keyboardType="numeric"
                placeholder="xxx xxx xxxx"
                maxLength={13} // xxx xxx xxxx with spaces
              />
            </View>
          </View>

          <View style={styles.sectionSeparator}>
            <View style={styles.toggleContainer}>
              <View style={styles.toggleTextContainer}>
                <Text style={styles.sectionTitle}>Actual Stall Occupant Information</Text>
                <Text style={styles.sectionSubtitle}>
                  Enable if someone else will be operating the stall
                </Text>
              </View>
              <Switch
                value={showActualOccupant}
                onValueChange={handleActualOccupantToggle}
                trackColor={{ false: '#E5E5E5', true: '#667eea' }}
                thumbColor={showActualOccupant ? '#fff' : '#fff'}
                ios_backgroundColor="#E5E5E5"
              />
            </View>
          </View>

          {showActualOccupant && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Actual Occupant First Name</Text>
                <TextInput
                  style={styles.input}
                  value={actualOccupantFirstName}
                  onChangeText={handleActualOccupantFirstNameChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="First name of person who will operate the stall"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Actual Occupant Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={actualOccupantLastName}
                  onChangeText={handleActualOccupantLastNameChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Last name of person who will operate the stall"
                />
              </View>

              {(actualOccupantFirstName.trim().length > 0 && actualOccupantLastName.trim().length > 0) && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Actual Occupant Username</Text>
                    <TextInput
                      style={[styles.input, styles.usernameInput]}
                      value={actualOccupantUsername}
                      editable={false}
                      placeholder="Auto-generated username for occupant"
                    />
                    <Text style={styles.usernameHint}>
                      Generated from actual occupant's name
                    </Text>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Actual Occupant Mobile Number</Text>
                    <View style={styles.phoneInputContainer}>
                      <View style={styles.countryCodeBox}>
                        <Text style={styles.countryCodeText}>+63</Text>
                      </View>
                      <TextInput
                        style={styles.phoneInput}
                        value={actualOccupantPhone}
                        onChangeText={handleActualOccupantPhoneChange}
                        keyboardType="numeric"
                        placeholder="xxx xxx xxxx"
                        maxLength={13} // xxx xxx xxxx with spaces
                      />
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your password"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Confirm your password"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit Application</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    {/* Success Modal */}
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalIcon}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          
          <Text style={styles.modalTitle}>Application Submitted!</Text>
          
          <Text style={styles.modalMessage}>
            Thank you for applying to become a vendor at Mapalengke! 
            {'\n\n'}
            Your application has been submitted successfully. 
            {'\n\n'}
            Please wait for our admin team to review and accept your application. You can check your application status by logging in.
            {'\n\n'}
            <Text style={styles.modalNoteText}>
              Note: You can now log in with your credentials while waiting for approval.
            </Text>
          </Text>
          
          <TouchableOpacity 
            style={styles.modalButton}
            onPress={() => {
              setShowSuccessModal(false);
              navigation.replace('Login');
            }}
          >
            <Text style={styles.modalButtonText}>Continue to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: 'red',
    marginVertical: 8,
    fontSize: 14,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    marginBottom: 8,
  },
  dropdown: {
    height: 48,
    width: '100%',
  },
  productsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  productsCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  productsCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  productsCategoryButtonSelected: {
    backgroundColor: '#667eea',
  },
  productsCategoryText: {
    color: '#333',
    fontWeight: '500',
  },
  productsCategoryTextSelected: {
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  countryCodeBox: {
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  usernameInput: {
    backgroundColor: '#F8F9FA',
    color: '#6c757d',
  },
  usernameHint: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  sectionSeparator: {
    marginVertical: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 16,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalNoteText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  modalSecondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSecondaryButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default RegisterScreen;
