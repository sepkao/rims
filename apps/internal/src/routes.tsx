import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { useAuth, type Role } from './contexts/AuthContext'
import { InventoryProvider } from './imported-ui/contexts/InventoryContext'
import LoginPage from './imported-ui/pages/auth/LoginPage'
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
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
      </Routes>
    </BrowserRouter>
  )
}
