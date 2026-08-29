import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GracePeriodCountdown() {
  const navigate = useNavigate();
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowCheck(true), 100);
  }, []);

  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center relative shadow-xl px-8 text-center">
        
        {/* Animated Checkmark Circle */}
        <div className={`w-24 h-24 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-8 transition-all duration-700 ease-out transform shadow-sm
          ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        `}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#302221] mb-3">ส่งออเดอร์สำเร็จ!</h1>
        <p className="text-sm text-[#7B726B] font-medium leading-relaxed mb-10">
          ห้องครัวได้รับรายการอาหารของท่านแล้ว<br/>กำลังเร่งเตรียมเสิร์ฟให้ถึงโต๊ะค่ะ 🍲
        </p>

        <div className="bg-white rounded-xl border border-[#EAE5DF] py-4 px-6 w-full mb-10 shadow-sm">
          <p className="text-xs font-bold text-[#b97861] uppercase tracking-wide mb-1">Order Number</p>
          <p className="text-sm font-medium text-[#7B726B]">ระบบจะอัปเดตเร็วๆ นี้</p>
        </div>

        {/* ปุ่มกลับหน้าเมนู */}
        <button 
          onClick={() => navigate('/order')} 
          className="w-full py-3.5 bg-[#5A403E] text-white rounded-lg font-bold hover:bg-[#4A3432] transition-colors shadow-sm"
        >
          สั่งอาหารเพิ่ม
        </button>

      </div>
    </div>
  );
}
