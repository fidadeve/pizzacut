import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Cart } from './types';

export interface AddItemInput {
  productId: string;
  size?: string | null;
  crust?: string | null;
  toppingIds?: string[];
  extraCheese?: boolean;
  qty?: number;
}

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  addItem: (input: AddItemInput) => Promise<Cart>;
  updateItem: (id: string, patch: Partial<AddItemInput> & { qty?: number }) => Promise<Cart>;
  removeItem: (id: string) => Promise<Cart>;
  clear: () => Promise<Cart>;
  applyPromo: (code: string) => Promise<Cart>;
  removePromo: () => Promise<Cart>;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCount, setBusyCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ cart: Cart }>('/cart');
      setCart(res.cart);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = useCallback(async (fn: () => Promise<{ cart: Cart }>): Promise<Cart> => {
    setBusyCount(n => n + 1);
    try {
      const res = await fn();
      setCart(res.cart);
      setError(null);
      return res.cart;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      throw err;
    } finally {
      setBusyCount(n => n - 1);
    }
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    loading,
    error,
    busy: busyCount > 0,
    refresh,
    addItem: input => mutate(() => api.post<{ cart: Cart }>('/cart/items', input)),
    updateItem: (id, patch) => mutate(() => api.patch<{ cart: Cart }>(`/cart/items/${id}`, patch)),
    removeItem: id => mutate(() => api.del<{ cart: Cart }>(`/cart/items/${id}`)),
    clear: () => mutate(() => api.post<{ cart: Cart }>('/cart/clear')),
    applyPromo: code => mutate(() => api.post<{ cart: Cart }>('/cart/promo', { code })),
    removePromo: () => mutate(() => api.del<{ cart: Cart }>('/cart/promo')),
    itemCount: cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0,
  }), [cart, loading, error, busyCount, refresh, mutate]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
