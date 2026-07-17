import React from 'react' 
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import {useAuth} from './contexts/AuthContext.tsx'
import Dashboard from './pages/owner/Dashboard'
import Login from './pages/login'
import Menu from './pages/owner/MenuManagement'
import UsersManagement from './pages/owner/UserManagement'
import IngredientSettings from './pages/owner/IngredientSettings'
import StockMovementHistory from './pages/owner/StockMovementHistory'
import App from './App.tsx'

function RequireRole({ role: requiredRole, children }: { role: string; children: React.ReactNode }) {
  const { role, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (role !== requiredRole) return <Navigate to="/login" replace />

  return <>{children}</>
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} /> 
        <Route path="/login" element={<Login />} />
        <Route element={<App/>}>
          <Route
          path="/owner/dashboard"
          element={<RequireRole role="owner"><Dashboard /></RequireRole>}
        />
        <Route path="/owner/menu" 
        element={<RequireRole role="owner"><Menu /></RequireRole>} />

        <Route path="/owner/users" element={<RequireRole role="owner"><UsersManagement /></RequireRole>} />
        <Route path="/owner/settings" element={<RequireRole role="owner"><IngredientSettings /></RequireRole>} />
        <Route path="/owner/history" element={<RequireRole role="owner"><StockMovementHistory /></RequireRole>} />
      </Route>
        
      </Routes>
    </BrowserRouter>
  )
}