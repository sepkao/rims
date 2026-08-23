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
    { to: '/cashier/tables', label: 'Tables', icon: Table2Icon }
]

const NavItemsByRole: Record<Role, typeof ownerNavItems> = {
    owner: ownerNavItems,
    staff: staffNavItems,
    cashier: cashierNavItems
}


export default function Sidebar() {
    const { role } = useAuth()
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
            </nav>
            
        </aside>
    )

}