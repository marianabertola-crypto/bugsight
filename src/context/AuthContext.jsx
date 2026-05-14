import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AUTH_TOKEN_KEY = 'auth_token';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => sessionStorage.getItem(AUTH_TOKEN_KEY));

  const setToken = useCallback((newToken) => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, newToken);
    setTokenState(newToken);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    setTokenState(null);
  }, []);

  const user = useMemo(() => {
    if (!token) return null;
    const payload = decodeJwt(token);
    return {
      name: payload?.name || payload?.email || payload?.sub || 'Usuario',
      email: payload?.email || '',
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, setToken, logout, isAuthenticated: token !== null, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
