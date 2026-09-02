import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getQrCode } from './customer-session';

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
  availableServings?: number;
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
  const storageKey = () => `rims.cart.${getQrCode() ?? 'unscoped'}`;
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey());
      return saved ? JSON.parse(saved) as CartItem[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem(storageKey(), JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, 'cartItemId'>) => {
    setItems((prev) => {
      const alreadyInCart = prev
        .filter((cartItem) => cartItem.menuItem.id === item.menuItem.id)
        .reduce((total, cartItem) => total + cartItem.quantity, 0);
      const allowedQuantity = Math.min(item.quantity, Math.max(0, (item.menuItem.availableServings ?? Number.MAX_SAFE_INTEGER) - alreadyInCart));
      if (allowedQuantity === 0) return prev;
      // Check if there is an existing item with the EXACT same configuration
      const existingItemIndex = prev.findIndex(
        (i) =>
          i.menuItem.id === item.menuItem.id &&
          JSON.stringify([...i.removedIngredients].sort()) ===
            JSON.stringify([...item.removedIngredients].sort())
      );

      if (existingItemIndex !== -1) {
        // Increment quantity of existing
        return prev.map((existing, index) => index === existingItemIndex
          ? { ...existing, quantity: existing.quantity + allowedQuantity }
          : existing);
      }

      // Add new instance
      return [...prev, { ...item, quantity: allowedQuantity, cartItemId: crypto.randomUUID() }];
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    setItems((prev) => {
      const current = prev.find((item) => item.cartItemId === cartItemId);
      if (!current) return prev;
      const otherQuantity = prev
        .filter((item) => item.menuItem.id === current.menuItem.id && item.cartItemId !== cartItemId)
        .reduce((total, item) => total + item.quantity, 0);
      const maxQuantity = Math.max(1, (current.menuItem.availableServings ?? Number.MAX_SAFE_INTEGER) - otherQuantity);
      const nextQuantity = Math.min(Math.max(1, quantity), maxQuantity);
      return prev.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = useCallback(() => setItems([]), []);

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
