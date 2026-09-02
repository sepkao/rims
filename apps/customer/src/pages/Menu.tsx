import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import CallStaffButton from '../components/CallStaffButton';
import DevTimeTools from '../components/DevTimeTools';
import BuffetTimer from '../components/BuffetTimer';
import QrExpiryBanner from '../components/QrExpiryBanner';
import { customerQuery, type CustomerSession } from '../lib/customer-session';

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
  availableServings: number;
};

import { useCart } from '../lib/CartContext';

// --- Icons สำหรับฝั่งลูกค้า ---
const Icons = {
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Search: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Fire: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="#E53E3E" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>,
  ShoppingBag: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  Minus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

// Backend has no menu category or image fields yet. Do not invent either in Customer.
const categories = ["ทั้งหมด"];

export default function Menu() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const { items: cartItems, addItem, removeItem, updateQuantity } = useCart();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setIsExpired(new Date(session.expiresAt).getTime() <= Date.now());
    }, 1000);
    setIsExpired(new Date(session.expiresAt).getTime() <= Date.now());
    return () => clearInterval(interval);
  }, [session]);

  const fetchItems = () => {
    setLoading(true);
    setError('');
    let sessionQuery: string;
    try {
      sessionQuery = customerQuery();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่พบ QR session');
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<{ menuItems: MenuItem[] }>(`/customer/menu-items${sessionQuery}`),
      apiFetch<{ session: CustomerSession }>(`/customer/session${sessionQuery}`),
    ])
      .then(([menuData, sessionData]) => {
        setItems(menuData.menuItems);
        setSession(sessionData.session);
        setIsExpired(sessionData.session.status === 'expired' || new Date(sessionData.session.expiresAt).getTime() <= Date.now());
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดเมนูไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.description ?? ''} ${item.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "ทั้งหมด";
    return matchesSearch && matchesCategory;
  }), [items, query, activeCategory]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleAdd = (item: MenuItem) => {
    if (isExpired || item.availableServings < 1) return;
    if (item.ingredients.length > 0) {
      navigate(`/build/${item.id}`);
    } else {
      addItem({ menuItem: item, quantity: 1, removedIngredients: [] });
    }
  };

  const handleQuickAdd = (item: MenuItem) => {
    if (isExpired || item.availableServings <= getItemQuantity(item.id)) return;
    addItem({ menuItem: item, quantity: 1, removedIngredients: [] });
  };

  const handleRemoveOne = (item: MenuItem) => {
    const existingInstances = cartItems.filter(i => i.menuItem.id === item.id);
    if (existingInstances.length > 0) {
      const lastInstance = existingInstances[existingInstances.length - 1];
      if (lastInstance.quantity > 1) {
        updateQuantity(lastInstance.cartItemId, lastInstance.quantity - 1);
      } else {
        removeItem(lastInstance.cartItemId);
      }
    }
  };

  const getItemQuantity = (itemId: string) => {
    return cartItems.filter(i => i.menuItem.id === itemId).reduce((sum, i) => sum + i.quantity, 0);
  };

  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-xl overflow-hidden">
        
        {/* --- Header --- */}
        <div className="bg-white px-5 py-4 border-b border-[#EAE5DF] shrink-0 sticky top-0 z-20 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-xl font-bold text-[#5A403E]">Shabu</h1>
              <p className="text-[11px] font-medium text-[#7B726B]">All-you-can-eat buffet</p>
            </div>
            {session && <BuffetTimer expiresAt={session.expiresAt} />}
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-lg font-bold text-[#302221]">โต๊ะ {session?.tableNumber || '--'}</span>
            <span className="text-xs text-[#10B981] font-bold bg-[#D1FAE5] px-2 py-1 rounded-md">กำลังทาน</span>
          </div>
        </div>
        <QrExpiryBanner expiresAt={session?.expiresAt} />

        {/* --- Search & Category Tabs --- */}
        <div className="bg-white px-5 pt-3 pb-2 shrink-0 z-10 border-b border-[#EAE5DF]">
          <div className="relative mb-3">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเมนูหรือวัตถุดิบ..." 
              className="w-full pl-10 pr-4 py-2.5 bg-[#F4EFEA] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5A403E]/20 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 text-xs font-bold rounded-full transition-all border
                  ${activeCategory === cat 
                    ? 'bg-[#5A403E] text-white border-[#5A403E] shadow-sm' 
                    : 'bg-white text-[#7B726B] border-[#EAE5DF] hover:bg-gray-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- Menu Grid --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px]">
          {loading && <div className="py-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดเมนู…</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 mb-4">{error}<button onClick={fetchItems} className="ml-3 underline">ลองใหม่</button></div>}
          
          <div className="grid grid-cols-2 gap-4">
            {visible.map((item) => (
              <div key={item.id} className="rounded-xl bg-white border border-[#EAE5DF] shadow-sm overflow-hidden flex flex-col">
                <div className="h-32 bg-[#F4EFEA] relative border-b border-[#EAE5DF]">
                  <div className="grid h-full place-items-center bg-gradient-to-br from-[#E8DCD0] to-[#C7ACA0] px-3 text-center text-sm font-bold text-[#5A403E]">{item.name}</div>
                </div>
                
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[13px] font-bold text-[#302221] leading-tight mb-1">{item.name}</h3>
                  
                  <div className="flex flex-wrap gap-1 mb-3 flex-1 content-start">
                    {item.ingredients.map((ing) => (
                      <span key={ing.id} className="text-[9px] text-[#7B726B] bg-[#F4EFEA] px-1.5 py-0.5 rounded-sm">
                        {ing.name} {ing.removable && <span className="text-[#999] ml-0.5">(ไม่เอา)</span>}
                      </span>
                    ))}
                  </div>
                  
                  {item.availableServings < 1 ? (
                    <button disabled className="w-full rounded-lg bg-gray-200 py-2 text-xs font-bold text-gray-500">หมดแล้ว</button>
                  ) : getItemQuantity(item.id) > 0 ? (
                    <div className={`flex items-center justify-between rounded-lg p-1 mt-auto ${isExpired ? 'bg-gray-100 opacity-50' : 'bg-[#F4EFEA]'}`}>
                      <button disabled={isExpired} onClick={() => handleRemoveOne(item)} className="w-7 h-7 bg-white rounded-md flex items-center justify-center text-[#5A403E] font-bold shadow-sm"><Icons.Minus /></button>
                      <span className="font-bold text-[#302221] text-xs">{getItemQuantity(item.id)}</span>
                      <button disabled={isExpired || getItemQuantity(item.id) >= item.availableServings} onClick={() => handleQuickAdd(item)} className={`w-7 h-7 rounded-md flex items-center justify-center text-white font-bold shadow-sm ${isExpired || getItemQuantity(item.id) >= item.availableServings ? 'bg-gray-400' : 'bg-[#5A403E]'}`}><Icons.Plus /></button>
                    </div>
                  ) : (
                    <button disabled={isExpired} onClick={() => handleAdd(item)} className={`w-full py-2 border text-[#302221] rounded-lg text-xs font-bold mt-auto transition-colors shadow-sm ${isExpired ? 'bg-gray-200 border-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border-[#EAE5DF] hover:bg-gray-50'}`}>
                      {isExpired ? 'หมดเวลาสั่งอาหาร' : '+ สั่งเลย'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!loading && !error && visible.length === 0 && <div className="py-10 text-center text-sm text-[#7B726B]">ไม่พบเมนู</div>}
        </div>

        <CallStaffButton />
        {import.meta.env.DEV && <DevTimeTools onTriggerFetch={fetchItems} />}

        {/* --- Floating Bottom Cart --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#EAE5DF] p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-30">
          <button 
            onClick={() => navigate('/order/cart')}
            className={`w-full py-3.5 flex items-center justify-between px-5 font-bold transition-colors rounded-lg
            ${totalItems > 0 ? 'bg-[#5A403E] hover:bg-[#4A3432] text-white shadow-md' : 'bg-[#F4EFEA] text-[#999] cursor-not-allowed'}`}
            disabled={totalItems === 0}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Icons.ShoppingBag />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#E53E3E] text-white text-[10px] w-4.5 h-4.5 flex items-center justify-center rounded-full shadow-sm">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-sm">ดูรายการที่เลือก</span>
            </div>
            <span className="text-sm">{totalItems > 0 ? `${totalItems} รายการ` : 'ยังไม่มีรายการ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
