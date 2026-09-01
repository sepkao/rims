import Sidebar from './components/sidebar.tsx'
import { Outlet } from 'react-router-dom'
import CashierNotification from './components/CashierNotification'

export default function App() {
  return ( 
    <div className="app-layout">
      <Sidebar />
      <div className="app-content relative">
        <Outlet />
        <CashierNotification />
      </div>   
    </div>
  )
}
