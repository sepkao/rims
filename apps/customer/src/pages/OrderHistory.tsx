import { useNavigate } from 'react-router-dom';

// --- Icons สำหรับหน้า Cart ---
const Icons = {
  ArrowLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Cooking: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="M10 4v4"></path><path d="M14 2v6"></path></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
};

export default function OrderHistory() {
  const navigate = useNavigate();

  // Mock Data: รายการที่เพิ่งกดใส่ตะกร้า (รอส่งเข้าครัว)
  const cartItems = [
    { id: 1, name: "เนื้อวากิวออสเตรเลีย", qty: 2, price: "บุฟเฟต์" },
    { id: 3, name: "หมูสามชั้นสไลด์", qty: 1, price: "บุฟเฟต์" },
  ];

  // Mock Data: รายการที่ส่งเข้าครัวไปแล้ว
  const orderedItems = [
    { id: 5, name: "กุ้งแม่น้ำ", qty: 1, status: "cooking", time: "19:45" },
    { id: 7, name: "น้ำซุปหม่าล่า", qty: 1, status: "served", time: "19:42" },
  ];

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* --- Header --- */}
        <div className="bg-white px-5 py-4 border-b border-[#EAE5DF] shrink-0 sticky top-0 z-20 flex items-center gap-3">
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
              <span className="text-[#E53E3E] text-xs font-medium bg-[#FEF2F2] px-2 py-0.5 rounded">ล้างตะกร้า</span>
            </h2>
            
            <div className="bg-white rounded-xl border border-[#EAE5DF] overflow-hidden shadow-sm">
              {cartItems.map((item, idx) => (
                <div key={item.id} className={`p-4 flex justify-between items-center ${idx !== cartItems.length - 1 ? 'border-b border-[#F4EFEA]' : ''}`}>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-[#302221]">{item.name}</h3>
                    <p className="text-xs text-[#7B726B]">{item.price}</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* ปุ่มเพิ่มลดจำนวนขนาดเล็ก */}
                    <div className="flex items-center bg-[#F4EFEA] rounded-md px-2 py-1 gap-3">
                      <button className="text-[#5A403E] font-bold">-</button>
                      <span className="font-bold text-[#302221] text-sm">{item.qty}</span>
                      <button className="text-[#5A403E] font-bold">+</button>
                    </div>
                    <button className="p-1"><Icons.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: รายการที่สั่งไปแล้ว (สถานะ) */}
          <div>
            <h2 className="text-sm font-bold text-[#7B726B] mb-3">ประวัติการสั่งอาหาร</h2>
            
            <div className="bg-white rounded-xl border border-[#EAE5DF] overflow-hidden shadow-sm p-2">
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
          </div>

        </div>

        {/* --- Sticky Bottom Button (ยืนยันการสั่ง) --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#EAE5DF] p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-30">
          <button 
            onClick={() => navigate('/countdown')} // 👈 เปลี่ยนปลายทางไปหน้า Countdown
            className="w-full py-3.5 rounded-xl bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            ส่งออเดอร์เข้าครัว (3 รายการ)
          </button>
        </div>

      </div>
    </div>
  );
}
