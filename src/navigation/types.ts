export type RootStackParamList = {
  // Public Routes
  Home: undefined;
  Market: { focusStall?: string; stallName?: string } | undefined;
  ProductList: { categoryId: string };
  ProductDetails: { productId: string };
  VendorsByCategory: { category: string };
  VendorDetails: { vendorId: string; vendorName: string; vendorProducts?: any[] };

  // Auth Routes
  Login: undefined;

  // Vendor Routes
  VendorDashboard: undefined;
  ProductManagement: undefined;
  ShopProfile: undefined;
};
// Bottom tabs removed