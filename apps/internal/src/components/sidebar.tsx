<<<<<<< HEAD
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
=======
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, Users, History, Settings, BlocksIcon, ListCheckIcon, Table2Icon} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.tsx'
import type { Role } from '../contexts/AuthContext.tsx'

const ownerNavItems = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/owner/users', label: 'User', icon: Users },
  { to: '/owner/history', label: 'History', icon: History, section: 'bottom' },
]
    
const staffNavItems = [
    { to: '/staff/available-servings', label: 'Available Servings', icon: BlocksIcon },
    {to: '/staff/orders', label: 'Orders', icon: ListCheckIcon },
    { to: '/staff/notifications', label: 'Notifications', icon: ListCheckIcon },
    { to: '/staff/receive-lot', label: 'Receive Lot', icon: ListCheckIcon },
    { to: '/staff/thaw-prep-recommendation', label: 'Thaw Prep Recommendation', icon: ListCheckIcon },
    { to: '/staff/transfer-to-thaw-prep', label: 'Transfer to Thaw Prep', icon: ListCheckIcon }
]

const cashierNavItems = [
    { to: '/cashier/tables', label: 'Tables', icon: Table2Icon },
    { to: '/cashier/checkin', label: 'Check In', icon: Table2Icon },
    { to: '/cashier/checkout', label: 'Check Out', icon: Table2Icon }
]

const NavItemsByRole: Record<Role, typeof ownerNavItems> = {
    owner: ownerNavItems,
    staff: staffNavItems,
    cashier: cashierNavItems
>>>>>>> b6bbeef75e594da296df8fe6e79073f22108238a
}

export default function Sidebar() {
<<<<<<< HEAD
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
=======
    const { role,logout } = useAuth()
    const location = useLocation()

    const Items = role ? NavItemsByRole[role] : []
    const mainItems = Items.filter(item => item.section !== 'bottom')
    const bottomItems = Items.filter(item => item.section === 'bottom')
    
    
    return (
        <aside className="sidebar">
                <div className= "sidebar-header">
                    <span className="sidebar-title">SHABU STOCK</span>
                </div>
            
            <nav className="sidebar-nav">
                {mainItems.map(({ to, label, icon: Icon }) => ( 
                    <Link key ={to} to={to} className={location.pathname === to ? 'active' : ''}>
                        <Icon size={18}/>
                        <span className="nav-label">{label}</span>
                    </Link>
                ))}
            </nav>

            <nav className="sidebar-nav sidebar-bottom">
                {bottomItems.map(({ to, label, icon: Icon }) => ( 
                    <Link key ={to} to={to} className={location.pathname === to ? 'active' : ''}>
                        <Icon size={18}/>
                        <span className="nav-label">{label}</span>
                    </Link>
                ))}
                <button onClick={logout}>Logout</button>
            </nav>
            
        </aside>
    )

}
>>>>>>> b6bbeef75e594da296df8fe6e79073f22108238a
