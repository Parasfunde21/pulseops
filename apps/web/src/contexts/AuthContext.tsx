import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import type { User } from '../types/api';

interface AuthContextValue { user: User | null; token: string | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void; }
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState(storage.getToken());
  const [loading, setLoading] = useState(Boolean(token));
  useEffect(() => { if (!token) { setLoading(false); return; } api.me().then(({ user: next }) => setUser(next)).catch((error: unknown) => { if (error instanceof ApiError && error.status === 401) { storage.clearToken(); setToken(null); } }).finally(() => setLoading(false)); }, [token]);
  const login = async (email: string, password: string) => { const result = await api.login(email, password); storage.setToken(result.accessToken); setToken(result.accessToken); setUser(result.user); };
  const logout = () => { storage.clearToken(); storage.clearOrganizationId(); setToken(null); setUser(null); };
  return <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
