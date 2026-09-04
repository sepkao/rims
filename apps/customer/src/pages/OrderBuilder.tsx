import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useCart, type MenuItem } from '../lib/CartContext';
import { customerQuery, type CustomerSession } from '../lib/customer-session';
import QrExpiryBanner from '../components/QrExpiryBanner';
import { AlertCircle, ArrowLeft, Check, Minus, Plus, UtensilsCrossed } from 'lucide-react';

type AvailableMenuItem = MenuItem & { availableServings: number };

export default function OrderBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { items: cartItems, addItem } = useCart();
  
  const [item, setItem] = useState<AvailableMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [qty, setQty] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
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

  const loadItem = useCallback(() => {
    setLoading(true);
    setError('');
    let query: string;
    try {
      query = customerQuery();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่พบ QR session');
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<{ menuItem: AvailableMenuItem }>(`/customer/menu-items/${id}${query}`),
      apiFetch<{ session: CustomerSession }>(`/customer/session${query}`),
    ])
      .then(([itemData, sessionData]) => {
        setItem(itemData.menuItem);
        setSession(sessionData.session);
        setIsExpired(sessionData.session.status === 'expired' || new Date(sessionData.session.expiresAt).getTime() <= Date.now());
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดเมนูไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const handleToggleIngredient = (ingredientId: string) => {
    setRemovedIngredients(prev => 
      prev.includes(ingredientId) 
        ? prev.filter(i => i !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const handleConfirmOrder = () => {
    if (!item) return;
    addItem({
      menuItem: item,
      quantity: qty,
      removedIngredients: removedIngredients
    });
    navigate('/order');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
        <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center shadow-2xl border-x-2 border-[#2D1B17]">
          <div className="w-12 h-12 border-4 border-[#EAE5DF] border-t-[#B97861] rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-black text-[#2D1B17]">กำลังโหลดรายละเอียดเมนู…</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
        <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center p-6 text-center shadow-2xl border-x-2 border-[#2D1B17]">
          <div className="bg-red-100 border-2 border-red-600 p-4 rounded-2xl mb-4 text-red-700 shadow-[3px_3px_0_#DC2626]">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-lg font-black text-[#2D1B17] mb-2">ไม่พบเมนูอาหาร</h2>
          <p className="text-xs text-[#7B726B] font-semibold mb-6">{error || 'เมนูนี้อาจหมดหรือไม่มีในระบบ'}</p>
          <div className="flex gap-2.5">
            <button onClick={loadItem} className="shabu-btn-primary px-5 py-2.5 text-xs">ลองใหม่</button>
            <button onClick={() => navigate('/order')} className="shabu-btn-secondary px-5 py-2.5 text-xs">กลับหน้าเมนู</button>
          </div>
        </div>
      </div>
    );
  }

  const existingQuantity = cartItems
    .filter((cartItem) => cartItem.menuItem.id === item.id)
    .reduce((total, cartItem) => total + cartItem.quantity, 0);
  const remainingServings = Math.max(0, item.availableServings - existingQuantity);

  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl border-x-2 border-[#2D1B17] overflow-hidden">
        
        {/* Floating Back Button */}
        <div className="absolute top-3.5 left-3.5 z-30">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="w-10 h-10 bg-white/95 backdrop-blur-md text-[#2D1B17] hover:bg-white rounded-xl border-2 border-[#2D1B17] shadow-[2px_2px_0_#2D1B17] flex items-center justify-center active:translate-y-0.5 transition-all"
            title="ย้อนกลับ"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
        </div>

        <QrExpiryBanner expiresAt={session?.expiresAt} />

        {/* Dish Hero Graphic */}
        <div className="anim-down d-1 h-[36%] shrink-0 relative bg-gradient-to-br from-[#B97861] via-[#C4845F] to-[#D9A882] border-b-2 border-[#2D1B17] flex flex-col justify-end p-5 overflow-hidden">
          {/* Decorative Shabu Pot Icon */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full border-[20px] border-white/10" />
          <div className="pointer-events-none absolute right-4 bottom-4 opacity-15">
            <UtensilsCrossed size={110} strokeWidth={1.5} className="text-white" />
          </div>

          <div className="relative z-10 text-white">
            <span className="rotate-[-2deg] inline-block rounded-md border border-[#2D1B17] bg-[#FFF8EF] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2D1B17] shadow-xs mb-2">
              ✦ สั่งแบบปรับแต่ง
            </span>
            <h1 className="text-2xl font-black tracking-tight drop-shadow-xs text-white leading-tight">
              {item.name}
            </h1>
            <p className="text-xs font-semibold text-white/90 mt-1">
              พร้อมเสิร์ฟ {remainingServings} ที่
            </p>
          </div>
        </div>

        {/* Customization Details */}
        <div className="anim-up d-2 flex-1 overflow-y-auto p-4 pb-[105px] bg-[#FDFBF7]">
          {item.description && (
            <p className="text-xs text-[#7B726B] font-semibold leading-relaxed mb-4 bg-white p-3 rounded-xl border border-[#EAE5DF]">
              {item.description}
            </p>
          )}

          {/* Stepper Card */}
          <div className="shabu-card p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="font-black text-xs text-[#2D1B17] uppercase tracking-wider">จำนวนที่สั่ง</p>
              <p className="text-[11px] text-[#7B726B] font-semibold">เลือกจำนวนจาน</p>
            </div>

            <div className="flex items-center rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-1 shadow-[2px_2px_0_#2D1B17]">
              <button 
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 bg-white border border-[#2D1B17] rounded-lg flex items-center justify-center text-[#2D1B17] font-black shadow-xs active:translate-y-0.5"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="font-black text-[#2D1B17] text-base px-3.5 count-anim">{qty}</span>
              <button 
                type="button"
                disabled={qty >= remainingServings || isExpired}
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 rounded-lg bg-[#B97861] border border-[#2D1B17] flex items-center justify-center text-white font-black shadow-xs active:translate-y-0.5 disabled:opacity-50"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Ingredients Customization */}
          {item.ingredients.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-xs text-[#2D1B17] uppercase tracking-wider">
                  ปรับแต่งส่วนผสม (ไม่ใส่บางอย่าง)
                </h3>
                <span className="text-[10px] text-[#7B726B] font-bold">แตะเพื่อเลือก</span>
              </div>
              
              <div className="space-y-2">
                {item.ingredients.map(ing => (
                  <div 
                    key={ing.id} 
                    className="p-3 bg-white rounded-xl border-2 border-[#2D1B17] shadow-[2px_2px_0_#2D1B17] flex items-center justify-between transition-all"
                  >
                    <span className={`text-xs font-bold ${
                      !ing.removable 
                        ? 'text-[#2D1B17]' 
                        : removedIngredients.includes(ing.id) 
                        ? 'text-[#999] line-through' 
                        : 'text-[#2D1B17]'
                    }`}>
                      {ing.name}
                    </span>
                    
                    {!ing.removable ? (
                      <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-black">
                        สูตรมาตรฐาน
                      </span>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleToggleIngredient(ing.id)}
                        className={`text-xs font-black px-3 py-1.5 rounded-lg border-2 transition-all active:translate-y-0.5 ${
                          removedIngredients.includes(ing.id) 
                            ? 'bg-red-50 text-red-700 border-red-600 shadow-[2px_2px_0_#DC2626]' 
                            : 'bg-[#FFF8EF] text-[#2D1B17] border-[#2D1B17] shadow-[2px_2px_0_#2D1B17]'
                        }`}
                      >
                        {removedIngredients.includes(ing.id) ? '✕ ไม่ใส่' : '✓ ใส่ปกติ'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Add Button */}
        <div className="absolute bottom-0 left-0 w-full bg-[#FFF8EF] border-t-2 border-[#2D1B17] p-3 shadow-[0_-6px_20px_rgba(45,27,23,0.12)] z-30">
          <button 
            type="button"
            disabled={isExpired || remainingServings < 1}
            onClick={() => setShowConfirm(true)}
            className={`shabu-btn-primary w-full py-3 text-sm shadow-[3px_3px_0_#B97861] ${
              isExpired || remainingServings < 1 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isExpired 
              ? 'หมดเวลาสั่งอาหาร' 
              : remainingServings < 1 
              ? 'อาหารหมดในรอบนี้' 
              : `+ เพิ่มลงตะกร้า • ${qty} จาน`}
          </button>
        </div>

        {/* Confirm Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
            <div className="bg-[#FDFBF7] rounded-3xl border-2 border-[#2D1B17] shadow-[8px_8px_0_#2D1B17] w-full max-w-sm p-6 text-center animate-scale-in">
              <div className="w-12 h-12 bg-amber-100 border-2 border-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-800 shadow-[2px_2px_0_#D97706]">
                <Check size={24} strokeWidth={3} />
              </div>
              <h2 className="text-base font-black text-[#2D1B17] mb-1">ยืนยันใส่ตะกร้า?</h2>
              <p className="text-xs text-[#7B726B] font-semibold mb-5 leading-relaxed">
                ต้องการเพิ่ม <strong className="text-[#2D1B17] font-black">{item.name}</strong> จำนวน {qty} จาน ลงในตะกร้าของคุณใช่หรือไม่?
              </p>
              
              <div className="flex gap-2.5">
                <button 
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[#2D1B17] bg-white text-[#2D1B17] font-bold text-xs shadow-[2px_2px_0_#2D1B17] active:translate-y-0.5"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmOrder}
                  className="shabu-btn-primary flex-1 py-2.5 text-xs shadow-[2px_2px_0_#B97861]"
                >
                  ตกลงเพิ่ม
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
