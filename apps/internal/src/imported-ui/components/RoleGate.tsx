import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { type UserRole, useAuth } from '../contexts/AuthContext';

const homeByRole: Record<UserRole, string> = {
  admin: '/admin',
  kitchen: '/kitchen',
  server: '/server',
  cashier: '/cashier',
};

export default function RoleGate({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const { role, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return allowed.includes(role) ? <>{children}</> : <Navigate to={homeByRole[role]} replace />;
}
