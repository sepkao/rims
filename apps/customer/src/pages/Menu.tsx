import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Icons สำหรับฝั่งลูกค้า ---
const Icons = {
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Search: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Fire: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="#E53E3E" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>,
  ShoppingBag: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  Minus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

// --- Mock Data เมนูอาหาร ---
const categories = ["ทั้งหมด", "เนื้อวัว", "หมู", "ซีฟู้ด", "ลูกชิ้น/ผัก", "ของทานเล่น"];

const menuItems = [
  { id: 1, name: "เนื้อวากิวออสเตรเลีย", category: "เนื้อวัว", recommend: true, img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "เนื้อวากิว", removable: false }, { name: "ต้นหอม", removable: true }, { name: "งาขาว", removable: true }] },
  { id: 2, name: "เนื้อเสือร้องไห้", category: "เนื้อวัว", recommend: false, img: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "เนื้อเสือร้องไห้", removable: false }] },
  { id: 3, name: "เนื้อริบอาย", category: "เนื้อวัว", recommend: true, img: "https://images.unsplash.com/photo-1544025162-8315ea011887?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "เนื้อริบอาย", removable: false }, { name: "พริกไทยดำ", removable: true }] },
  { id: 4, name: "หมูสามชั้นสไลด์", category: "หมู", recommend: true, img: "https://images.unsplash.com/photo-1577640905050-83665af216b9?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "หมูสามชั้น", removable: false }, { name: "งาขาว", removable: true }] },
  { id: 5, name: "หมูสันคอ", category: "หมู", recommend: false, img: "https://images.unsplash.com/photo-1514838634140-5e3a8905b633?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "หมูสันคอ", removable: false }] },
  { id: 6, name: "เบคอน", category: "หมู", recommend: false, img: "https://images.unsplash.com/photo-1606850083984-d456a6ec15e0?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "เบคอนรมควัน", removable: false }] },
  { id: 7, name: "กุ้งแม่น้ำ", category: "ซีฟู้ด", recommend: true, img: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "กุ้งแม่น้ำ", removable: false }] },
  { id: 8, name: "ปลาหมึกกรอบ", category: "ซีฟู้ด", recommend: false, img: "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "ปลาหมึกกรอบ", removable: false }] },
  { id: 9, name: "ลูกชิ้นกุ้ง", category: "ลูกชิ้น/ผัก", recommend: true, img: "https://images.unsplash.com/photo-1591071477751-248358d7c4e5?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "ลูกชิ้นกุ้ง", removable: false }] },
  { id: 10, name: "ชุดผักรวม", category: "ลูกชิ้น/ผัก", recommend: false, img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "ผักกาดขาว", removable: true }, { name: "เห็ดเข็มทอง", removable: true }, { name: "แครอท", removable: true }] },
  { id: 11, name: "เฟรนช์ฟรายส์", category: "ของทานเล่น", recommend: false, img: "https://images.unsplash.com/photo-1576107222849-5f2575a6c11d?q=80&w=400&auto=format&fit=crop", ingredients: [{ name: "มันฝรั่งทอด", removable: false }, { name: "เกลือ", removable: true }, { name: "ซอสมะเขือเทศ", removable: true }] },
];

export default function Menu() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  
  // สร้าง State เก็บตะกร้า { '1': 2, '3': 1 } (ไอดีเมนู: จำนวน)
  const [cart, setCart] = useState<Record<number, number>>({});

  const handleAdd = (id: number) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleRemove = (id: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id] -= 1;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  };

  // นับจำนวนของในตะกร้าทั้งหมด
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    // ครอบด้วย div สีเทาเข้ม แล้วจำลองหน้าจอมือถือตรงกลาง (Mobile View Simulator)
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* --- Header (Fix ติดขอบบน) --- */}
        <div className="bg-white px-5 py-4 border-b border-[#EAE5DF] shrink-0 sticky top-0 z-20">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-xl font-black text-[#5A403E] tracking-wide">SHABU INVEN</h1>
              <p className="text-[11px] font-bold text-[#7B726B]">Buffet Premium (฿599)</p>
            </div>
            {/* กล่องเวลา */}
            <div className="bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="text-[#DC2626]"><Icons.Clock /></span>
              <span className="text-sm font-bold text-[#DC2626] font-mono mt-0.5">01:29:45</span>
            </div>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-lg font-bold text-[#302221]">โต๊ะ 08 <span className="text-sm font-normal text-[#7B726B] ml-1">(4 ท่าน)</span></span>
            <span className="text-sm text-[#10B981] font-bold bg-[#D1FAE5] px-2 py-0.5 rounded">กำลังทาน</span>
          </div>
        </div>

        {/* --- Search & Category Tabs --- */}
        <div className="bg-white px-5 pt-3 pb-2 shrink-0 z-10 shadow-sm">
          <div className="relative mb-3">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
            <input 
              type="text" 
              placeholder="ค้นหาเมนู..." 
              className="w-full pl-10 pr-4 py-2 bg-[#F4EFEA] border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#5A403E]"
            />
          </div>

          {/* แถบเลื่อนหมวดหมู่ */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors
                  ${activeCategory === cat ? 'bg-[#5A403E] text-white' : 'bg-white border border-[#d6d0c4] text-[#7B726B] hover:bg-[#F4EFEA]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- Menu Grid (พื้นที่เลื่อนได้) --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px]">
          <div className="grid grid-cols-2 gap-4">
            {menuItems
              .filter(item => activeCategory === "ทั้งหมด" || item.category === activeCategory)
              .map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-[#EAE5DF] overflow-hidden shadow-sm flex flex-col">
                <div className="h-32 bg-gray-200 relative">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                  {item.recommend && (
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Icons.Fire /> <span className="text-[10px] font-bold text-[#E53E3E]">แนะนำ</span>
                    </div>
                  )}
                </div>
                
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[13px] font-bold text-[#302221] leading-tight mb-1">{item.name}</h3>
                  <div className="flex flex-wrap gap-1 mb-3 flex-1 content-start">
                    {item.ingredients.map((ing, i) => (
                      <span key={i} className="text-[9px] text-[#7B726B] bg-[#F4EFEA] px-1.5 py-0.5 rounded">
                        {ing.name} {ing.removable && <span className="text-[#999] ml-0.5">(ไม่เอา)</span>}
                      </span>
                    ))}
                  </div>
                  
                  {/* ปุ่มกดจำนวน */}
                  {cart[item.id] ? (
                    <div className="flex items-center justify-between bg-[#F4EFEA] rounded-lg p-1">
                      <button onClick={() => handleRemove(item.id)} className="w-7 h-7 bg-white rounded-md flex items-center justify-center text-[#5A403E] font-bold shadow-sm"><Icons.Minus /></button>
                      <span className="font-bold text-[#302221]">{cart[item.id]}</span>
                      <button onClick={() => navigate('/build')} className="w-7 h-7 bg-[#5A403E] rounded-md flex items-center justify-center text-white font-bold shadow-sm"><Icons.Plus /></button>
                    </div>
                  ) : (
                    <button onClick={() => navigate('/build')} className="w-full py-1.5 border border-[#5A403E] text-[#5A403E] font-bold text-xs rounded-lg hover:bg-[#5A403E] hover:text-white transition-colors mt-auto">
                      + สั่งเลย
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Floating Bottom Cart (ตะกร้าลอยตัว) --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#EAE5DF] p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-30">
          <button 
            onClick={() => navigate('/history')} // 👈 เปลี่ยนปลายทางไปหน้า OrderHistory
            className={`w-full py-3.5 rounded-xl flex items-center justify-between px-5 font-bold transition-all shadow-md
            ${totalItems > 0 ? 'bg-[#5A403E] text-white hover:bg-[#4a322f]' : 'bg-[#EAE5DF] text-[#999] cursor-not-allowed'}`}
            disabled={totalItems === 0} // ป้องกันไม่ให้กดถ้ายังไม่ได้เลือกอาหาร
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Icons.ShoppingBag />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#E53E3E] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-[#5A403E]">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-sm">ดูรายการที่สั่ง</span>
            </div>
            <span className="text-sm">{totalItems > 0 ? 'สั่งอาหารเลย' : 'ยังไม่มีรายการ'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
