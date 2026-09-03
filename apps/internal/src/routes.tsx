import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { useAuth, type Role } from './contexts/AuthContext'
import { InventoryProvider } from './contexts/InventoryContext'
import LoginPage from './pages/login'
import RegisterPage from './pages/register'
import DashboardPage from './pages/owner/Dashboard'
import ExpiredGoodsPage from './pages/owner/NotFreshInventory'
import InventoryLogsPage from './pages/owner/StockMovementHistory'
import MenuManagementPage from './pages/owner/MenuManagement'
import SystemLogsPage from './pages/owner/SystemLogs'
import BuffetPricesPage from './pages/owner/QrSettings'
import UserManagementPage from './pages/owner/UserManagement'
import AddLotPage from './pages/staff/ReceiveLot'
import KitchenStockPage from './pages/staff/KitchenStock'
import StaffDashboardPage from './pages/staff/StaffDashboard'
import StaffServingQueuePage from './pages/staff/OrdersToServe'
import StaffKitchenQueuePage from './pages/staff/KitchenQueue'
import StaffPrepFridgePage from './pages/staff/PrepFridge'
import TransferStocksPage from './pages/staff/TransferToThawPrep'
import TableList from './pages/cashier/TableList'
import CheckIn from './pages/cashier/CheckIn'
import CheckOut from './pages/cashier/CheckOut'

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
          <Route path="/owner/settings" element={<RequireRole role="owner"><BuffetPricesPage /></RequireRole>} />

          <Route path="/staff/dashboard" element={<RequireRole role="staff"><StaffDashboardPage /></RequireRole>} />
          <Route path="/staff/freezer-stock" element={<RequireRole role="staff"><KitchenStockPage area="Freezer Stock" /></RequireRole>} />
          <Route path="/staff/prep-fridge" element={<RequireRole role="staff"><StaffPrepFridgePage /></RequireRole>} />
          <Route path="/staff/receive-lot" element={<RequireRole role="staff"><AddLotPage /></RequireRole>} />
          <Route path="/staff/transfer-to-thaw-prep" element={<RequireRole role="staff"><TransferStocksPage /></RequireRole>} />
          <Route path="/staff/orders" element={<RequireRole role="staff"><StaffKitchenQueuePage /></RequireRole>} />
          <Route path="/staff/serving-queue" element={<RequireRole role="staff"><StaffServingQueuePage /></RequireRole>} />

          <Route path="/cashier/tables" element={<RequireRole role="cashier"><TableList /></RequireRole>} />
          <Route path="/cashier/check-in" element={<RequireRole role="cashier"><CheckIn /></RequireRole>} />
          <Route path="/cashier/payment" element={<RequireRole role="cashier"><CheckOut /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
