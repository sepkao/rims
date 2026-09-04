import Sidebar from './components/sidebar.tsx'
import { Outlet, useLocation } from 'react-router-dom'
import CashierNotification from './components/CashierNotification'

export default function App() {
  const location = useLocation()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content relative">
        <div key={location.pathname} className="page-animate h-full">
          <Outlet />
        </div>
        <CashierNotification />
      </div>
    </div>
  )
}
