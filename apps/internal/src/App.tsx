import Sidebar from './components/sidebar.tsx'
import { Outlet, useLocation } from 'react-router-dom'

export default function App() {
  const location = useLocation()
  
  return ( 
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <div key={location.pathname} className="page-animate h-full">
          <Outlet />
        </div>
      </div>   
    </div>
  )
}
