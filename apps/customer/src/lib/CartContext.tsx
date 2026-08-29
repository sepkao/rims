import { createContext, useContext, useState, type ReactNode } from 'react';

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
};

export type CartItem = {
  cartItemId: string; // Unique ID for this instance in cart
  menuItem: MenuItem;
  quantity: number;
  removedIngredients: string[]; // IDs of ingredients the user chose not to include
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cartItemId'>) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'cartItemId'>) => {
    setItems((prev) => {
      // Check if there is an existing item with the EXACT same configuration
      const existingItemIndex = prev.findIndex(
        (i) =>
          i.menuItem.id === item.menuItem.id &&
          JSON.stringify([...i.removedIngredients].sort()) ===
            JSON.stringify([...item.removedIngredients].sort())
      );

      if (existingItemIndex !== -1) {
        // Increment quantity of existing
        const newItems = [...prev];
        newItems[existingItemIndex].quantity += item.quantity;
        return newItems;
      }

      // Add new instance
      return [...prev, { ...item, cartItemId: Date.now().toString() }];
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity } : item))
    );
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
