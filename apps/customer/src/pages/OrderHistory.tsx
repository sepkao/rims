import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../lib/CartContext';
import CallStaffButton from '../components/CallStaffButton';
import BuffetTimer from '../components/BuffetTimer';
import QrExpiryBanner from '../components/QrExpiryBanner';
import { apiFetch } from '../lib/api';
import { customerQuery, isOrderingClosed, requireQrCode, type CustomerSession } from '../lib/customer-session';
import DevTimeTools from '../components/DevTimeTools';
import { ArrowLeft, Check, ChefHat, ChevronDown, Clock, Minus, Plus, RefreshCw, Trash2, Utensils, UtensilsCrossed, XCircle } from 'lucide-react';

type OrderedItem = {
  id: string;
  orderId: string;
  name: string;
  qty: number;
  servedQuantity: number;
  returnedQuantity: number;
  status: 'pending' | 'cooking' | 'serving' | 'served' | 'cancelled' | 'unknown';
  time: string;
  confirmAt: string;
};

type OrderGroup = {
  orderId: string;
  time: string;
  confirmAt: string;
  items: OrderedItem[];
};

function orderGroupStatus(items: OrderedItem[]) {
  if (items.some((item) => item.status === 'pending')) return { label: 'รอครัวยืนยัน', tone: 'border-[#7B726B] bg-[#F4EFEA] text-[#2D1B17]' };
  if (items.some((item) => item.status === 'cooking')) return { label: 'กำลังเตรียม', tone: 'border-[#D97706] bg-amber-100 text-[#92400E]' };
  if (items.some((item) => item.status === 'serving')) return { label: 'กำลังจัดเสิร์ฟ', tone: 'border-[#2563EB] bg-blue-100 text-[#1E40AF]' };
  const hasServed = items.some((item) => item.servedQuantity > 0);
  const hasReturned = items.some((item) => item.returnedQuantity > 0 || item.status === 'cancelled');
  if (hasServed && hasReturned) return { label: 'เสร็จสิ้นบางส่วน', tone: 'border-red-300 bg-red-100 text-[#991B1B]' };
  if (hasReturned) return { label: 'ยกเลิกแล้ว', tone: 'border-red-300 bg-red-100 text-[#991B1B]' };
  return { label: 'เสิร์ฟครบแล้ว', tone: 'border-emerald-600 bg-emerald-100 text-[#166534]' };
}

function EmptyCard({ 
  message, 
  detail, 
  actionLabel, 
  onAction 
}: { 
  message: string; 
  detail: string; 
  actionLabel?: string; 
  onAction?: () => void; 
}) { 
  return (
    <div className="bg-white rounded-2xl border-2 border-[#2D1B17] shadow-[4px_4px_0_#2D1B17] p-7 text-center anim-up d-1">
      {/* Cute Steaming Shabu Bowl Illustration */}
      <div className="w-16 h-16 bg-[#FFF8EF] border-2 border-[#2D1B17] rounded-2xl shadow-[3px_3px_0_#2D1B17] flex items-center justify-center mx-auto mb-3.5 text-[#B97861]">
        <UtensilsCrossed size={30} strokeWidth={2.5} className="steam-anim" />
      </div>
      <p className="font-black text-base text-[#2D1B17]">{message}</p>
      <p className="mt-1.5 text-xs text-[#7B726B] font-semibold leading-relaxed max-w-[240px] mx-auto">{detail}</p>
      {actionLabel && (
        <button 
          type="button"
          onClick={onAction} 
          className="shabu-btn-primary mt-5 px-5 py-2 text-xs font-black"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function OrderHistory({ defaultTab = 'cart' }: { defaultTab?: 'cart' | 'history' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'cart' | 'history'>(
    tabParam === 'history' || tabParam === 'cart' ? tabParam : defaultTab
  );

  const { items: cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const [orderedItems, setOrderedItems] = useState<OrderedItem[]>([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const initializedOrderIdsRef = useRef<Set<string>>(new Set());
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderingClosed, setOrderingClosed] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const handleTabChange = (tab: 'cart' | 'history') => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  };

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setOrderingClosed(isOrderingClosed(session.expiresAt));
    }, 1000);
    setOrderingClosed(isOrderingClosed(session.expiresAt));
    return () => clearInterval(interval);
  }, [session]);

  // Ticks every second so the "ยกเลิกออเดอร์" button in the History tab disappears exactly
  // at the real 60s cancel deadline (order.confirmAt), instead of only ever checking
  // order.status === 'pending' — see [B12].
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await apiFetch<{ items: OrderedItem[]; session: CustomerSession }>(`/customer/orders${customerQuery()}`);
      setOrderedItems(data.items || []);
      setSession(data.session);
      setOrderingClosed(isOrderingClosed(data.session.expiresAt));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดประวัติออเดอร์ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3500); // Live status polling
    return () => clearInterval(interval);
  }, []);
  
  const handleCheckout = async () => {
    if (cartItems.length === 0 || isSubmitting || orderingClosed) return;
    setIsSubmitting(true);
    try {
      const payload = {
        qrCode: requireQrCode(),
        items: cartItems.map(i => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          removedIngredients: i.removedIngredients
        }))
      };
      
      const result = await apiFetch<{ orderId: string }>('/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      clearCart();
      navigate(`/order/success?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'เกิดข้อผิดพลาดในการสั่งอาหาร');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiFetch(`/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ qrCode: requireQrCode() }),
      });
      fetchOrders();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถยกเลิกออเดอร์ได้');
    }
  };

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const orderGroups = useMemo<OrderGroup[]>(() => {
    const groups = new Map<string, OrderGroup>();
    for (const item of orderedItems) {
      const group = groups.get(item.orderId);
      if (group) group.items.push(item);
      else groups.set(item.orderId, { orderId: item.orderId, time: item.time, confirmAt: item.confirmAt, items: [item] });
    }
    return [...groups.values()];
  }, [orderedItems]);

  useEffect(() => {
    const newlyExpanded: string[] = [];
    orderGroups.forEach((group, index) => {
      if (initializedOrderIdsRef.current.has(group.orderId)) return;
      initializedOrderIdsRef.current.add(group.orderId);
      if (index === 0 || group.items.some((item) => ['pending', 'cooking', 'serving'].includes(item.status))) {
        newlyExpanded.push(group.orderId);
      }
    });
    if (newlyExpanded.length > 0) {
      setExpandedOrderIds((current) => new Set([...current, ...newlyExpanded]));
    }
  }, [orderGroups]);

  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl border-x-2 border-[#2D1B17] overflow-hidden">
        
        {/* ── Brand Header (Staff-Aligned) ─────────────────────────── */}
        <header className="anim-down d-1 bg-white px-4 py-3 border-b-2 border-[#2D1B17] shrink-0 sticky top-0 z-20 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={() => navigate('/order')} 
              className="p-1.5 -ml-1 text-[#2D1B17] hover:bg-[#FFF8EF] rounded-xl border border-transparent hover:border-[#2D1B17] transition-all"
              title="กลับไปหน้าเมนู"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-[#2D1B17] tracking-tight">
                  {activeTab === 'cart' ? 'ตะกร้าของฉัน' : 'ประวัติ & สถานะออเดอร์'}
                </h1>
                <span className="rounded-md border border-[#2D1B17] bg-[#FFF8EF] px-1.5 py-0.2 text-[10px] font-black text-[#2D1B17]">
                  โต๊ะ {session?.tableNumber || '--'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-[#7B726B]">SHABU RIMS OS</p>
            </div>
          </div>

          {session && <BuffetTimer expiresAt={session.expiresAt} />}
        </header>

        {/* ── Neo-Brutalist Segmented Tabs ─────────────────────────── */}
        <div className="anim-down d-2 bg-white px-3.5 pt-2.5 pb-2 border-b-2 border-[#2D1B17] flex gap-2 shrink-0 shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange('cart')}
            className={`flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 rounded-xl border-2 transition-all active:translate-y-0.5 ${
              activeTab === 'cart'
                ? 'bg-[#2D1B17] text-white border-[#2D1B17] shadow-[2px_2px_0_#B97861]'
                : 'bg-[#FFF8EF] text-[#2D1B17] border-[#2D1B17] hover:bg-white'
            }`}
          >
            <span>🛒 ตะกร้าของฉัน</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'cart' ? 'bg-[#B97861] text-white' : 'bg-[#EAE5DF] text-[#2D1B17]'
            }`}>
              {totalCartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 rounded-xl border-2 transition-all active:translate-y-0.5 ${
              activeTab === 'history'
                ? 'bg-[#2D1B17] text-white border-[#2D1B17] shadow-[2px_2px_0_#B97861]'
                : 'bg-[#FFF8EF] text-[#2D1B17] border-[#2D1B17] hover:bg-white'
            }`}
          >
            <span>📋 ประวัติ & สถานะ</span>
            {orderGroups.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'history' ? 'bg-[#B97861] text-white' : 'bg-[#EAE5DF] text-[#2D1B17]'
              }`}>
                {orderGroups.length}
              </span>
            )}
          </button>
        </div>

        <QrExpiryBanner expiresAt={session?.expiresAt} />

        {/* ── Main Content Body ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 pb-[105px]">
          {error && (
            <div role="alert" className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700 shadow-[2px_2px_0_#DC2626] flex justify-between items-center">
              <span>{error}</span>
              <button onClick={fetchOrders} className="underline font-black ml-2">ลองใหม่</button>
            </div>
          )}
          
          {/* TAB 1: ตะกร้าของฉัน */}
          {activeTab === 'cart' && (
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#2D1B17] uppercase tracking-wider">
                  รายการพร้อมส่ง ({totalCartCount} จาน)
                </span>
                {cartItems.length > 0 && (
                  <button 
                    type="button"
                    onClick={clearCart} 
                    className="text-xs font-black text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                  >
                    ล้างตะกร้า
                  </button>
                )}
              </div>
              
              {cartItems.length > 0 ? (
                <div className="space-y-2.5">
                  {cartItems.map((item, idx) => {
                    const otherQuantity = cartItems
                      .filter((cartItem) => cartItem.menuItem.id === item.menuItem.id && cartItem.cartItemId !== item.cartItemId)
                      .reduce((total, cartItem) => total + cartItem.quantity, 0);
                    const isAtStockLimit = item.quantity + otherQuantity >= (item.menuItem.availableServings ?? Number.MAX_SAFE_INTEGER);
                    const removedNames = item.removedIngredients.map(id => {
                      const ing = item.menuItem.ingredients.find(i => i.id === id);
                      return ing ? ing.name : '';
                    }).filter(Boolean).join(', ');

                    return (
                      <div 
                        key={item.cartItemId} 
                        className={`shabu-card p-3 flex justify-between items-center bg-white anim-up d-${(idx % 4) + 1}`}
                      >
                        <div className="flex-1 pr-3">
                          <h3 className="text-xs font-black text-[#2D1B17] leading-snug">{item.menuItem.name}</h3>
                          {removedNames && (
                            <span className="inline-block text-[10px] text-red-700 font-bold bg-red-50 border border-red-200 px-1.5 py-0.2 rounded mt-1">
                              ไม่ใส่: {removedNames}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-0.5 shadow-[2px_2px_0_#2D1B17]">
                            <button 
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) updateQuantity(item.cartItemId, item.quantity - 1);
                              }} 
                              className="w-6 h-6 bg-white border border-[#2D1B17] rounded-lg flex items-center justify-center text-[#2D1B17] font-black shadow-xs active:translate-y-0.5"
                            >
                              <Minus size={11} strokeWidth={3} />
                            </button>
                            <span className="font-black text-[#2D1B17] text-xs px-2.5 count-anim">{item.quantity}</span>
                            <button 
                              type="button"
                              disabled={isAtStockLimit}
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              className="w-6 h-6 rounded-lg bg-[#B97861] border border-[#2D1B17] flex items-center justify-center text-white font-black shadow-xs active:translate-y-0.5 disabled:opacity-50"
                            >
                              <Plus size={11} strokeWidth={3} />
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeItem(item.cartItemId)} 
                            className="p-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            title="ลบรายการนี้"
                          >
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyCard 
                  message="ตะกร้าของคุณยังว่างอยู่" 
                  detail="คุณยังไม่ได้เลือกเมนูใดๆ กดปุ่มด้านล่างเพื่อกลับไปเลือกเมนูอร่อยๆ ได้ทันที" 
                  actionLabel="← ไปเลือกเมนูอาหาร" 
                  onAction={() => navigate('/order')} 
                />
              )}
            </div>
          )}

          {/* TAB 2: ประวัติและสถานะออเดอร์ */}
          {activeTab === 'history' && (
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#2D1B17] uppercase tracking-wider">
                  รอบออเดอร์ของโต๊ะนี้ ({orderGroups.length} รอบ)
                </span>
                <button 
                  type="button"
                  onClick={fetchOrders}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#B97861] hover:text-[#2D1B17] transition-colors"
                >
                  <RefreshCw size={11} strokeWidth={2.5} />
                  <span>รีเฟรชสถานะ</span>
                </button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-16 text-xs text-[#7B726B] font-black animate-pulse">
                  กำลังโหลดข้อมูลสถานะออเดอร์…
                </div>
              ) : orderGroups.length > 0 ? (
                <div className="space-y-2.5">
                  {orderGroups.map((group, groupIndex) => {
                    const totalQuantity = group.items.reduce((sum, item) => sum + item.qty, 0);
                    const servedQuantity = group.items.reduce((sum, item) => sum + item.servedQuantity, 0);
                    const returnedQuantity = group.items.reduce((sum, item) => sum + item.returnedQuantity, 0);
                    const status = orderGroupStatus(group.items);
                    const canCancel = group.items.every((item) => item.status === 'pending') && new Date(group.confirmAt).getTime() > now;

                    return (
                      <details
                        key={group.orderId}
                        open={expandedOrderIds.has(group.orderId)}
                        onToggle={(event) => {
                          const isOpen = event.currentTarget.open;
                          setExpandedOrderIds((current) => {
                            const next = new Set(current);
                            if (isOpen) next.add(group.orderId);
                            else next.delete(group.orderId);
                            return next;
                          });
                        }}
                        className={`group overflow-hidden rounded-2xl border-2 bg-white shadow-[3px_3px_0_#2D1B17] anim-up d-${(groupIndex % 4) + 1}`}
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3 [&::-webkit-details-marker]:hidden">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] text-xs font-black">
                            #{group.orderId}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-black text-[#2D1B17]">รอบออเดอร์ {group.time}</h3>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${status.tone}`}>{status.label}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-semibold text-[#7B726B]">
                              {group.items.length} เมนู · {totalQuantity} จาน · เสิร์ฟ {servedQuantity}{returnedQuantity > 0 ? ` · ยกเลิก ${returnedQuantity}` : ''}
                            </p>
                          </div>
                          <ChevronDown size={18} className="shrink-0 text-[#7B726B] transition-transform group-open:rotate-180" />
                        </summary>

                        <div className="border-t-2 border-[#2D1B17]/10 bg-[#FFFDF9] px-3 py-1">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 border-b border-[#EAE5DF] py-2.5 last:border-b-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 rounded-md bg-[#2D1B17] px-2 py-0.5 text-[10px] font-black text-white">{item.qty}×</span>
                                <span className="truncate text-xs font-black text-[#2D1B17]">{item.name}</span>
                              </div>
                              {item.status === 'pending' ? (
                                <span className="shrink-0 text-[10px] font-black text-[#7B726B]"><Clock size={10} className="mr-1 inline" />รอยืนยัน</span>
                              ) : item.status === 'cooking' ? (
                                <span className="shrink-0 text-[10px] font-black text-[#92400E]"><ChefHat size={10} className="mr-1 inline" />กำลังเตรียม</span>
                              ) : item.status === 'serving' ? (
                                <span className="shrink-0 text-[10px] font-black text-[#1E40AF]"><Utensils size={10} className="mr-1 inline" />เสิร์ฟ {item.servedQuantity}/{item.qty - item.returnedQuantity}</span>
                              ) : item.status === 'cancelled' ? (
                                <span className="shrink-0 text-[10px] font-black text-[#991B1B]"><XCircle size={10} className="mr-1 inline" />{item.servedQuantity > 0 ? `เสิร์ฟ ${item.servedQuantity} · ยกเลิก ${item.returnedQuantity}` : `ยกเลิก ${item.returnedQuantity || item.qty}`}</span>
                              ) : (
                                <span className="shrink-0 text-[10px] font-black text-[#166534]"><Check size={10} className="mr-1 inline" />เสิร์ฟแล้ว {item.servedQuantity}/{item.qty - item.returnedQuantity}</span>
                              )}
                            </div>
                          ))}
                          {canCancel && (
                            <button type="button" onClick={() => handleCancelOrder(group.orderId)} className="mb-2 mt-1 text-[10px] font-black text-red-600 underline hover:text-red-800">
                              ยกเลิกรอบออเดอร์นี้
                            </button>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <EmptyCard 
                  message="ยังไม่มีประวัติการสั่งอาหาร" 
                  detail="เมื่อคุณส่งออเดอร์เข้าครัว จะสามารถติดตามสถานะการปรุงและการจัดเสิร์ฟได้ที่นี่แบบเรียลไทม์" 
                  actionLabel="← ไปเริ่มสั่งอาหาร"
                  onAction={() => navigate('/order')}
                />
              )}
            </div>
          )}

        </div>

        <CallStaffButton />

        {/* ── Sticky Bottom Action Bar ─────────────────────────────── */}
        <div className="absolute bottom-0 left-0 w-full bg-[#FFF8EF] border-t-2 border-[#2D1B17] p-3 shadow-[0_-6px_20px_rgba(45,27,23,0.12)] z-30">
          {activeTab === 'cart' ? (
            cartItems.length > 0 ? (
              <button 
                type="button"
                disabled={isSubmitting || orderingClosed}
                onClick={handleCheckout} 
                className={`shabu-btn-primary w-full py-3 text-sm transition-all shadow-[3px_3px_0_#B97861] ${
                  orderingClosed ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {orderingClosed ? 'ปิดรับออเดอร์ใน 10 นาทีสุดท้าย' : (isSubmitting ? 'กำลังส่งออเดอร์…' : `ส่งออเดอร์เข้าครัว (${totalCartCount} จาน)`)}
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => navigate('/order')} 
                className="shabu-btn-secondary w-full py-3 text-sm"
              >
                ← กลับไปเลือกเมนูอาหาร
              </button>
            )
          ) : (
            <button 
              type="button"
              onClick={() => navigate('/order')} 
              className="shabu-btn-primary w-full py-3 text-sm"
            >
              + สั่งอาหารเพิ่ม
            </button>
          )}
        </div>

      </div>
      
      {import.meta.env.DEV && <DevTimeTools onTriggerFetch={fetchOrders} />}
    </div>
  );
}
