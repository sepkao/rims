import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GracePeriodCountdown() {
  const navigate = useNavigate();
  const [showCheck, setShowCheck] = useState(false);

  // ทำให้ไอคอนติ๊กถูกค่อยๆ เด้งขึ้นมา
  useEffect(() => {
    setTimeout(() => setShowCheck(true), 100);
  }, []);

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center relative shadow-2xl overflow-hidden px-8 text-center">
        
        {/* Animated Checkmark Circle */}
        <div className={`w-28 h-28 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-6 transition-all duration-700 ease-out transform
          ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        `}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 className="text-2xl font-black text-[#302221] mb-2">ส่งออเดอร์สำเร็จ!</h1>
        <p className="text-sm text-[#7B726B] font-medium leading-relaxed mb-10">
          ห้องครัวได้รับรายการอาหารของท่านแล้ว<br/>กำลังเร่งเตรียมเสิร์ฟให้ถึงโต๊ะค่ะ 🍲
        </p>

        <div className="bg-white border border-[#EAE5DF] rounded-xl py-3 px-6 w-full shadow-sm mb-12">
          <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-1">Order Number</p>
          <p className="text-sm font-medium text-[#7B726B]">จะได้รับหลังเชื่อมต่อ orders API</p>
        </div>

        {/* ปุ่มกลับหน้าเมนู */}
        <button 
          onClick={() => navigate('/order')} 
          className="w-full py-4 rounded-xl bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold transition-all shadow-md"
        >
          สั่งอาหารเพิ่ม
        </button>

      </div>
    </div>
  );
}
