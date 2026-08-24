import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Menu from './pages/Menu';
import OrderBuilder from './pages/OrderBuilder';
import OrderHistory from './pages/OrderHistory';
import GracePeriodCountdown from './pages/GracePeriodCountdown';

import CustomerCartPage from './imported-ui/pages/CustomerCartPage'
import CustomerMenuPage from './imported-ui/pages/CustomerMenuPage'
import CustomerSuccessPage from './imported-ui/pages/CustomerSuccessPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* User's Routes */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/build" element={<OrderBuilder />} />
        <Route path="/history" element={<OrderHistory />} />
        <Route path="/countdown" element={<GracePeriodCountdown />} />
        
        {/* Friend's Routes */}
        <Route path="/order" element={<CustomerMenuPage />} />
        <Route path="/order/cart" element={<CustomerCartPage />} />
        <Route path="/order/success" element={<CustomerSuccessPage />} />

        {/* Redirect default path to landing */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
