export type RootStackParamList = {
  // Public Routes
  Home: undefined;
  Market: undefined;
  CategoryList: undefined;
  ProductList: { categoryId: string };
  ProductDetails: { productId: string };
  MarketMap: undefined;

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