import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Icons = {
  AlertCircle: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  Utensils: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path>
      <path d="M7 2v20"></path>
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  )
};

export default function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // สมมติว่าเราดึงข้อมูลจาก URL เช่น ?table=8&token=xyz
  // และนี่คือการจำลองสถานะว่า QR Code หมดอายุหรือไม่
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // จำลองการโหลดข้อมูล 1.5 วินาที เพื่อเช็คสถานะโต๊ะจาก Backend
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
        <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center shadow-2xl">
          <div className="w-12 h-12 border-4 border-[#EAE5DF] border-t-[#5A403E] rounded-full animate-spin mb-4"></div>
          <p className="text-[#7B726B] font-bold text-sm">กำลังตรวจสอบข้อมูลโต๊ะ...</p>
        </div>
      </div>
    );
  }

  // กรณี QR Code หมดอายุ หรือยังไม่ได้เปิดโต๊ะ
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
        <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center px-8 text-center shadow-2xl relative">
          
          {/* ปุ่มสลับสถานะ (สำหรับเทสเท่านั้น) */}
          <button onClick={() => setIsExpired(false)} className="absolute top-4 right-4 text-[10px] bg-gray-200 px-2 py-1 rounded text-gray-500">
            [Dev] เปลี่ยนเป็นปกติ
          </button>

          <div className="bg-[#FEF2F2] p-4 rounded-full mb-6">
            <Icons.AlertCircle />
          </div>
          
          <h1 className="text-2xl font-black text-[#302221] mb-2">QR Code หมดอายุ</h1>
          <p className="text-sm text-[#7B726B] font-medium leading-relaxed mb-10">
            เซสชันสำหรับโต๊ะนี้หมดอายุแล้ว หรือยังไม่ได้ทำการเปิดโต๊ะ<br/><br/>
            กรุณาติดต่อพนักงานหรือแคชเชียร์เพื่อเปิดโต๊ะใหม่ และรับ QR Code ล่าสุดค่ะ
          </p>

          <div className="bg-white border border-[#EAE5DF] rounded-xl py-4 px-6 w-full shadow-sm text-left">
            <p className="text-xs font-bold text-[#302221] mb-2">คำแนะนำ:</p>
            <ul className="text-[11px] text-[#7B726B] list-disc pl-4 space-y-1">
              <li>QR Code จะมีอายุการใช้งานจำกัดเพื่อความปลอดภัย</li>
              <li>ห้ามแชร์ภาพ QR Code ให้บุคคลภายนอกร้าน</li>
            </ul>
          </div>

        </div>
      </div>
    );
  }

  // กรณี QR Code ใช้งานได้ปกติ
  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* ปุ่มสลับสถานะ (สำหรับเทสเท่านั้น) */}
        <button onClick={() => setIsExpired(true)} className="absolute top-4 right-4 text-[10px] bg-gray-200 px-2 py-1 rounded text-gray-500 z-50">
          [Dev] ทดสอบหมดอายุ
        </button>

        {/* ภาพพื้นหลังด้านบน */}
        <div className="h-[45%] bg-[#5A403E] relative flex flex-col items-center justify-center text-white p-6">
          {/* ใส่ภาพแพทเทิร์นหรือเงาจางๆ ด้านหลังได้ (Mock) */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center"></div>
          
          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm mb-4 border border-white/20">
              <Icons.Utensils />
            </div>
            <h1 className="text-3xl font-black tracking-widest mb-1">SHABU INVEN</h1>
            <p className="text-white/80 text-sm font-medium tracking-wide">Premium Buffet Experience</p>
          </div>
        </div>

        {/* ส่วนรายละเอียดด้านล่าง */}
        <div className="flex-1 bg-[#FDFBF7] -mt-6 rounded-t-3xl relative z-20 px-6 pt-8 pb-6 flex flex-col">
          
          <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-[#EAE5DF]">
            <div>
              <p className="text-[11px] font-bold text-[#7B726B] uppercase tracking-wider mb-0.5">Table Number</p>
              <p className="text-3xl font-black text-[#5A403E]">08</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <Icons.CheckCircle />
                <span className="text-sm font-bold text-[#10B981]">พร้อมสั่งอาหาร</span>
              </div>
              <p className="text-xs text-[#7B726B] font-medium">เข้าใช้งานเมื่อ 11:45 น.</p>
            </div>
          </div>

          <div className="mb-auto">
            <h2 className="text-[13px] font-bold text-[#302221] mb-3">ข้อตกลงในการรับประทาน</h2>
            <ul className="text-xs text-[#7B726B] space-y-2.5 font-medium leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#5A403E] mt-0.5">•</span>
                ระยะเวลาทานบุฟเฟต์ 120 นาที
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#5A403E] mt-0.5">•</span>
                กรุณาสั่งอาหารแต่พอทาน หากทานไม่หมดทางร้านขออนุญาตปรับตามราคาในเมนู
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#5A403E] mt-0.5">•</span>
                ไม่อนุญาตให้นำอาหารหรือเครื่องดื่มจากภายนอกเข้ามาทานในร้าน
              </li>
            </ul>
          </div>

          <button 
            onClick={() => navigate('/menu')}
            className="w-full py-4 mt-6 rounded-xl bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2"
          >
            เริ่มสั่งอาหาร
          </button>
          
        </div>
      </div>
    </div>
  );
}
