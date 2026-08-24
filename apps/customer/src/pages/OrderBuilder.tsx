import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

// Mock data สำหรับเมนูที่ถูกเลือก
const mockItem = {
  id: 1,
  name: "เนื้อวากิวออสเตรเลีย",
  category: "เนื้อวัว",
  img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=400&auto=format&fit=crop",
  description: "เนื้อวากิวพรีเมียม ลายหินอ่อน นุ่มละลายในปาก (1 ถาด / 100g)",
  ingredients: [
    { id: 101, name: "เนื้อวากิว", removable: false },
    { id: 102, name: "ต้นหอมซอย (โรยหน้า)", removable: true },
    { id: 103, name: "งาขาว", removable: true }
  ]
};

export default function OrderBuilder() {
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // เก็บ State ว่าส่วนผสมไหนถูก "เอาออก" บ้าง (เก็บ id)
  const [removedIngredients, setRemovedIngredients] = useState<number[]>([]);

  const handleToggleIngredient = (id: number) => {
    setRemovedIngredients(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirmOrder = () => {
    // ไปหน้า Countdown (Grace Period)
    navigate('/countdown');
  };

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* --- Header แบบโปร่งใสทับรูป --- */}
        <div className="absolute top-0 w-full p-4 z-20 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/80 backdrop-blur-md text-[#302221] hover:bg-white rounded-full shadow-sm">
            <Icons.ArrowLeft />
          </button>
        </div>

        {/* --- รูปภาพอาหาร --- */}
        <div className="h-[40%] shrink-0 relative bg-gray-200">
          <img src={mockItem.img} alt={mockItem.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-2 py-1 rounded-md mb-2 inline-block uppercase tracking-wider">
              {mockItem.category}
            </span>
            <h1 className="text-2xl font-black">{mockItem.name}</h1>
          </div>
        </div>

        {/* --- เนื้อหาปรับแต่ง --- */}
        <div className="flex-1 overflow-y-auto pb-[100px] bg-[#FDFBF7]">
          <div className="p-5">
            <p className="text-sm text-[#7B726B] leading-relaxed mb-6">
              {mockItem.description}
            </p>

            {/* ส่วนเลือกจำนวน */}
            <div className="flex items-center justify-between py-4 border-y border-[#EAE5DF] mb-6">
              <span className="font-bold text-[#302221]">จำนวน (ถาด)</span>
              <div className="flex items-center bg-[#F4EFEA] rounded-xl px-2 py-1 gap-4 shadow-inner">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 flex items-center justify-center text-[#5A403E] hover:bg-white rounded-lg transition-colors"
                >
                  <Icons.Minus />
                </button>
                <span className="font-black text-[#302221] text-lg w-4 text-center">{qty}</span>
                <button 
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 flex items-center justify-center text-white bg-[#5A403E] rounded-lg shadow-sm"
                >
                  <Icons.Plus />
                </button>
              </div>
            </div>

            {/* ส่วนปรับแต่งส่วนผสม */}
            <div>
              <h3 className="font-bold text-[#302221] mb-1">ปรับแต่งส่วนผสม</h3>
              <p className="text-[11px] text-[#7B726B] mb-4">สามารถเลือกไม่ใส่ส่วนผสมบางอย่างได้</p>
              
              <div className="space-y-3">
                {mockItem.ingredients.map(ing => (
                  <div key={ing.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#EAE5DF] shadow-sm">
                    <span className={`text-sm font-medium ${!ing.removable ? 'text-[#302221]' : removedIngredients.includes(ing.id) ? 'text-[#999] line-through' : 'text-[#302221]'}`}>
                      {ing.name}
                    </span>
                    
                    {!ing.removable ? (
                      <span className="text-[10px] text-[#E53E3E] bg-[#FEF2F2] px-2 py-1 rounded font-bold">ถอดไม่ได้</span>
                    ) : (
                      <button 
                        onClick={() => handleToggleIngredient(ing.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${
                          removedIngredients.includes(ing.id) 
                            ? 'bg-[#FEF2F2] text-[#E53E3E] border-[#FCA5A5]' 
                            : 'bg-white text-[#7B726B] border-[#d6d0c4] hover:bg-gray-50'
                        }`}
                      >
                        {removedIngredients.includes(ing.id) ? 'ไม่ใส่' : 'ใส่ปกติ'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>

        {/* --- ปุ่มยืนยันด้านล่าง --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#EAE5DF] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30">
          <button 
            onClick={() => setShowConfirm(true)}
            className="w-full py-4 rounded-xl bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold text-lg transition-all shadow-md flex items-center justify-center gap-2"
          >
            เพิ่มลงตะกร้า • {qty} ถาด
          </button>
        </div>

        {/* --- Modal ยืนยันคำสั่งซื้อ (Popup ที่ 2 ตามสเปค) --- */}
        {showConfirm && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-8">
              <div className="flex justify-center mb-4">
                <div className="bg-[#FEF3C7] p-3 rounded-full">
                  <Icons.Alert />
                </div>
              </div>
              <h2 className="text-xl font-black text-center text-[#302221] mb-2">ยืนยันการสั่งอาหาร?</h2>
              <p className="text-sm text-center text-[#7B726B] mb-6 leading-relaxed">
                คุณต้องการสั่ง <span className="font-bold text-[#5A403E]">{mockItem.name} ({qty} ถาด)</span> ใช่หรือไม่?<br/>
                <span className="text-[11px] text-[#E53E3E]">*หลังจากกดตกลง ระบบจะเริ่มนับถอยหลังก่อนส่งเข้าครัว</span>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3.5 rounded-xl bg-gray-100 text-[#7B726B] font-bold hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3.5 rounded-xl bg-[#5A403E] text-white font-bold hover:bg-[#4a322f] transition-colors shadow-md"
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
