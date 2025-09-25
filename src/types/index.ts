export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  username: string;
  userType: 'admin' | 'vendor';
  actualOccupant?: string; // Only for vendors
}

export interface Stall {
  id: string;
  number: string;
  section: StallSection;
  location: {
    latitude: number;
    longitude: number;
  };
  vendorId?: string;
}

export type StallSection =
  | 'eatery'
  | 'fruits_and_vegetable'
  | 'dried_fish'
  | 'grocery'
  | 'rice_and_grains'
  | 'variety'
  | 'fish'
  | 'meat';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  category: StallSection;
  variations?: ProductVariation[];
  vendorId: string;
  stallId: string;
}

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
  unit: string;
}
