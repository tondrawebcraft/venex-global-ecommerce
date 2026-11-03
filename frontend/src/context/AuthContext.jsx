import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { unwrap } from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    unwrap(api.get('/auth/csrf')).catch(() => {});
    unwrap(api.get('/auth/me')).then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) { const result = await unwrap(api.post('/auth/login', credentials)); setUser(result.user); return result.user; },
    async register(details) { const result = await unwrap(api.post('/auth/register', details)); setUser(result.user); return result.user; },
    async logout() { try { await unwrap(api.post('/auth/logout')); } finally { setUser(null); } },
    async refresh() { const result = await unwrap(api.get('/auth/me')); setUser(result.user); return result.user; }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }

