import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, Users, History, Settings} from 'lucide-react'

const mainNavItems = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/owner/users', label: 'User', icon: Users },
  { to: '/owner/history', label: 'History', icon: History },
]


export default function Sidebar() {
    const location = useLocation()

    return (
        <aside className="sidebar">
                <div className= "sidebar-header">
                    <span className="sidebar-title">SHABU STOCK</span>
                </div>
            
            <nav  className="sidebar-nav ">
                    {mainNavItems.map(({to, label, icon: Icon}) => (
                        <Link key={to} to={to} className={location.pathname === to ? 'nav-item active' : 'nav-item'}>
                            <Icon size={18} />
                            <span className="nav-label">{label}</span>
                        </Link>
                    ))}
                
            </nav>
            
            <nav className="sidebar-nav sidebar-bottom">
                    <Link to= "/owner/settings" className={location.pathname === '/owner/settings' ? 'nav-item active' : 'nav-item'}>
                        <Settings size={18} />
                        <span className="nav-label">Settings</span>
                    </Link>
            </nav>
            
        </aside>
    )

}