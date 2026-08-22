import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type UserRole = 'admin' | 'kitchen' | 'server' | 'cashier';

type AuthContextValue = {
  role: UserRole;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('shabu-authenticated') === 'true');
  const [role, setCurrentRole] = useState<UserRole>(() => {
    const savedRole = localStorage.getItem('shabu-role');
    return savedRole === 'admin' || savedRole === 'kitchen' || savedRole === 'server' || savedRole === 'cashier'
      ? savedRole
      : 'admin';
  });

  const value = useMemo(() => ({
    role,
    isAuthenticated,
    login: (nextRole: UserRole) => {
      localStorage.setItem('shabu-role', nextRole);
      localStorage.setItem('shabu-authenticated', 'true');
      setCurrentRole(nextRole);
      setIsAuthenticated(true);
    },
    logout: () => {
      localStorage.removeItem('shabu-role');
      localStorage.removeItem('shabu-authenticated');
      setCurrentRole('admin');
      setIsAuthenticated(false);
    },
  }), [isAuthenticated, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
