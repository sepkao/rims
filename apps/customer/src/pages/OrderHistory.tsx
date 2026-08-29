import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../lib/CartContext';
import CallStaffButton from '../components/CallStaffButton';
import BuffetTimer from '../components/BuffetTimer';
import DevTimeTools from '../components/DevTimeTools';

const Icons = {
  ArrowLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Cooking: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  CuteFace: () => (
    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
      <circle cx="50" cy="50" r="45" fill="#F4EFEA"/>
      <path d="M 30 45 Q 35 35 40 45" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M 60 45 Q 65 35 70 45" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <circle cx="25" cy="55" r="5" fill="#FCA5A5" opacity="0.6"/>
      <circle cx="75" cy="55" r="5" fill="#FCA5A5" opacity="0.6"/>
      <path d="M 55 58 Q 58 65 55 70 Q 52 65 55 58" fill="#93C5FD" opacity="0.8"/>
      <path d="M 40 55 Q 50 70 60 55" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  SadFace: () => (
    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4">
      <circle cx="50" cy="50" r="45" fill="#F4EFEA"/>
      <path d="M 30 40 Q 35 45 40 40" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M 60 40 Q 65 45 70 40" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <circle cx="25" cy="45" r="5" fill="#FCA5A5" opacity="0.6"/>
      <circle cx="75" cy="45" r="5" fill="#FCA5A5" opacity="0.6"/>
      <path d="M 35 55 Q 35 65 30 65 Q 25 65 25 55 Q 30 45 35 55" fill="#93C5FD" opacity="0.8"/>
      <path d="M 40 65 Q 50 55 60 65" stroke="#5A403E" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </svg>
  )
};

function EmptyCard({ message, detail, actionLabel, onAction, iconType }: { message: string; detail: string; actionLabel?: string; onAction?: () => void; iconType?: 'cute' | 'sad' }) { 
  return (
    <div className="bg-white rounded-xl border border-dashed border-[#EAE5DF] p-8 text-center shadow-sm">
      {iconType === 'cute' && <Icons.CuteFace />}
      {iconType === 'sad' && <Icons.SadFace />}
      <p className="font-bold text-[#302221]">{message}</p>
      <p className="mt-1 text-xs text-[#7B726B]">{detail}</p>
      {actionLabel && (
        <button onClick={onAction} className="mt-5 px-5 py-2 text-xs bg-white border border-[#EAE5DF] rounded-lg font-bold text-[#302221] hover:bg-gray-50 transition-colors shadow-sm">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const [orderedItems, setOrderedItems] = useState<any[]>([]);
  const [session, setSession] = useState<{ startedAt: string, expiresAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:3000/customer/orders?table_session_id=1');
      if (res.ok) {
        const data = await res.json();
        setOrderedItems(data.items || []);
        if (data.session) setSession(data.session);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling for status update
    return () => clearInterval(interval);
  }, []);
  
  const handleCheckout = async () => {
    if (cartItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        tableSessionId: 1,
        items: cartItems.map(i => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          removedIngredients: i.removedIngredients
        }))
      };
      
      const res = await fetch('http://localhost:3000/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        clearCart();
        navigate('/order/success');
      } else {
        alert('เกิดข้อผิดพลาดในการสั่งอาหาร');
      }
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการสั่งอาหาร');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/customer/orders/${orderId}/cancel`, { method: 'POST' });
      if (res.ok) {
        fetchOrders();
      } else {
        alert('หมดเวลายกเลิก หรือ ออเดอร์นี้ถูกยกเลิกไปแล้ว');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการยกเลิกออเดอร์');
    }
  };

  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-xl overflow-hidden">
        
        {/* --- Header --- */}
        <div className="bg-white px-5 py-4 border-b border-[#EAE5DF] shrink-0 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-[#302221] hover:bg-gray-100 rounded-full transition-colors">
              <Icons.ArrowLeft />
            </button>
            <h1 className="text-lg font-bold text-[#302221]">ตะกร้าของฉัน</h1>
          </div>
          {session && <BuffetTimer expiresAt={session.expiresAt} />}
        </div>

        {/* --- Main Content --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px]">
          
          {/* Section 1: รายการที่กำลังจะสั่ง */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#7B726B] mb-3 flex justify-between items-center">
              รายการที่อยู่ในตะกร้า
              {cartItems.length > 0 && <span onClick={clearCart} className="text-[#E53E3E] text-xs font-medium bg-[#FEF2F2] px-2.5 py-1 rounded-md cursor-pointer hover:bg-[#FEE2E2] transition-colors">ล้างตะกร้า</span>}
            </h2>
            
            {cartItems.length > 0 ? (
              <div className="bg-white rounded-xl border border-[#EAE5DF] shadow-sm overflow-hidden">
                {cartItems.map((item, idx) => {
                  const removedNames = item.removedIngredients.map(id => {
                    const ing = item.menuItem.ingredients.find(i => i.id === id);
                    return ing ? ing.name : '';
                  }).filter(Boolean).join(', ');

                  return (
                    <div key={item.cartItemId} className={`p-4 flex justify-between items-center ${idx !== cartItems.length - 1 ? 'border-b border-[#F4EFEA]' : ''}`}>
                      <div className="flex-1 pr-4">
                        <h3 className="text-[14px] font-bold text-[#302221] mb-0.5">{item.menuItem.name}</h3>
                        {removedNames && <p className="text-[11px] text-[#E53E3E] mt-1 font-medium">(ไม่ใส่: {removedNames})</p>}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-[#F4EFEA] rounded-lg px-2 py-1 gap-3 border border-[#EAE5DF]/50 shadow-inner">
                          <button 
                            onClick={() => {
                              if (item.quantity > 1) updateQuantity(item.cartItemId, item.quantity - 1);
                            }} 
                            className="text-[#5A403E] font-bold w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm"
                          >-</button>
                          <span className="font-bold text-[#302221] text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="text-white font-bold bg-[#5A403E] w-6 h-6 flex items-center justify-center rounded-md shadow-sm"
                          >+</button>
                        </div>
                        <button onClick={() => removeItem(item.cartItemId)} className="p-2 bg-[#FEF2F2] text-[#E53E3E] rounded-lg hover:bg-[#FEE2E2] transition-colors"><Icons.Trash /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyCard 
                message="ยังไม่มีงับบ" 
                detail="กลับไปหน้าเมนูเพื่อเลือกอาหาร" 
                actionLabel="เลือกเมนู" 
                onAction={() => navigate('/order')} 
                iconType="cute"
              />
            )}
          </div>

          {/* Section 2: รายการที่สั่งไปแล้ว */}
          <div>
            <h2 className="text-sm font-bold text-[#7B726B] mb-3">ประวัติการสั่งอาหาร</h2>
            
            {isLoading ? (
              <div className="text-center p-8 text-sm text-[#7B726B] font-bold">กำลังโหลดประวัติ...</div>
            ) : orderedItems.length > 0 ? (
              <div className="bg-white rounded-xl border border-[#EAE5DF] p-2 shadow-sm">
                {orderedItems.map((item, idx) => (
                  <div key={item.id} className={`p-3 flex justify-between items-center ${idx !== orderedItems.length - 1 ? 'border-b border-dashed border-[#EAE5DF]' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-[#F4EFEA] text-[#5A403E] px-1.5 py-0.5 rounded">x{item.qty}</span>
                        <h3 className="text-[13px] font-bold text-[#302221]">{item.name}</h3>
                      </div>
                      <p className="text-[10px] text-[#999] ml-8">สั่งเมื่อ {item.time}</p>
                    </div>
                    
                    {item.status === 'pending' ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5 bg-[#F3F4F6] text-[#4B5563] px-2.5 py-1 rounded-md text-[11px] font-bold">
                          <Icons.Clock /> รอครัวยืนยัน
                        </div>
                        <button 
                          onClick={() => handleCancelOrder(item.orderId)}
                          className="text-[10px] text-[#E53E3E] underline hover:text-[#C53030]"
                        >
                          ยกเลิก (เปลี่ยนใจ)
                        </button>
                      </div>
                    ) : item.status === 'cooking' ? (
                      <div className="flex items-center gap-1.5 bg-[#FEF3C7] text-[#D97706] px-2.5 py-1 rounded-md text-[11px] font-bold h-fit">
                        <Icons.Cooking /> กำลังเตรียม
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-[#D1FAE5] text-[#059669] px-2.5 py-1 rounded-md text-[11px] font-bold h-fit">
                        <Icons.Check /> เสิร์ฟแล้ว
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard 
                message="ยังไม่มีประวัติการสั่งซื้อ" 
                detail="รายการสั่งซื้อจะแสดงหลังจากเริ่มสั่งอาหาร" 
                iconType="sad"
              />
            )}
          </div>

        </div>

        <CallStaffButton />

        {/* --- Sticky Bottom Button --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#EAE5DF] p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-30">
          <button 
            disabled={cartItems.length === 0 || isSubmitting}
            onClick={handleCheckout} 
            className={`w-full py-3.5 flex items-center justify-center gap-2 font-bold transition-colors rounded-lg text-sm
              ${cartItems.length > 0 && !isSubmitting ? 'bg-[#5A403E] hover:bg-[#4A3432] text-white shadow-md' : 'bg-[#F4EFEA] text-[#999] cursor-not-allowed'}`}
          >
            {isSubmitting ? 'กำลังส่งออเดอร์...' : `ส่งออเดอร์เข้าครัว ${cartItems.length > 0 ? `(${cartItems.reduce((acc, i) => acc + i.quantity, 0)} รายการ)` : ''}`}
          </button>
        </div>

      </div>
      
      <DevTimeTools onTriggerFetch={fetchOrders} />
    </div>
  );
}
