import { useNavigate } from 'react-router-dom';
import { useCart } from '../lib/CartContext';

// --- Icons สำหรับหน้า Cart ---
const Icons = {
  ArrowLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Cooking: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="M10 4v4"></path><path d="M14 2v6"></path></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
};

function EmptyCard({ message, detail, actionLabel, onAction }: { message: string; detail: string; actionLabel?: string; onAction?: () => void }) { 
  return (
    <div className="neo-card border-dashed p-8 text-center">
      <p className="font-bold text-[#302221]">{message}</p>
      <p className="mt-1 text-xs text-[#7B726B]">{detail}</p>
      {actionLabel && (
        <button onClick={onAction} className="mt-5 px-4 py-2 text-xs neo-btn">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeItem, clearCart } = useCart();

  // Mock Data: รายการที่ส่งเข้าครัวไปแล้ว
  const orderedItems = [
    { id: 5, name: "กุ้งแม่น้ำ", qty: 1, status: "cooking", time: "19:45" },
    { id: 7, name: "น้ำซุปหม่าล่า", qty: 1, status: "served", time: "19:42" },
  ];
  
  const handleCheckout = () => {
    // Ideally we would POST to an orders API here, then clear cart
    clearCart();
    navigate('/order/success');
  };

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative neo-wrapper overflow-hidden">
        
        {/* --- Header --- */}
        <div className="bg-white px-5 py-4 border-b-2 border-[#2d1b17] shrink-0 sticky top-0 z-20 flex items-center gap-3 shadow-sm">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-[#302221] hover:bg-gray-100 rounded-full">
            <Icons.ArrowLeft />
          </button>
          <h1 className="text-lg font-bold text-[#302221]">ตะกร้าของฉัน / สถานะ</h1>
        </div>

        {/* --- Main Content (เลื่อนได้) --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px]">
          
          {/* Section 1: รายการที่กำลังจะสั่ง */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#7B726B] mb-3 flex justify-between items-center">
              รายการที่กำลังจะสั่ง (รอส่ง)
              {cartItems.length > 0 && <span onClick={clearCart} className="text-[#E53E3E] text-xs font-medium bg-[#FEF2F2] px-2 py-0.5 rounded cursor-pointer">ล้างตะกร้า</span>}
            </h2>
            
            {cartItems.length > 0 ? (
              <div className="neo-card overflow-hidden">
                {cartItems.map((item, idx) => {
                  const removedNames = item.removedIngredients.map(id => {
                    const ing = item.menuItem.ingredients.find(i => i.id === id);
                    return ing ? ing.name : '';
                  }).filter(Boolean).join(', ');

                  return (
                    <div key={item.cartItemId} className={`p-4 flex justify-between items-center ${idx !== cartItems.length - 1 ? 'border-b border-[#F4EFEA]' : ''}`}>
                      <div className="flex-1">
                        <h3 className="text-[14px] font-bold text-[#302221]">{item.menuItem.name}</h3>
                        <p className="text-xs text-[#7B726B]">฿{item.menuItem.price.toLocaleString()}</p>
                        {removedNames && <p className="text-[11px] text-[#E53E3E] mt-1 font-medium">(ไม่ใส่: {removedNames})</p>}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* ปุ่มเพิ่มลดจำนวนขนาดเล็ก */}
                        <div className="flex items-center bg-[#F4EFEA] rounded-md px-2 py-1 gap-3">
                          <button 
                            onClick={() => {
                              if (item.quantity > 1) updateQuantity(item.cartItemId, item.quantity - 1);
                            }} 
                            className="text-[#5A403E] font-bold"
                          >-</button>
                          <span className="font-bold text-[#302221] text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="text-[#5A403E] font-bold"
                          >+</button>
                        </div>
                        <button onClick={() => removeItem(item.cartItemId)} className="p-1"><Icons.Trash /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyCard 
                message="ยังไม่มีรายการในตะกร้า" 
                detail="กลับไปหน้าเมนูเพื่อเลือกอาหาร" 
                actionLabel="เลือกเมนู" 
                onAction={() => navigate('/order')} 
              />
            )}
          </div>

          {/* Section 2: รายการที่สั่งไปแล้ว (สถานะ) */}
          <div>
            <h2 className="text-sm font-bold text-[#7B726B] mb-3">ประวัติการสั่งอาหาร</h2>
            
            {orderedItems.length > 0 ? (
              <div className="neo-card p-2">
                {orderedItems.map((item, idx) => (
                  <div key={item.id} className={`p-3 flex justify-between items-center ${idx !== orderedItems.length - 1 ? 'border-b border-dashed border-[#EAE5DF]' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-[#EAE5DF] text-[#555] px-1.5 rounded">x{item.qty}</span>
                        <h3 className="text-[13px] font-bold text-[#302221]">{item.name}</h3>
                      </div>
                      <p className="text-[10px] text-[#999] ml-7">สั่งเมื่อ {item.time}</p>
                    </div>
                    
                    {/* Status Badge */}
                    {item.status === 'cooking' ? (
                      <div className="flex items-center gap-1.5 bg-[#FEF3C7] text-[#D97706] px-2 py-1 rounded-md text-[11px] font-bold">
                        <Icons.Cooking /> กำลังเตรียม
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-[#D1FAE5] text-[#059669] px-2 py-1 rounded-md text-[11px] font-bold">
                        <Icons.Check /> เสิร์ฟแล้ว
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard 
                message="ยังไม่มีประวัติการสั่งซื้อ" 
                detail="รายการสั่งซื้อจะแสดงหลังจากเชื่อมต่อ orders API" 
              />
            )}
          </div>

        </div>

        {/* --- Sticky Bottom Button (ยืนยันการสั่ง) --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t-2 border-[#2d1b17] p-4 shadow-[0_-4px_0_#2d1b17] z-30">
          <button 
            disabled={cartItems.length === 0}
            onClick={handleCheckout} 
            className={`w-full py-3.5 flex items-center justify-center gap-2 font-bold transition-all
              ${cartItems.length > 0 ? 'neo-btn' : 'neo-btn-secondary text-[#999] cursor-not-allowed opacity-50'}`}
          >
            ส่งออเดอร์เข้าครัว {cartItems.length > 0 ? `(${cartItems.reduce((acc, i) => acc + i.quantity, 0)} รายการ)` : ''}
          </button>
        </div>

      </div>
    </div>
  );
}
