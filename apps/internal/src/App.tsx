import Sidebar from './components/sidebar.tsx'
import { Outlet } from 'react-router-dom'

export default function App() {
  return ( 
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <Outlet />
      </div>   
    </div>
  )
}
