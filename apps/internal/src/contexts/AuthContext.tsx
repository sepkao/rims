<<<<<<< HEAD
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch } from '../lib/api'

export type Role = 'owner' | 'staff' | 'cashier'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

type AuthState = {
  user: SessionUser | null
  role: Role | null
  loading: boolean
  login: (email: string, password: string) => Promise<Role>
  register: (name: string, email: string, password: string) => Promise<Role>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiFetch<{ user: SessionUser }>('/auth/session')
      .then((data) => { if (active) setUser(data.user) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
    return data.user.role
  }, [])
=======
import { createContext, useState, useContext } from "react"
import type { ReactNode } from "react"
export type Role = "owner" | "staff" | "cashier"

type AuthState = {
    role :Role | null;
    loading: boolean;
    login: (role: Role) => void;
    logout: () => void;
}


const AuthContext = createContext<AuthState>({ 
        role: null,
        loading: true,
        login: () => {},
        logout: () => {}
    });

export const AuthProvider = ({ children }: { children: ReactNode }) =>{
        const [role, setRole] = useState<Role | null>(null);
        const [loading, setLoading] = useState(false);

        function login(role: Role) {
            
            setRole(role);
        }
        async function logout() {
            await fetch('http://localhost:3000/auth/logout', { method: 'POST', credentials: 'include'})
            setRole(null);
        }
        return (
            <AuthContext.Provider value={{ role, loading, logout, login }}>
                {children}
            </AuthContext.Provider>
        );
>>>>>>> b6bbeef75e594da296df8fe6e79073f22108238a

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiFetch<{ user: SessionUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setUser(data.user)
    return data.user.role
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(() => ({ user, role: user?.role ?? null, loading, login, register, logout }), [loading, login, logout, register, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
