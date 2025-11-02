import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ShoppingListItem {
  id: string;
  productName: string;
  productId: string;
  vendorName: string;
  vendorId: string;
  stallNumber: string;
  price: number;
  uom: string;
  isDone: boolean;
  addedAt: number;
  categoryName?: string;
  categoryId?: string;
}

interface ShoppingListContextType {
  items: ShoppingListItem[];
  addItem: (item: Omit<ShoppingListItem, 'id' | 'isDone' | 'addedAt'>) => void;
  removeItem: (id: string) => void;
  toggleDone: (id: string) => void;
  clearList: () => void;
  getUniqueStalls: () => Array<{ stallNumber: string; vendorName: string; vendorId: string }>;
}

const ShoppingListContext = createContext<ShoppingListContextType | undefined>(undefined);

export const ShoppingListProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);

  const addItem = (item: Omit<ShoppingListItem, 'id' | 'isDone' | 'addedAt'>) => {
    const newItem: ShoppingListItem = {
      ...item,
      id: `${item.productId}-${item.vendorId}-${Date.now()}`,
      isDone: false,
      addedAt: Date.now(),
    };
    console.log('ShoppingListContext - Adding item:', newItem);
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleDone = (id: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isDone: !item.isDone } : item
      )
    );
  };

  const clearList = () => {
    setItems([]);
  };

  const getUniqueStalls = () => {
    const stallMap = new Map<string, { stallNumber: string; vendorName: string; vendorId: string }>();
    items.forEach(item => {
      if (!stallMap.has(item.stallNumber)) {
        stallMap.set(item.stallNumber, {
          stallNumber: item.stallNumber,
          vendorName: item.vendorName,
          vendorId: item.vendorId,
        });
      }
    });
    return Array.from(stallMap.values());
  };

  return (
    <ShoppingListContext.Provider
      value={{ items, addItem, removeItem, toggleDone, clearList, getUniqueStalls }}
    >
      {children}
    </ShoppingListContext.Provider>
  );
};

export const useShoppingList = () => {
  const context = useContext(ShoppingListContext);
  if (!context) {
    throw new Error('useShoppingList must be used within ShoppingListProvider');
  }
  return context;
};
