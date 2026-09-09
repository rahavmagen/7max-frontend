import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://7max-tracker-production.up.railway.app/api';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = localStorage.getItem('auth');
  const [auth, setAuth] = useState(stored ? JSON.parse(stored) : null);

  const login = useCallback(async (username, password) => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
    const data = res.data;
    localStorage.setItem('auth', JSON.stringify(data));
    setAuth(data);
    return data;
  }, []);

  // Store an already-obtained login-shaped response (e.g. from POST /join, which logs the new
  // user straight in) without making a separate /auth/login call.
  const setAuthData = useCallback((data) => {
    localStorage.setItem('auth', JSON.stringify(data));
    setAuth(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth');
    setAuth(null);
  }, []);

  const clearMustChange = useCallback(() => {
    const updated = { ...auth, mustChangePassword: false };
    localStorage.setItem('auth', JSON.stringify(updated));
    setAuth(updated);
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, clearMustChange, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
