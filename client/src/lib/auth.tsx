import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Address, User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: { name?: string; phone?: string; addresses?: Address[] }) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get<{ user: User | null }>('/auth/me')
      .then(res => { if (alive) setUser(res.user); })
      .catch(() => { /* stay signed out on network failure */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/login', { email, password });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; phone?: string }) => {
    const res = await api.post<{ user: User }>('/auth/register', input);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; phone?: string; addresses?: Address[] }) => {
    const res = await api.patch<{ user: User }>('/auth/profile', patch);
    setUser(res.user);
    return res.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
