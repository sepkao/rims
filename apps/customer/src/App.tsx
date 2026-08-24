import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CustomerCartPage from './imported-ui/pages/CustomerCartPage'
import CustomerMenuPage from './imported-ui/pages/CustomerMenuPage'
import CustomerSuccessPage from './imported-ui/pages/CustomerSuccessPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/order" replace />} />
        <Route path="/order" element={<CustomerMenuPage />} />
        <Route path="/order/cart" element={<CustomerCartPage />} />
        <Route path="/order/success" element={<CustomerSuccessPage />} />
        <Route path="*" element={<Navigate to="/order" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
