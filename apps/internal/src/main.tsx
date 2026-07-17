import { StrictMode } from 'react'
import { AuthProvider} from './contexts/AuthContext.tsx'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRoutes } from './routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </StrictMode>,
)
