<<<<<<< HEAD
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { useAuth, type Role } from './contexts/AuthContext'
import { InventoryProvider } from './imported-ui/contexts/InventoryContext'
import LoginPage from './imported-ui/pages/auth/LoginPage'
import RegisterPage from './imported-ui/pages/auth/RegisterPage'
import CashierDashboardPage from './imported-ui/pages/cashier/CashierDashboardPage'
import DashboardPage from './imported-ui/pages/owner/DashboardPage'
import ExpiredGoodsPage from './imported-ui/pages/owner/ExpiredGoodsPage'
import InventoryLogsPage from './imported-ui/pages/owner/InventoryLogsPage'
import MenuManagementPage from './imported-ui/pages/owner/MenuManagementPage'
import SystemLogsPage from './imported-ui/pages/owner/SystemLogsPage'
import UserManagementPage from './imported-ui/pages/owner/UserManagementPage'
import AddLotPage from './imported-ui/pages/staff/AddLotPage'
import StaffDashboardPage from './imported-ui/pages/staff/StaffDashboardPage'

function RequireRole({ role: requiredRole, children }: { role: Role; children: ReactNode }) {
=======
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
import type { Role } from './contexts/AuthContext.tsx'
import OrdersToServe from './pages/staff/OrdersToServe'
import AvailableServings from './pages/staff/AvailableServings'
import Notifications from './pages/staff/Notifications'
import ReceiveLot from './pages/staff/ReceiveLot'
import ThawPrepRecommendation from './pages/staff/ThawPrepRecommendation'
import TransferToThawPrep from './pages/staff/TransferToThawPrep'
import TableList from './pages/cashier/TableList'
import CheckIn from './pages/cashier/CheckIn'
import CheckOut from './pages/cashier/CheckOut'
function RequireRole({ role: requiredRole, children }: { role: Role; children: React.ReactNode }) {
>>>>>>> b6bbeef75e594da296df8fe6e79073f22108238a
  const { role, loading } = useAuth()
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#fbf8f3] font-bold">Loading session…</main>
  if (!role) return <Navigate to="/login" replace />
  if (role !== requiredRole) {
    const home: Record<Role, string> = { owner: '/owner/dashboard', staff: '/staff/dashboard', cashier: '/cashier/tables' }
    return <Navigate to={home[role]} replace />
  }
  return <>{children}</>
}

function InternalLayout() {
  return <InventoryProvider><App /></InventoryProvider>
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
<<<<<<< HEAD
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<InternalLayout />}>
          <Route path="/owner/dashboard" element={<RequireRole role="owner"><DashboardPage /></RequireRole>} />
          <Route path="/owner/menu" element={<RequireRole role="owner"><MenuManagementPage /></RequireRole>} />
          <Route path="/owner/users" element={<RequireRole role="owner"><UserManagementPage /></RequireRole>} />
          <Route path="/owner/history" element={<RequireRole role="owner"><InventoryLogsPage /></RequireRole>} />
          <Route path="/owner/expired" element={<RequireRole role="owner"><ExpiredGoodsPage /></RequireRole>} />
          <Route path="/owner/system-logs" element={<RequireRole role="owner"><SystemLogsPage /></RequireRole>} />

          <Route path="/staff/dashboard" element={<RequireRole role="staff"><StaffDashboardPage role="kitchen" /></RequireRole>} />
          <Route path="/staff/lots/new" element={<RequireRole role="staff"><AddLotPage /></RequireRole>} />
          <Route path="/staff/history" element={<RequireRole role="staff"><InventoryLogsPage /></RequireRole>} />

          <Route path="/cashier/tables" element={<RequireRole role="cashier"><CashierDashboardPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
=======
        <Route path="/" element={<Navigate to="/login" replace />} /> 
        <Route path="/login" element={<Login />} />
        <Route element={<App/>}>
        <Route path="/owner/dashboard" element={<RequireRole role = "owner" ><Dashboard /></RequireRole>}/>
        <Route path="/owner/menu" element={<RequireRole role="owner"><Menu /></RequireRole>} />
        <Route path="/owner/users" element={<RequireRole role="owner"><UsersManagement /></RequireRole>} />
        <Route path="/owner/settings" element={<RequireRole role="owner"><IngredientSettings /></RequireRole>} />
        <Route path="/owner/history" element={<RequireRole role="owner"><StockMovementHistory /></RequireRole>} />
        <Route path="/staff/orders" element={<RequireRole role="staff"><OrdersToServe /></RequireRole>} />
        <Route path="/staff/available-servings" element={<RequireRole role="staff"><AvailableServings /></RequireRole>} />
        <Route path="/staff/notifications" element={<RequireRole role="staff"><Notifications /></RequireRole>} />
        <Route path="/staff/receive-lot" element={<RequireRole role="staff"><ReceiveLot /></RequireRole>} />
        <Route path="/staff/thaw-prep-recommendation" element={<RequireRole role="staff"><ThawPrepRecommendation /></RequireRole>} />
        <Route path="/staff/transfer-to-thaw-prep" element={<RequireRole role="staff"><TransferToThawPrep /></RequireRole>} />
        <Route path="/cashier/tables" element={<RequireRole role="cashier"><TableList /></RequireRole>} />
        <Route path="/cashier/checkin" element={<RequireRole role="cashier"><CheckIn /></RequireRole>} />
        <Route path="/cashier/checkout" element={<RequireRole role="cashier"><CheckOut /></RequireRole>} />
      </Route>
        
>>>>>>> b6bbeef75e594da296df8fe6e79073f22108238a
      </Routes>
    </BrowserRouter>
  )
}
