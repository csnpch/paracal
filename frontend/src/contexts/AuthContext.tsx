import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { getApiDatabase } from '../services/apiDatabase';

interface AuthContextType {
  isAdminAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('adminAuthenticated') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('adminAuthenticated', isAdminAuthenticated.toString());
  }, [isAdminAuthenticated]);

  const login = async (pin: string): Promise<boolean> => {
    const apiDb = getApiDatabase();
    const success = await apiDb.loginWithPin(pin);

    if (success) {
      setIsAdminAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdminAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAdminAuthenticated, login, logout }}>
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