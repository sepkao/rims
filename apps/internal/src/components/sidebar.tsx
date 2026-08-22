import { History, LayoutDashboard, LogOut, PackagePlus, ScrollText, Table2, TriangleAlert, UtensilsCrossed, Users } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../contexts/AuthContext'

const navItems: Record<Role, Array<{ to: string; label: string; icon: typeof LayoutDashboard }>> = {
  owner: [
    { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
    { to: '/owner/users', label: 'Users', icon: Users },
    { to: '/owner/history', label: 'Inventory', icon: History },
    { to: '/owner/expired', label: 'Expired', icon: TriangleAlert },
    { to: '/owner/system-logs', label: 'System logs', icon: ScrollText },
  ],
  staff: [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/lots/new', label: 'Receive lot', icon: PackagePlus },
    { to: '/staff/history', label: 'Inventory', icon: History },
  ],
  cashier: [
    { to: '/cashier/tables', label: 'Tables', icon: Table2 },
  ],
}

export default function Sidebar() {
  const { role, user, logout } = useAuth()
  const navigate = useNavigate()
  const items = role ? navItems[role] : []

  return (
    <aside className="sidebar">
      <div className="sidebar-header"><span className="sidebar-title">SHABU RIMS</span><span className="sidebar-user">{user?.name}</span></div>
      <nav className="sidebar-nav">
        {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span className="nav-label">{label}</span></NavLink>)}
      </nav>
      <nav className="sidebar-nav sidebar-bottom">
        <button onClick={async () => { await logout(); navigate('/login', { replace: true }) }}><LogOut size={18} /><span className="nav-label">Logout</span></button>
      </nav>
    </aside>
  )
}
