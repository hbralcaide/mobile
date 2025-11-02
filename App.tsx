import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { RootStackParamList } from './src/navigation/types';
import { linkingConfig } from './src/navigation/linking';
import './src/i18n';

// ============ PUBLIC SCREENS ============
/**
 * HomeScreen: The main landing page of the app
 * - Displays welcome message and market introduction
 * - Shows main navigation options (Browse Market, View Map, etc.)
 * - Entry point for both customers and vendors
 */
import HomeScreen from './src/components/screens/public/HomeScreen';

/**
 * MarketScreen: Overview of the Toril Public Market
 * - Displays market sections and categories
 * - Shows featured vendors and products
 * - Provides quick access to popular categories
 */
import MarketScreen from './src/components/screens/public/MarketScreen';

/**
 * CategoryListScreen: Shows all product categories
 * - Lists all available product categories (Meat, Fish, Vegetables, etc.)
 * - Shows category icons and descriptions
 * - Allows filtering and searching categories
 */
import CategoryListScreen from './src/components/screens/public/CategoryListScreen';

/**
 * ProductListScreen: Displays products within a category
 * - Shows all products in a selected category
 * - Includes product images, prices, and basic info
 * - Allows sorting and filtering products
 */
import ProductListScreen from './src/components/screens/public/ProductListScreen';

/**
 * ProductDetailsScreen: Detailed view of a specific product
 * - Shows comprehensive product information
 * - Displays product images, description, price
 * - Shows vendor information and location
 * - Allows viewing similar products
 */
import ProductDetailsScreen from './src/components/screens/public/ProductDetailsScreen';

/**
 * VendorsByCategoryScreen: Lists vendors in a category
 * - Shows all vendors selling specific category items
 * - Displays vendor ratings and status (open/closed)
 * - Allows filtering vendors by various criteria
 */
import VendorsByCategoryScreen from './src/components/screens/public/VendorsByCategoryScreen';

/**
 * VendorDetailsScreen: Detailed vendor information
 * - Shows vendor's complete profile and products
 * - Displays stall location and operating hours
 * - Lists all products offered by the vendor
 * - Shows vendor ratings and reviews
 */
import VendorDetailsScreen from './src/components/screens/public/VendorDetailsScreen';

// ============ AUTHENTICATION SCREENS ============
/**
 * LoginScreen: User authentication
 * - Handles vendor and customer login
 * - Provides email/password authentication
 * - Includes password recovery option
 * - Links to registration for new users
 */
import LoginScreen from './src/components/screens/auth/LoginScreen';

/**
 * RegisterScreen: New user registration
 * - Handles new vendor and customer registration
 * - Collects necessary user information
 * - Validates user inputs
 * - Initiates email verification process
 */
import RegisterScreen from './src/components/screens/auth/RegisterScreen';

/**
 * VerifyEmailScreen: Email verification process
 * - Handles email verification flow
 * - Shows verification status
 * - Provides resend verification option
 * - Guides users through verification steps
 */
import VerifyEmailScreen from './src/components/screens/auth/VerifyEmailScreen';

// ============ VENDOR SCREENS ============
/**
 * VendorDashboardScreen: Vendor's main control panel
 * - Shows vendor's daily statistics and earnings
 * - Displays recent orders and activities
 * - Provides quick access to inventory management
 * - Shows notifications and important updates
 */
import VendorDashboardScreen from './src/components/screens/vendor/VendorDashboardScreen';

/**
 * ProductManagementScreen: Vendor's product control
 * - Allows adding/editing/removing products
 * - Manages product inventory and prices
 * - Handles product categorization
 * - Includes bulk product management options
 */
import ProductManagementScreen from './src/components/screens/vendor/ProductManagementScreen';

/**
 * ShopProfileScreen: Vendor's profile management
 * - Manages vendor's shop information
 * - Controls operating hours and contact details
 * - Updates shop photos and description
 * - Handles business profile settings
 */
import ShopProfileScreen from './src/components/screens/vendor/ShopProfileScreen';

/**
 * Stack Navigator for the entire application
 * Manages navigation between different screens
 * Handles route parameters and screen transitions
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Main App Component
 * - Sets up the navigation container
 * - Configures the navigation stack
 * - Manages authentication flow
 * - Handles deep linking
 */
function App(): React.ReactElement {
  return (
    <PaperProvider>
      <NavigationContainer linking={linkingConfig}>
        <Stack.Navigator initialRouteName="Home">
          {/* ====== Public Routes ======
           * These routes are accessible to all users without authentication
           * Includes market browsing, product viewing, and vendor discovery
           */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerTitle: '', title: '' }}
          />
          <Stack.Screen
            name="Market"
            component={MarketScreen}
            options={{ 
              headerTransparent: true,
              headerTitle: '',
            }}
          />
          {/* Category browsing and product discovery flow */}
          <Stack.Screen name="CategoryList" component={CategoryListScreen} />
          <Stack.Screen name="ProductList" component={ProductListScreen} />
          <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
          {/* Market navigation and vendor discovery */}
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

          {/* ====== Authentication Routes ======
           * Handle user authentication and account management
           * Includes login, registration, and email verification
           * Controls access to protected vendor features
           */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
            options={{
              headerShown: false,
              gestureEnabled: false // Prevents back gesture during verification
            }}
          />

          {/* ====== Vendor Routes ======
           * Protected routes for authenticated vendors
           * Includes business management and profile settings
           * Requires authentication to access
           */}
          <Stack.Screen
            name="VendorDashboard"
            component={VendorDashboardScreen}
            options={{
              headerShown: false,
              gestureEnabled: false, // Prevents accidental back navigation from dashboard
            }}
          />
          <Stack.Screen
            name="ProductManagement"
            component={ProductManagementScreen}
            options={{
              headerTitle: 'Product Management',
              headerTitleAlign: 'center',
            }}
          />
          <Stack.Screen 
            name="ShopProfile" 
            component={ShopProfileScreen}
            options={{
              headerTitle: 'Profile',
              headerTitleAlign: 'center',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;
