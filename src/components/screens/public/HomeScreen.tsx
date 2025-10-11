import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SessionManager } from '../../../utils/sessionManager';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const CustomerHome: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  useFocusEffect(
    React.useCallback(() => {
      if (SessionManager.isLoggedIn()) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'VendorDashboard' }]
        });
      }
    }, [navigation])
  );

  const handleGetStarted = () => {
    navigation.navigate('Market');
  };

  const handleVendorPress = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Welcome Heading */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome To</Text>
          <Text style={styles.welcomeTitle}>Mapalengke!</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          An app that can help you decide{'\n'}where to go!
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>

      {/* Vendor Link */}
      <TouchableOpacity style={styles.vendorLink} onPress={handleVendorPress}>
        <Text style={styles.vendorText}>Vendor?</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 50,
  },
  getStartedButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  vendorLink: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  vendorText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default CustomerHome;