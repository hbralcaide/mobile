import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';
import { simpleHashPassword } from '../../../utils/simpleAuth';
import { SessionManager } from '../../../utils/sessionManager';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      if (!username || !password) {
        Alert.alert('Error', 'Please enter your username and password');
        return;
      }

      // Hash the entered password using SHA-256
      const passwordHash = simpleHashPassword(password);

      console.log('Login attempt for username:', username);
      console.log('Password entered:', password);
      console.log('Generated password hash:', passwordHash);

      // Test with known password and hash
      if (password === 'ranactae1') {
        const expectedHash = 'f6f6dbf89c77d3e3463a501e0523105709ce20ac1027b8a39576ca1d46d18cb5';
        console.log('Expected hash for ranactae1:', expectedHash);
        console.log('Generated hash matches expected:', passwordHash === expectedHash);
      }

      // Lookup vendor profile by username (check both main vendor and actual occupant)
      const { data: vendorProfile, error: profileError } = await supabase
        .from('vendor_profiles')
        .select('id, email, application_status, status, first_name, last_name, auth_user_id, password_hash, role, username, business_name, actual_occupant_first_name, actual_occupant_last_name, actual_occupant_username, actual_occupant_password_hash')
        .or(`username.eq.${username},actual_occupant_username.eq.${username}`)
        .single();

      if (profileError || !vendorProfile) {
        console.error('Profile lookup error:', profileError);
        Alert.alert('Error', 'Invalid username or password.');
        return;
      }

      console.log('Found vendor profile:', {
        id: vendorProfile.id,
        username: username,
        status: vendorProfile.status,
        application_status: vendorProfile.application_status
      });

      // Check if logging in as main vendor or actual occupant
      const isActualOccupant = vendorProfile.actual_occupant_username === username;
      const expectedHash = isActualOccupant ? vendorProfile.actual_occupant_password_hash : vendorProfile.password_hash;

      console.log('Login type:', isActualOccupant ? 'Actual Occupant' : 'Main Vendor');
      console.log('Database password hash:', expectedHash);
      console.log('Generated password hash:', passwordHash);
      console.log('Hashes match:', expectedHash === passwordHash);

      // Verify password hash
      if (expectedHash !== passwordHash) {
        Alert.alert(
          'Login Failed',
          `Invalid username or password.\n\nDebug Info:\nEntered password: ${password}\nGenerated hash: ${passwordHash.substring(0, 20)}...\nStored hash: ${expectedHash?.substring(0, 20) || 'null'}...\n\nPlease contact admin if this persists.`
        );
        return;
      }

      console.log('Password verified successfully');

      // Set the session for the logged-in user (either main vendor or actual occupant)
      if (isActualOccupant) {
        SessionManager.setSession({
          username: vendorProfile.actual_occupant_username,
          vendorId: vendorProfile.id,
          firstName: vendorProfile.actual_occupant_first_name,
          lastName: vendorProfile.actual_occupant_last_name,
          businessName: vendorProfile.business_name,
          isActualOccupant: true
        });
      } else {
        SessionManager.setSession({
          username: vendorProfile.username,
          vendorId: vendorProfile.id,
          firstName: vendorProfile.first_name,
          lastName: vendorProfile.last_name,
          businessName: vendorProfile.business_name,
          isActualOccupant: false
        });
      }

      // Since application process is handled on the website, 
      // mobile app should just allow login for valid credentials
      console.log('Login successful, navigating to dashboard');
      navigation.replace('VendorDashboard');

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    Alert.alert(
      'Password Reset',
      'Password reset functionality is currently unavailable. Please contact support for assistance with password recovery.',
      [
        { text: 'OK' },
        {
          text: 'Contact Support',
          onPress: () => {
            // You can add contact support functionality here
            Alert.alert('Contact Support', 'Please email support@mapalengke.com or call +63-xxx-xxxx for password reset assistance.');
          }
        }
      ]
    );
  };

  // const handleCheckStatus = async () => {
  //   if (!username) {
  //     Alert.alert('Check Status', 'Please enter your username above first.');
  //     return;
  //   }
  //   const { data: statusProfile } = await supabase
  //     .from('vendor_profiles')
  //     .select('application_status, status, first_name, last_name')
  //     .eq('username', username)
  //     .single();
  //   if (!statusProfile) {
  //     Alert.alert('Status Not Found', 'No vendor application found for this username. Please check your username or register as a vendor.');
  //     return;
  //   }
  //   const { application_status: statusApp, status: statusVal, first_name: statusFirst, last_name: statusLast } = statusProfile;
  //   if (statusApp === 'pending' || statusVal === 'Pending') {
  //     Alert.alert('Application Under Review', `Hello ${statusFirst} ${statusLast}! Your vendor application is currently under review by our admin team. Please check back later or contact support for updates.`);
  //   } else if (statusApp === 'approved' || statusVal === 'Active') {
  //     Alert.alert('Application Approved!', `Welcome ${statusFirst} ${statusLast}! Your vendor application has been approved. You can now log in.`);
  //   } else if (statusApp === 'rejected' || statusVal === 'Rejected') {
  //     Alert.alert('Application Not Approved', `Sorry ${statusFirst} ${statusLast}, your vendor application was not approved at this time. Please contact our support team for more information.`);
  //   } else {
  //     Alert.alert('Unknown Status', 'Your application status could not be determined. Please contact support.');
  //   }
  // };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>Log in to</Text>
          <Text style={styles.subtitle}>Mapalengke!</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your username"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter your password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeButtonText}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </TouchableOpacity>

          {/* <TouchableOpacity 
            style={styles.statusButton}
            onPress={handleCheckStatus}
          >
            <Text style={styles.statusButtonText}>Check Application Status</Text>
          </TouchableOpacity> */}

          {/* <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>or</Text>
            <View style={styles.separatorLine} />
          </View>

          <TouchableOpacity 
            style={styles.vendorButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.vendorButtonText}>Apply as Vendor</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 40,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#333',
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    padding: 16,
    paddingLeft: 8,
  },
  eyeButtonText: {
    fontSize: 18,
  },
  forgotText: {
    color: '#666',
    fontSize: 14,
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
  // statusButton: {
  //   borderWidth: 1,
  //   borderColor: '#3b82f6',
  //   paddingVertical: 12,
  //   borderRadius: 8,
  //   marginTop: 8,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   backgroundColor: '#e0f2fe',
  // },
  // statusButtonText: {
  //   color: '#2563eb',
  //   fontSize: 16,
  //   fontWeight: 'bold',
  //   textAlign: 'center',
  // },
  // separator: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginVertical: 16,
  // },
  // separatorLine: {
  //   flex: 1,
  //   height: 1,
  //   backgroundColor: '#E5E5E5',
  // },
  // separatorText: {
  //   marginHorizontal: 16,
  //   color: '#666',
  //   fontSize: 14,
  // },
  // vendorButton: {
  //   borderWidth: 1,
  //   borderColor: '#000',
  //   paddingVertical: 16,
  //   borderRadius: 8,
  //   minHeight: 56,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   backgroundColor: 'transparent',
  // },
  // vendorButtonText: {
  //   color: '#000',
  //   fontSize: 16,
  //   fontWeight: 'bold',
  //   textAlign: 'center',
  // },
});

export default LoginScreen;
