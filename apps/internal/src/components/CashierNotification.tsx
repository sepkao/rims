import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';

type Notification = {
  id: number;
  tableNumber: string;
  message: string;
  createdAt: string;
};

export default function CashierNotification() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    if (role !== 'cashier') return;
    try {
      const data = await apiFetch<{ notifications: Notification[] }>(`/cashier/notifications?_t=${Date.now()}`);
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3000);
    return () => clearInterval(interval);
  }, [role]);

  const markAsRead = async (id: number) => {
    try {
      await apiFetch(`/cashier/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/cashier/notifications/read-all', { method: 'POST' });
      setNotifications([]);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (role !== 'cashier') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[400px] transform origin-bottom-right transition-all">
          <div className="bg-[#5A403E] text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Bell size={18} /> แจ้งเตือนโต๊ะ
            </h3>
            {notifications.length > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto bg-[#FDFBF7]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm font-medium">
                ไม่มีการแจ้งเตือน
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map(n => (
                  <div key={n.id} className="p-4 hover:bg-[#F4EFEA] transition-colors flex items-start justify-between gap-3 group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-[#E53E3E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                          ด่วน
                        </span>
                        <span className="font-bold text-[#302221]">โต๊ะ {n.tableNumber.replace('MOCK-', '')}</span>
                      </div>
                      <p className="text-sm text-[#7B726B] font-medium">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                    <button 
                      onClick={() => markAsRead(n.id)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-200 text-[#10B981] flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 hover:bg-green-50 transition-all"
                      title="รับทราบ"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95
          ${notifications.length > 0 ? 'bg-[#E53E3E] text-white animate-bounce' : 'bg-white text-[#5A403E]'}`}
      >
        <Bell size={24} />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-[#302221] text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>
    </div>
  );
}
