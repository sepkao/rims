import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import OrderBuilder from './pages/OrderBuilder';
import Menu from './pages/Menu';
import OrderHistory from './pages/OrderHistory';
import GracePeriodCountdown from './pages/GracePeriodCountdown';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/build" element={<OrderBuilder />} />
        
        {/* Main Flow Routes */}
        <Route path="/order" element={<Menu />} />
        <Route path="/order/cart" element={<OrderHistory />} />
        <Route path="/order/success" element={<GracePeriodCountdown />} />

        {/* Redirect default path to landing */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
