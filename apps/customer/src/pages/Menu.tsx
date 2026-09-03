import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, apiFetch } from '../lib/api';
import CallStaffButton from '../components/CallStaffButton';
import DevTimeTools from '../components/DevTimeTools';
import BuffetTimer from '../components/BuffetTimer';
import QrExpiryBanner from '../components/QrExpiryBanner';
import { customerQuery, type CustomerSession } from '../lib/customer-session';
import { useCart } from '../lib/CartContext';
import { Clock, Minus, Plus, Search, ShoppingBag, UtensilsCrossed } from 'lucide-react';

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  imagePath: string | null;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
  availableServings: number;
};

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

  const fetchItems = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
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
  }, []);

  useEffect(() => {
    fetchItems();
    const polling = window.setInterval(() => fetchItems(false), 5_000);
    return () => window.clearInterval(polling);
  }, [fetchItems]);

  const visible = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.description ?? ''} ${item.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "ทั้งหมด" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  }), [items, query, activeCategory]);
  const categories = useMemo(() => ['ทั้งหมด', ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))], [items]);

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
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl border-x-2 border-[#2D1B17] overflow-hidden">
        
        {/* ── Brand Header (Staff-Aligned) ─────────────────────────── */}
        <header className="anim-down d-1 bg-white px-4 py-3.5 border-b-2 border-[#2D1B17] shrink-0 sticky top-0 z-20 shadow-sm">
          <div className="flex justify-between items-center mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl border-2 border-[#2D1B17] bg-[#B97861] text-white shadow-[2px_2px_0_#2D1B17]">
                <UtensilsCrossed size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wider text-[#2D1B17] uppercase leading-none">SHABU RIMS</h1>
                <p className="text-[10px] font-bold text-[#B97861] uppercase tracking-widest mt-0.5">Premium Buffet</p>
              </div>
            </div>

            {session && <BuffetTimer expiresAt={session.expiresAt} />}
          </div>
          
          <div className="flex justify-between items-center pt-1 border-t border-[#F4EFEA]">
            <span className="rotate-[-1.5deg] inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-xs font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">
              <span>โต๊ะ</span>
              <strong className="text-sm">{session?.tableNumber || '--'}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => navigate('/order/history')}
                className="flex items-center gap-1.5 text-xs font-extrabold bg-[#FFF8EF] hover:bg-white text-[#2D1B17] border-2 border-[#2D1B17] px-3 py-1 rounded-xl shadow-[2px_2px_0_#2D1B17] active:translate-y-0.5 transition-all"
                title="ดูประวัติและติดตามสถานะออเดอร์"
              >
                <Clock size={12} strokeWidth={2.5} className="text-[#B97861]" />
                <span>สถานะออเดอร์</span>
              </button>

              <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                กำลังทาน
              </span>
            </div>
          </div>
        </header>

        <QrExpiryBanner expiresAt={session?.expiresAt} />

        {/* ── Search & Filter ──────────────────────────────────────── */}
        <div className="anim-down d-2 bg-white px-4 pt-3 pb-2.5 shrink-0 z-10 border-b-2 border-[#2D1B17]">
          <div className="relative mb-2.5">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B726B]" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเนื้อ ผัก หรือเมนู..." 
              className="shabu-input w-full pl-9 pr-4 py-2 text-xs font-semibold placeholder:text-[#7B726B]/70 outline-none"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1 text-xs font-black rounded-full border-2 transition-all ${
                  activeCategory === cat 
                    ? 'bg-[#2D1B17] text-white border-[#2D1B17] shadow-[2px_2px_0_#B97861]' 
                    : 'bg-[#FFF8EF] text-[#2D1B17] border-[#2D1B17] hover:bg-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Menu Grid (Tactile Cards) ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3.5 pb-[105px]">
          {loading && (
            <div className="py-16 text-center text-xs font-black text-[#7B726B] animate-pulse">
              กำลังจัดเตรียมเมนูอาหาร…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-xs font-bold text-red-700 mb-4 shadow-[3px_3px_0_#DC2626]">
              {error}
              <button onClick={() => fetchItems()} className="ml-3 underline font-black">ลองใหม่</button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3.5">
            {visible.map((item, idx) => (
              <div 
                key={item.id} 
                className={`shabu-card flex flex-col overflow-hidden anim-up d-${(idx % 4) + 1}`}
              >
                {/* Dish Graphic Header */}
                <div className="h-28 bg-gradient-to-br from-[#E8DCD0] via-[#DECEBF] to-[#C7ACA0] relative border-b-2 border-[#2D1B17] p-2 flex flex-col justify-between overflow-hidden">
                  {item.imagePath && <img src={`${API_BASE_URL}${item.imagePath}`} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-white/20" />
                  <div className="flex justify-between items-start z-10">
                    <span className="rounded-md border border-[#2D1B17] bg-white/90 px-1.5 py-0.5 text-[9px] font-black text-[#2D1B17]">
                      {item.availableServings < 1 ? 'หมดแล้ว' : '✦ พร้อมเสิร์ฟ'}
                    </span>
                  </div>

                  <div className="text-center z-10">
                    <p className="font-black text-sm text-[#2D1B17] tracking-tight drop-shadow-xs leading-snug px-1">
                      {item.name}
                    </p>
                  </div>

                  {/* Decorative Shabu Steam Glyphs */}
                  <div className="pointer-events-none absolute inset-0 opacity-15 flex items-center justify-center font-serif text-5xl select-none">
                    鍋
                  </div>
                </div>
                
                {/* Card Content & Action */}
                <div className="p-2.5 flex flex-col flex-1 bg-white">
                  <h3 className="text-xs font-black text-[#2D1B17] leading-tight mb-1">{item.name}</h3>
                  
                  {/* Ingredients Tags */}
                  <div className="flex flex-wrap gap-1 mb-2.5 flex-1 content-start">
                    {item.ingredients.map((ing) => (
                      <span key={ing.id} className="text-[9px] font-bold text-[#5A403E] bg-[#F4EFEA] border border-[#EAE5DF] px-1.5 py-0.2 rounded">
                        {ing.name} {ing.removable && <span className="text-[#999]">(ปรับได้)</span>}
                      </span>
                    ))}
                  </div>
                  
                  {/* Stepper or Add Button */}
                  {item.availableServings < 1 ? (
                    <button disabled className="w-full rounded-xl border-2 border-gray-300 bg-gray-100 py-1.5 text-[11px] font-black text-gray-400 cursor-not-allowed">
                      ของหมดชั่วคราว
                    </button>
                  ) : getItemQuantity(item.id) > 0 ? (
                    <div className="flex items-center justify-between rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-1 shadow-[2px_2px_0_#2D1B17]">
                      <button 
                        type="button"
                        disabled={isExpired} 
                        onClick={() => handleRemoveOne(item)} 
                        className="w-6 h-6 bg-white border border-[#2D1B17] rounded-lg flex items-center justify-center text-[#2D1B17] font-black shadow-xs active:translate-y-0.5"
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span className="font-black text-[#2D1B17] text-xs count-anim">{getItemQuantity(item.id)}</span>
                      <button 
                        type="button"
                        disabled={isExpired || getItemQuantity(item.id) >= item.availableServings} 
                        onClick={() => handleQuickAdd(item)} 
                        className="w-6 h-6 rounded-lg bg-[#B97861] border border-[#2D1B17] flex items-center justify-center text-white font-black shadow-xs active:translate-y-0.5 disabled:opacity-50"
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      disabled={isExpired} 
                      onClick={() => handleAdd(item)} 
                      className={`w-full py-1.5 rounded-xl border-2 border-[#2D1B17] font-black text-xs transition-all shadow-[2px_2px_0_#2D1B17] active:translate-y-0.5 ${
                        isExpired 
                          ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed shadow-none' 
                          : 'bg-[#FFF8EF] hover:bg-white text-[#2D1B17]'
                      }`}
                    >
                      {isExpired ? 'หมดเวลา' : '+ สั่งเลย'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!loading && !error && visible.length === 0 && (
            <div className="py-16 text-center text-xs font-bold text-[#7B726B]">
              ไม่พบรายการอาหารที่ค้นหา
            </div>
          )}
        </div>

        <CallStaffButton />
        {import.meta.env.DEV && <DevTimeTools onTriggerFetch={fetchItems} />}

        {/* ── Floating Bottom Action Bar (Neo-Brutalist) ─────────────── */}
        <div className="absolute bottom-0 left-0 w-full bg-[#FFF8EF] border-t-2 border-[#2D1B17] p-3 shadow-[0_-6px_20px_rgba(45,27,23,0.12)] z-30 flex gap-2.5">
          {/* Order Status Button */}
          <button 
            type="button"
            onClick={() => navigate('/order/history')}
            className="flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 font-black text-xs bg-white text-[#2D1B17] border-2 border-[#2D1B17] rounded-xl shadow-[3px_3px_0_#2D1B17] hover:bg-[#FDFBF7] active:translate-y-0.5 transition-all"
          >
            <Clock size={14} strokeWidth={2.5} className="text-[#B97861]" />
            <span>ประวัติ & สถานะ</span>
          </button>

          {/* Cart View Button */}
          <button 
            type="button"
            onClick={() => navigate('/order/cart')}
            className={`flex-[1.4] py-2.5 px-3.5 flex items-center justify-between font-black text-xs rounded-xl border-2 border-[#2D1B17] transition-all active:translate-y-0.5 ${
              totalItems > 0 
                ? 'bg-[#2D1B17] text-white shadow-[3px_3px_0_#B97861] hover:bg-[#3E241E]' 
                : 'bg-white text-[#2D1B17] shadow-[3px_3px_0_#2D1B17] hover:bg-[#FAF8F5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingBag size={15} strokeWidth={2.5} />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#E04F34] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#2D1B17] shadow-xs count-anim">
                    {totalItems}
                  </span>
                )}
              </div>
              <span>{totalItems > 0 ? 'ดูตะกร้าของฉัน' : 'เช็คตะกร้า'}</span>
            </div>

            <span className={`text-[11px] font-bold ${totalItems > 0 ? 'text-[#D9B99A]' : 'text-[#7B726B]'}`}>
              {totalItems > 0 ? `${totalItems} จาน` : 'ว่าง'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
