export type RootStackParamList = {
  // Public Routes
  Home: undefined;
  Market: undefined;
  CategoryList: undefined;
  ProductList: { categoryId: string };
  ProductDetails: { productId: string };
  // Map route for showing the market layout. Params are optional so screens may navigate without params.
  MarketMap: { highlightCategory?: string; highlightStalls?: string[] } | undefined;
  VendorsByCategory: { category: string };
  VendorDetails: { vendorId: string; vendorName: string; vendorProducts?: any[] };

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