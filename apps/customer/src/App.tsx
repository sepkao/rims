import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Menu from './pages/Menu';
import OrderBuilder from './pages/OrderBuilder';
import OrderHistory from './pages/OrderHistory';
import GracePeriodCountdown from './pages/GracePeriodCountdown';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/build" element={<OrderBuilder />} />
        <Route path="/history" element={<OrderHistory />} />
        <Route path="/countdown" element={<GracePeriodCountdown />} />
        
        {/* Redirect default path to landing */}
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
