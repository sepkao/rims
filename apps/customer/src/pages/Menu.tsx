import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type MenuItem = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
};

// --- Icons สำหรับฝั่งลูกค้า ---
const Icons = {
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Search: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Fire: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="#E53E3E" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>,
  ShoppingBag: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  Minus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

const categories = ["ทั้งหมด", "เนื้อวัว", "หมู", "ซีฟู้ด", "ลูกชิ้น/ผัก", "ของทานเล่น"];

// ฟังก์ชันช่วยจัดหมวดหมู่จำลอง (เผื่อ API ยังไม่ส่ง category มา)
const guessCategory = (name: string) => {
  if (name.includes("เนื้อ") || name.includes("วากิว") || name.includes("ริบอาย")) return "เนื้อวัว";
  if (name.includes("หมู") || name.includes("เบคอน")) return "หมู";
  if (name.includes("กุ้ง") || name.includes("ปลาหมึก") || name.includes("แซลมอน")) return "ซีฟู้ด";
  if (name.includes("ผัก") || name.includes("เห็ด") || name.includes("ลูกชิ้น")) return "ลูกชิ้น/ผัก";
  if (name.includes("เฟรนช์ฟรายส์") || name.includes("ทอด")) return "ของทานเล่น";
  return "อื่นๆ";
};

// ฟังก์ชันจำลองรูปภาพ
const mockImages = [
  "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1577640905050-83665af216b9?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591071477751-248358d7c4e5?q=80&w=400&auto=format&fit=crop"
];

export default function Menu() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      .then((data) => setItems(data.menuItems))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดเมนูไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.description ?? ''} ${item.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "ทั้งหมด" || guessCategory(item.name) === activeCategory;
    return matchesSearch && matchesCategory;
  }), [items, query, activeCategory]);

  const totalItems = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  const handleAdd = (id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleRemove = (id: string) => {
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

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative neo-wrapper overflow-hidden">
        
        {/* --- Header --- */}
        <div className="bg-white px-5 py-4 border-b-2 border-[#2d1b17] shrink-0 sticky top-0 z-20 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-xl font-black text-[#5A403E] tracking-wide">SHABU INVEN</h1>
              <p className="text-[11px] font-bold text-[#7B726B]">Buffet Premium (฿599)</p>
            </div>
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
        <div className="bg-white px-5 pt-3 pb-2 shrink-0 z-10 border-b-2 border-[#2d1b17] shadow-[0_4px_0_#2d1b17]">
          <div className="relative mb-3">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเมนูหรือวัตถุดิบ..." 
              className="w-full pl-10 pr-4 py-2 bg-white border-2 border-[#2d1b17] rounded-xl text-sm outline-none focus:shadow-[2px_2px_0_#2d1b17]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 text-[13px] font-bold transition-colors
                  ${activeCategory === cat ? 'neo-btn' : 'neo-btn-secondary hover:bg-[#F4EFEA]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- Menu Grid --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px]">
          {loading && <div className="py-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดเมนู…</div>}
          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700 mb-4">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            {visible.map((item, index) => (
              <div key={item.id} className="neo-card overflow-hidden flex flex-col">
                <div className="h-32 bg-gray-200 relative border-b-2 border-[#2d1b17]">
                  <img src={mockImages[index % mockImages.length]} alt={item.name} className="w-full h-full object-cover" />
                  {/* สุ่มแสดงป้ายแนะนำ */}
                  {index % 3 === 0 && (
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Icons.Fire /> <span className="text-[10px] font-bold text-[#E53E3E]">แนะนำ</span>
                    </div>
                  )}
                </div>
                
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[13px] font-bold text-[#302221] leading-tight mb-1">{item.name}</h3>
                  <p className="text-[10px] font-bold text-[#5A403E] mb-2">฿{item.price.toLocaleString()}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3 flex-1 content-start">
                    {item.ingredients.map((ing) => (
                      <span key={ing.id} className="text-[9px] text-[#7B726B] bg-[#F4EFEA] px-1.5 py-0.5 rounded">
                        {ing.name} {ing.removable && <span className="text-[#999] ml-0.5">(ไม่เอา)</span>}
                      </span>
                    ))}
                  </div>
                  
                  {cart[item.id] ? (
                    <div className="flex items-center justify-between bg-[#F4EFEA] rounded-lg p-1 mt-auto">
                      <button onClick={() => handleRemove(item.id)} className="w-7 h-7 bg-white rounded-md flex items-center justify-center text-[#5A403E] font-bold shadow-sm"><Icons.Minus /></button>
                      <span className="font-bold text-[#302221]">{cart[item.id]}</span>
                      <button onClick={() => handleAdd(item.id)} className="w-7 h-7 bg-[#5A403E] rounded-md flex items-center justify-center text-white font-bold shadow-sm"><Icons.Plus /></button>
                    </div>
                  ) : (
                    <button onClick={() => navigate('/build')} className="w-full py-1.5 neo-btn-secondary text-[13px] font-bold mt-auto">
                      + สั่งเลย
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!loading && !error && visible.length === 0 && <div className="py-10 text-center text-sm text-[#7B726B]">ไม่พบเมนู</div>}
        </div>

        {/* --- Floating Bottom Cart --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t-2 border-[#2d1b17] p-4 shadow-[0_-4px_0_#2d1b17] z-30">
          <button 
            onClick={() => navigate('/order/cart')}
            className={`w-full py-3.5 flex items-center justify-between px-5 font-bold transition-all
            ${totalItems > 0 ? 'neo-btn' : 'bg-[#EAE5DF] text-[#999] cursor-not-allowed border-2 border-[#2d1b17] rounded-xl'}`}
            disabled={totalItems === 0}
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
              <span className="text-sm">ดูรายการที่เลือก</span>
            </div>
            <span className="text-sm">{totalItems > 0 ? `${totalItems} รายการ` : 'ยังไม่มีรายการ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
