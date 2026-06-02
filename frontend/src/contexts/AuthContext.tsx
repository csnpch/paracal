import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { getApiDatabase } from '../services/apiDatabase';

interface AuthContextType {
  isAdminAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  adminToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('adminToken');
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return !!localStorage.getItem('adminToken');
  });

  useEffect(() => {
    if (adminToken) {
      localStorage.setItem('adminToken', adminToken);
      localStorage.setItem('adminAuthenticated', 'true');
    } else {
      localStorage.removeItem('adminToken');
      localStorage.setItem('adminAuthenticated', 'false');
    }
    setIsAdminAuthenticated(!!adminToken);
  }, [adminToken]);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const apiDb = getApiDatabase();
      const valid = await apiDb.verifyAdminSession();
      if (!valid) {
        setAdminToken(null);
      }
    };

    verifySession();
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    const apiDb = getApiDatabase();
    const result = await apiDb.loginWithPin(pin);

    if (result.success && result.token) {
      setAdminToken(result.token);
      return true;
    }
    return false;
  };

  const logout = async () => {
    const apiDb = getApiDatabase();
    await apiDb.logoutAdmin();
    setAdminToken(null);
  };

  return (
    <AuthContext.Provider value={{ isAdminAuthenticated, login, logout, adminToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};