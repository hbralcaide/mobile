export type RootStackParamList = {
  // Public Routes
  Home: undefined;
  Market: undefined;
  CategoryList: undefined;
  ProductList: { categoryId: string };
  ProductDetails: { productId: string };
  MarketMap: undefined;
  VendorsByCategory: { category: string };
  VendorDetails: { vendorId: string; vendorName: string };

  // Auth Routes
  Login: undefined;
  Register: undefined;
  VerifyEmail: {
    token: string;
    type: string;
  };
  ResetPassword: {
    token: string;
  };

  // Vendor Routes
  VendorDashboard: undefined;
  ProductManagement: undefined;
  ShopProfile: undefined;
};