import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { RootStackParamList } from './src/navigation/types';
import { linkingConfig } from './src/navigation/linking';
import './src/i18n';

// Import screens
import HomeScreen from './src/components/screens/public/HomeScreen';
import MarketScreen from './src/components/screens/public/MarketScreen';
import CategoryListScreen from './src/components/screens/public/CategoryListScreen';
import ProductListScreen from './src/components/screens/public/ProductListScreen';
import ProductDetailsScreen from './src/components/screens/public/ProductDetailsScreen';
import MarketMapScreen from './src/components/screens/public/MarketMapScreen';
import VendorsByCategoryScreen from './src/components/screens/public/VendorsByCategoryScreen';
import VendorDetailsScreen from './src/components/screens/public/VendorDetailsScreen';

import LoginScreen from './src/components/screens/auth/LoginScreen';
import RegisterScreen from './src/components/screens/auth/RegisterScreen';
import VerifyEmailScreen from './src/components/screens/auth/VerifyEmailScreen';

import VendorDashboardScreen from './src/components/screens/vendor/VendorDashboardScreen';
import ProductManagementScreen from './src/components/screens/vendor/ProductManagementScreen';
import ShopProfileScreen from './src/components/screens/vendor/ShopProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.ReactElement {
  return (
    <PaperProvider>
      <NavigationContainer linking={linkingConfig}>
        <Stack.Navigator initialRouteName="Home">
          {/* Public Routes */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerTitle: '', title: '' }}
          />
          <Stack.Screen
            name="Market"
            component={MarketScreen}
            options={{ headerTitle: '', title: '' }}
          />
          <Stack.Screen name="CategoryList" component={CategoryListScreen} />
          <Stack.Screen name="ProductList" component={ProductListScreen} />
          <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
          <Stack.Screen name="MarketMap" component={MarketMapScreen} />
          <Stack.Screen
            name="VendorsByCategory"
            component={VendorsByCategoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VendorDetails"
            component={VendorDetailsScreen}
            options={{ headerShown: false }}
          />

          {/* Auth Routes */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
            options={{
              headerShown: false,
              gestureEnabled: false
            }}
          />

          {/* Vendor Routes */}
          <Stack.Screen
            name="VendorDashboard"
            component={VendorDashboardScreen}
            options={{ headerTitle: '', title: '' }}
          />
          <Stack.Screen name="ProductManagement" component={ProductManagementScreen} />
          <Stack.Screen name="ShopProfile" component={ShopProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;
