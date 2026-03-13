import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = localStorage.getItem('auth');
  const [auth, setAuth] = useState(stored ? JSON.parse(stored) : null);

  const login = useCallback(async (username, password) => {
    const res = await axios.post('http://localhost:8080/api/auth/login', { username, password });
    const data = res.data;
    localStorage.setItem('auth', JSON.stringify(data));
    setAuth(data);
    return data;
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
    <AuthContext.Provider value={{ auth, login, logout, clearMustChange }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
