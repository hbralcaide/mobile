import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

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

      // Lookup email by username
      const { data: vendorProfile } = await supabase
        .from('vendor_profiles')
        .select('email, application_status, status, first_name, last_name, auth_user_id')
        .eq('username', username)
        .single();

      if (!vendorProfile) {
        Alert.alert('Error', 'No account found for this username.');
        return;
      }

      const { email, application_status, status, first_name, last_name, auth_user_id } = vendorProfile;

      // Authenticate using email
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Only allow login if approved
        if (application_status === 'approved' || status === 'Active') {
          navigation.replace('VendorDashboard');
          return;
        } else if (application_status === 'pending' || status === 'Pending') {
          Alert.alert('Application Under Review', 'Your vendor application is still under review. Please check your status before logging in.');
          return;
        } else if (application_status === 'rejected' || status === 'Rejected') {
          Alert.alert('Application Not Approved', 'Your vendor application was not approved. Please contact support.');
          return;
        }

        // Check user role and navigate accordingly (for non-vendors or admin)
        const userRole = data.user.user_metadata.role;

        switch (userRole) {
          case 'admin':
            Alert.alert(
              'Admin Access',
              'Admin functionality is available through the web interface. Please use the web dashboard to manage the system.',
              [{ text: 'OK', onPress: () => navigation.replace('Home') }]
            );
            break;
          case 'vendor':
            // If no vendor profile found but role is vendor, show error
            Alert.alert(
              'Profile Not Found',
              'Your vendor profile could not be found. Please contact support.',
              [{ text: 'OK' }]
            );
            break;
          default:
            // Regular user, go to home
            navigation.replace('Home');
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      if (!username) {
        Alert.alert('Error', 'Please enter your email address');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(username, {
        redirectTo: 'mapalengke://auth/reset-password',
      });

      if (error) throw error;

      Alert.alert(
        'Password Reset',
        'If an account exists for this email, you will receive password reset instructions.'
      );
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to send reset instructions');
      }
    }
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
