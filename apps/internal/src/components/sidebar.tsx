import { History, LayoutDashboard, LogOut, PackagePlus, Refrigerator, ScrollText, ShoppingBasket, Table2, UtensilsCrossed, Users, Warehouse } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../contexts/AuthContext'

const navItems: Record<Role, Array<{ to: string; label: string; icon: typeof LayoutDashboard }>> = {
  owner: [
    { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
    { to: '/owner/users', label: 'Users', icon: Users },
    { to: '/owner/history', label: 'Inventory history', icon: History },
    { to: '/owner/expired', label: 'Expired inventory', icon: Warehouse },
    { to: '/owner/system-logs', label: 'System logs', icon: ScrollText },
  ],
  staff: [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/freezer-stock', label: 'Freezer stock', icon: Warehouse },
    { to: '/staff/prep-fridge', label: 'Prep fridge', icon: Refrigerator },
    { to: '/staff/receive-lot', label: 'Receive lot', icon: PackagePlus },
    { to: '/staff/transfer-to-thaw-prep', label: 'Transfer to prep', icon: ShoppingBasket },
    { to: '/staff/orders', label: 'Kitchen queue', icon: UtensilsCrossed },
    { to: '/staff/serving-queue', label: 'Serving queue', icon: Table2 },
  ],
  cashier: [
    { to: '/cashier/tables', label: 'Tables', icon: Table2 },
    { to: '/cashier/orders', label: 'Orders', icon: UtensilsCrossed },
    { to: '/cashier/payment', label: 'Payment', icon: History },
  ],
}

export default function Sidebar() {
  const { role, user, logout } = useAuth()
  const navigate = useNavigate()
  const items = role ? navItems[role] : []

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">SHABU RIMS</span>
        <span className="sidebar-user">{user?.name ?? 'Restaurant workspace'}</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <nav className="sidebar-nav sidebar-bottom" aria-label="Account navigation">
        <button type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }) }}>
          <LogOut size={18} />
          <span className="nav-label">Logout</span>
        </button>
      </nav>
    </aside>
  )
}
