import { BellRing, CircleDollarSign, History, LayoutDashboard, LogOut, PackagePlus, Refrigerator, ScrollText, Settings2, ShoppingBasket, Table2, Trash2, UtensilsCrossed, Users, Warehouse } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../contexts/AuthContext'

const navItems: Record<Role, Array<{ to: string; label: string; icon: typeof LayoutDashboard }>> = {
  owner: [
    { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
    { to: '/owner/users', label: 'Users', icon: Users },
    { to: '/owner/history', label: 'Inventory history', icon: History },
    { to: '/owner/freezer-stock', label: 'Freezer stock', icon: Warehouse },
    { to: '/owner/prep-fridge-stock', label: 'Prep fridge', icon: Refrigerator },
    { to: '/owner/expired', label: 'Expired inventory', icon: Warehouse },
    { to: '/owner/waste-review', label: 'Waste review', icon: Trash2 },
    { to: '/owner/system-logs', label: 'System logs', icon: ScrollText },
    { to: '/owner/settings', label: 'Buffet prices', icon: CircleDollarSign },
    { to: '/owner/ingredient-settings', label: 'Ingredient settings', icon: Settings2 },
  ],
  staff: [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/freezer-stock', label: 'Freezer stock', icon: Warehouse },
    { to: '/staff/prep-fridge', label: 'Prep fridge', icon: Refrigerator },
    { to: '/staff/receive-lot', label: 'Receive lot', icon: PackagePlus },
    { to: '/staff/transfer-to-thaw-prep', label: 'Transfer to prep', icon: ShoppingBasket },
    { to: '/staff/notifications', label: 'Prep alerts', icon: BellRing },
    { to: '/staff/orders', label: 'Kitchen queue', icon: Refrigerator },
    { to: '/staff/serving-queue', label: 'Serving queue', icon: Table2 },
  ],
  cashier: [
    { to: '/cashier/tables', label: 'Tables', icon: Table2 },
    { to: '/cashier/check-in', label: 'Check In', icon: PackagePlus },
    { to: '/cashier/payment', label: 'Payment', icon: History },
  ],
}

const roleLabel: Record<Role, string> = {
  owner: 'Owner',
  staff: 'Staff',
  cashier: 'Cashier',
}

const roleColor: Record<Role, string> = {
  owner: 'sidebar-role-owner',
  staff: 'sidebar-role-staff',
  cashier: 'sidebar-role-cashier',
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export default function Sidebar() {
  const { role, user, logout } = useAuth()
  const navigate = useNavigate()
  const items = role ? navItems[role] : []

  return (
    <aside className="sidebar">
      {/* Brand header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon text-[#E8D8CA]">
          <UtensilsCrossed size={18} strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-title">SHABU RIMS</div>
          <div className="sidebar-subtitle">Restaurant OS</div>
        </div>
      </div>

      {/* User identity card */}
      <div className="sidebar-user-card">
        <div className="sidebar-avatar">{getInitials(user?.name ?? '?')}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name ?? 'Guest'}</div>
          {role && <span className={`sidebar-role-badge ${roleColor[role]}`}>{roleLabel[role]}</span>}
        </div>
      </div>

      <div className="sidebar-section-label">Menu</div>

      {/* Nav links */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <span className="sidebar-link-icon">
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className="sidebar-link-label">{label}</span>
                {isActive && <span className="sidebar-active-pip" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer logout */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-logout"
          onClick={async () => { await logout(); navigate('/login', { replace: true }) }}
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
