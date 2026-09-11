import {
  ArrowLeftRight,
  BellRing,
  ChefHat,
  CircleDollarSign,
  History,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Refrigerator,
  ScrollText,
  Settings2,
  Table2,
  Trash2,
  Users,
  UtensilsCrossed,
  Warehouse,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../contexts/AuthContext'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: Record<Role, NavGroup[]> = {
  owner: [
    {
      label: 'Overview',
      items: [
        { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/owner/freezer-stock', label: 'Freezer stock', icon: Warehouse },
        { to: '/owner/prep-fridge-stock', label: 'Prep fridge', icon: Refrigerator },
        { to: '/owner/history', label: 'Stock history', icon: History },
        { to: '/owner/waste-management', label: 'Waste management', icon: Trash2 },
      ],
    },
    {
      label: 'Management',
      items: [
        { to: '/owner/menu', label: 'Menu & Dishes', icon: UtensilsCrossed },
        { to: '/owner/settings', label: 'Buffet prices', icon: CircleDollarSign },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/owner/ingredient-settings', label: 'Ingredient settings', icon: Settings2 },
        { to: '/owner/users', label: 'Users', icon: Users },
        { to: '/owner/system-logs', label: 'System logs', icon: ScrollText },
      ],
    },
  ],
  staff: [
    {
      label: 'Operations',
      items: [
        { to: '/staff/orders', label: 'Kitchen queue', icon: ChefHat },
        { to: '/staff/serving-queue', label: 'Serving queue', icon: Table2 },
        { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Stock & Prep',
      items: [
        { to: '/staff/freezer-stock', label: 'Freezer stock', icon: Warehouse },
        { to: '/staff/prep-fridge', label: 'Prep fridge', icon: Refrigerator },
        { to: '/staff/receive-lot', label: 'Receive lot', icon: PackagePlus },
        { to: '/staff/transfer-to-thaw-prep', label: 'Transfer to prep', icon: ArrowLeftRight },
        { to: '/staff/notifications', label: 'Prep alerts', icon: BellRing },
      ],
    },
  ],
  cashier: [
    {
      label: 'Service',
      items: [
        { to: '/cashier/tables', label: 'Tables', icon: Table2 },
        { to: '/cashier/payment', label: 'Payment', icon: History },
      ],
    },
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
  const groups = role ? navGroups[role] : []

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

      {/* Grouped Nav links */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {groups.map((group, groupIndex) => (
          <div
            key={group.label}
            className={`sidebar-group ${
              groupIndex > 0 ? 'mt-3 border-t border-white/[0.08] pt-2.5' : 'mt-1'
            }`}
          >
            <div className="sidebar-section-label !mx-2.5 !mb-1.5 !mt-0 text-[10px] font-black tracking-wider text-[#A89086]/75 uppercase">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
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
            </div>
          </div>
        ))}
      </nav>

      {/* Footer logout */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-logout"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
