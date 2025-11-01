export type RootStackParamList = {
  // Public Routes
  Home: undefined;
  ShoppingList: undefined;
  Market: { focusStall?: string; stallName?: string; shoppingListStalls?: string[] } | undefined;
  CategoryList: undefined;
  ProductList: { categoryId: string };
  ProductDetails: { productId: string };
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

export type MainTabParamList = {
  Explore: { focusStall?: string; stallName?: string; shoppingListStalls?: string[] } | undefined;
  MyStops: undefined;
};