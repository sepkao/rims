import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useCart, type MenuItem } from '../lib/CartContext';

const Icons = {
  ArrowLeft: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  ),
  Minus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Alert: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  )
};

// ฟังก์ชันจำลองรูปภาพเหมือนหน้า Menu
const mockImages = [
  "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1577640905050-83665af216b9?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591071477751-248358d7c4e5?q=80&w=400&auto=format&fit=crop"
];

export default function OrderBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [qty, setQty] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      .then((data) => {
        const found = data.menuItems.find(i => i.id === id);
        if (found) {
          setItem(found);
        } else {
          setError('ไม่พบเมนูนี้');
        }
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleIngredient = (ingredientId: string) => {
    setRemovedIngredients(prev => 
      prev.includes(ingredientId) ? prev.filter(i => i !== ingredientId) : [...prev, ingredientId]
    );
  };

  const handleConfirmOrder = () => {
    if (item) {
      addItem({
        menuItem: item,
        quantity: qty,
        removedIngredients
      });
      navigate('/order');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-200 flex justify-center items-center font-sans font-bold text-[#7B726B]">กำลังโหลด...</div>;
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-200 flex flex-col justify-center items-center font-sans">
        <div className="text-red-500 font-bold mb-4">{error}</div>
        <button onClick={() => navigate('/order')} className="neo-btn px-6 py-2 font-bold">กลับไปหน้าเมนู</button>
      </div>
    );
  }
  
  // Use a pseudo-random image based on ID
  const itemIndex = item.id.charCodeAt(0) % mockImages.length;
  const imgUrl = mockImages[itemIndex];

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative neo-wrapper overflow-hidden">
        
        {/* --- Header แบบโปร่งใสทับรูป --- */}
        <div className="absolute top-0 w-full p-4 z-20 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/80 backdrop-blur-md text-[#302221] hover:bg-white rounded-full shadow-sm">
            <Icons.ArrowLeft />
          </button>
        </div>

        {/* --- รูปภาพอาหาร --- */}
        <div className="h-[40%] shrink-0 relative bg-gray-200 border-b-2 border-[#2d1b17]">
          <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h1 className="text-2xl font-black">{item.name}</h1>
          </div>
        </div>

        {/* --- เนื้อหาปรับแต่ง --- */}
        <div className="flex-1 overflow-y-auto pb-[100px] bg-[#FDFBF7]">
          <div className="p-5">
            {item.description && (
              <p className="text-sm text-[#7B726B] leading-relaxed mb-6">
                {item.description}
              </p>
            )}

            {/* ส่วนเลือกจำนวน */}
            <div className="flex items-center justify-between py-4 border-y border-[#EAE5DF] mb-6">
              <span className="font-bold text-[#302221]">จำนวน (ที่)</span>
              <div className="flex items-center bg-[#F4EFEA] rounded-xl px-2 py-1 gap-4 shadow-inner">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 flex items-center justify-center neo-btn-secondary transition-colors"
                >
                  <Icons.Minus />
                </button>
                <span className="font-black text-[#302221] text-lg w-4 text-center">{qty}</span>
                <button 
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 flex items-center justify-center neo-btn"
                >
                  <Icons.Plus />
                </button>
              </div>
            </div>

            {/* ส่วนปรับแต่งส่วนผสม */}
            {item.ingredients.length > 0 && (
              <div>
                <h3 className="font-bold text-[#302221] mb-1">ปรับแต่งส่วนผสม</h3>
                <p className="text-[11px] text-[#7B726B] mb-4">สามารถเลือกไม่ใส่ส่วนผสมบางอย่างได้</p>
                
                <div className="space-y-3">
                  {item.ingredients.map(ing => (
                    <div key={ing.id} className="flex items-center justify-between p-3 neo-card">
                      <span className={`text-sm font-medium ${!ing.removable ? 'text-[#302221]' : removedIngredients.includes(ing.id) ? 'text-[#999] line-through' : 'text-[#302221]'}`}>
                        {ing.name}
                      </span>
                      
                      {!ing.removable ? (
                        <span className="text-[10px] text-[#E53E3E] bg-[#FEF2F2] px-2 py-1 rounded font-bold">ถอดไม่ได้</span>
                      ) : (
                        <button 
                          onClick={() => handleToggleIngredient(ing.id)}
                          className={`text-xs font-bold px-3 py-1.5 transition-colors ${
                            removedIngredients.includes(ing.id) 
                              ? 'neo-btn-danger' 
                              : 'neo-btn-secondary'
                          }`}
                        >
                          {removedIngredients.includes(ing.id) ? 'ไม่ใส่' : 'ใส่ปกติ'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>

        {/* --- ปุ่มยืนยันด้านล่าง --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t-2 border-[#2d1b17] p-4 shadow-[0_-4px_0_#2d1b17] z-30">
          <button 
            onClick={() => setShowConfirm(true)}
            className="w-full py-4 neo-btn font-bold text-lg flex items-center justify-center gap-2"
          >
            เพิ่มลงตะกร้า • {qty} ที่
          </button>
        </div>

        {/* --- Modal ยืนยันคำสั่งซื้อ (Popup ที่ 2 ตามสเปค) --- */}
        {showConfirm && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="neo-surface w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-8">
              <div className="flex justify-center mb-4">
                <div className="bg-[#FEF3C7] p-3 rounded-full">
                  <Icons.Alert />
                </div>
              </div>
              <h2 className="text-xl font-black text-center text-[#302221] mb-2">ยืนยันการสั่งอาหาร?</h2>
              <p className="text-sm text-center text-[#7B726B] mb-6 leading-relaxed">
                คุณต้องการสั่ง <span className="font-bold text-[#5A403E]">{item.name} ({qty} ที่)</span> ใช่หรือไม่?<br/>
                <span className="text-[11px] text-[#10B981]">*หลังจากกดตกลง รายการจะถูกเพิ่มลงในตะกร้าของคุณ</span>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3.5 neo-btn-secondary font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3.5 neo-btn font-bold transition-colors"
                >
                  ตกลง
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
