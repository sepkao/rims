import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { useAuth, type Role } from './contexts/AuthContext'
import { InventoryProvider } from './imported-ui/contexts/InventoryContext'
import LoginPage from './imported-ui/pages/auth/LoginPage'
import RegisterPage from './imported-ui/pages/auth/RegisterPage'
import DashboardPage from './imported-ui/pages/owner/DashboardPage'
import ExpiredGoodsPage from './imported-ui/pages/owner/ExpiredGoodsPage'
import InventoryLogsPage from './imported-ui/pages/owner/InventoryLogsPage'
import MenuManagementPage from './imported-ui/pages/owner/MenuManagementPage'
import SystemLogsPage from './imported-ui/pages/owner/SystemLogsPage'
import UserManagementPage from './imported-ui/pages/owner/UserManagementPage'
import AddLotPage from './imported-ui/pages/staff/AddLotPage'
import KitchenStockPage from './imported-ui/pages/staff/KitchenStockPage'
import StaffDashboardPage from './imported-ui/pages/staff/StaffDashboardPage'
import StaffKitchenQueuePage from './imported-ui/pages/staff/StaffKitchenQueuePage'
import StaffPrepFridgePage from './imported-ui/pages/staff/StaffPrepFridgePage'
import StaffServingQueuePage from './imported-ui/pages/staff/StaffServingQueuePage'
import TransferStocksPage from './imported-ui/pages/staff/TransferStocksPage'
import CashierDashboardPage from './imported-ui/pages/cashier/CashierDashboardPage'
import CashierOrderListPage from './imported-ui/pages/cashier/CashierOrderListPage'
import CashierPaymentPage from './imported-ui/pages/cashier/CashierPaymentPage'

function RequireRole({ role: requiredRole, children }: { role: Role; children: ReactNode }) {
  const { role, loading } = useAuth()
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#fbf8f3] font-bold">กำลังตรวจสอบ session…</main>
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
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<InternalLayout />}>
          <Route path="/owner/dashboard" element={<RequireRole role="owner"><DashboardPage /></RequireRole>} />
          <Route path="/owner/menu" element={<RequireRole role="owner"><MenuManagementPage /></RequireRole>} />
          <Route path="/owner/users" element={<RequireRole role="owner"><UserManagementPage /></RequireRole>} />
          <Route path="/owner/history" element={<RequireRole role="owner"><InventoryLogsPage /></RequireRole>} />
          <Route path="/owner/expired" element={<RequireRole role="owner"><ExpiredGoodsPage /></RequireRole>} />
          <Route path="/owner/system-logs" element={<RequireRole role="owner"><SystemLogsPage /></RequireRole>} />

          <Route path="/staff/dashboard" element={<RequireRole role="staff"><StaffDashboardPage /></RequireRole>} />
          <Route path="/staff/freezer-stock" element={<RequireRole role="staff"><KitchenStockPage area="Freezer Stock" /></RequireRole>} />
          <Route path="/staff/prep-fridge" element={<RequireRole role="staff"><StaffPrepFridgePage /></RequireRole>} />
          <Route path="/staff/receive-lot" element={<RequireRole role="staff"><AddLotPage /></RequireRole>} />
          <Route path="/staff/transfer-to-thaw-prep" element={<RequireRole role="staff"><TransferStocksPage /></RequireRole>} />
          <Route path="/staff/orders" element={<RequireRole role="staff"><StaffKitchenQueuePage /></RequireRole>} />
          <Route path="/staff/serving-queue" element={<RequireRole role="staff"><StaffServingQueuePage /></RequireRole>} />

          <Route path="/cashier/tables" element={<RequireRole role="cashier"><CashierDashboardPage /></RequireRole>} />
          <Route path="/cashier/orders" element={<RequireRole role="cashier"><CashierOrderListPage /></RequireRole>} />
          <Route path="/cashier/payment" element={<RequireRole role="cashier"><CashierPaymentPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
