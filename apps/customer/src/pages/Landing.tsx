import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { clearCustomerSession, getQrCode, storeQrCode, type CustomerSession } from '../lib/customer-session';
import { useCart } from '../lib/CartContext';

const Icons = {
  AlertCircle: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  HotPot: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4s-.5 2 0 3 1.5 2 1.5 4-.5 3-.5 3" />
      <path d="M12 3s-.5 2 0 3 1.5 2 1.5 4-.5 3-.5 3" />
      <path d="M17 4s-.5 2 0 3 1.5 2 1.5 4-.5 3-.5 3" />
      <path d="M2 16c0 3.5 4.5 6 10 6s10-2.5 10-6" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  )
};

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('qr') ?? searchParams.get('session');
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const [session, setSession] = useState<CustomerSession | null>(null);

  useEffect(() => {
    if (sessionToken) {
      if (getQrCode() !== sessionToken) clearCart();
      storeQrCode(sessionToken);
    }
    const tokenToUse = sessionToken || getQrCode();
    if (!tokenToUse) {
      setError('ไม่พบ QR Code กรุณาสแกน QR จากแคชเชียร์');
      setIsExpired(true);
      setLoading(false);
      return;
    }
    apiFetch<{ session: CustomerSession }>(`/customer/session?qr_code=${encodeURIComponent(tokenToUse)}`)
      .then((data) => {
        if (data.session) {
          setSession(data.session);
          const expiresAt = new Date(data.session.expiresAt).getTime();
          if (data.session.status === 'expired' || expiresAt <= Date.now()) {
            setIsExpired(true);
          }
        }
      })
      .catch((caught) => {
        clearCustomerSession();
        setError(caught instanceof Error ? caught.message : 'ตรวจสอบ QR ไม่สำเร็จ');
        setIsExpired(true);
      })
      .finally(() => setLoading(false));
  }, [clearCart, sessionToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
        <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center shadow-xl">
          <div className="w-10 h-10 border-[3px] border-[#EAE5DF] border-t-[#5A403E] rounded-full animate-spin mb-6"></div>
          <p className="text-[#7B726B] font-bold text-sm">กำลังตรวจสอบข้อมูลโต๊ะ...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
        <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center px-8 text-center shadow-xl relative">
          <div className="bg-[#FEF2F2] p-5 rounded-full mb-8 shadow-sm">
            <Icons.AlertCircle />
          </div>
          
          <h1 className="text-2xl font-bold text-[#302221] mb-3">QR Code หมดอายุ</h1>
          <p className="text-sm text-[#7B726B] leading-relaxed mb-12">
            {error || 'เซสชันสำหรับโต๊ะนี้หมดอายุแล้ว หรือยังไม่ได้ทำการเปิดโต๊ะ'}<br/><br/>
            กรุณาติดต่อพนักงานหรือแคชเชียร์เพื่อเปิดโต๊ะใหม่ และรับ QR Code ล่าสุดค่ะ
          </p>

          <div className="bg-white border border-[#EAE5DF] rounded-xl p-5 w-full text-left shadow-sm">
            <p className="text-xs font-bold text-[#302221] mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53E3E]"></span>
              คำแนะนำ
            </p>
            <ul className="text-[12px] text-[#7B726B] list-disc pl-4 space-y-2">
              <li>QR Code จะมีอายุการใช้งานจำกัดเพื่อความปลอดภัย</li>
              <li>ห้ามแชร์ภาพ QR Code ให้บุคคลภายนอกร้าน</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans selection:bg-[#5A403E] selection:text-white">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-xl overflow-hidden">
        
        {import.meta.env.DEV && <button onClick={() => setIsExpired(true)} className="absolute top-4 right-4 text-[10px] bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-white/90 z-50 border border-white/30 hover:bg-white/30 transition-colors">
          [Dev] ทดสอบหมดอายุ
        </button>}

        {/* ภาพพื้นหลังด้านบน */}
        <div className="h-[42%] bg-[#5A403E] relative flex flex-col items-center justify-center text-white p-6 overflow-hidden">
          {/* Minimal Japanese Wave/Shabu Pattern */}
          <div className="absolute inset-0 opacity-10" 
               style={{ 
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                 backgroundSize: '24px 24px'
               }}>
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#5A403E]/50 to-[#302221]/80"></div>
          
          <div className="relative z-10 text-center flex flex-col items-center mt-2">
            <div className="text-white mb-4 drop-shadow-md">
              <Icons.HotPot />
            </div>
            <h1 className="text-[32px] font-bold mb-2 text-white drop-shadow-sm">Shabu</h1>
            <div className="w-10 h-[2px] bg-[#b97861] mb-4"></div>
            <p className="text-white/90 text-sm font-medium drop-shadow-sm">All-you-can-eat buffet</p>
          </div>
        </div>

        {/* ส่วนรายละเอียดด้านล่าง */}
        <div className="flex-1 bg-[#FDFBF7] relative z-20 px-8 pt-8 pb-10 flex flex-col justify-between rounded-t-[2.5rem] -mt-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          
          <div>
            <div className="flex items-center justify-between mb-10 bg-white p-5 rounded-xl border border-[#EAE5DF] shadow-sm">
              <div>
                <p className="text-xs font-bold text-[#b97861] mb-1 uppercase">Table Number</p>
                <p className="text-4xl font-bold text-[#302221]">{session?.tableNumber?.replace('MOCK-', '') || '00'}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-1.5 justify-end mb-2 bg-[#10B981]/10 px-2.5 py-1 rounded-full">
                  <Icons.CheckCircle />
                  <span className="text-[11px] font-bold text-[#10B981]">พร้อมสั่งอาหาร</span>
                </div>
                <p className="text-xs text-[#7B726B] font-medium">เข้าใช้งานเมื่อ {session?.startedAt ? new Date(session.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'} น.</p>
              </div>
            </div>

            <div className="px-2">
              <h2 className="text-[14px] font-bold text-[#302221] mb-5 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#b97861] rounded-full"></span>
                ข้อตกลงในการรับประทาน
              </h2>
              <ul className="text-sm text-[#7B726B] space-y-4 leading-relaxed font-medium">
                <li className="flex items-start gap-3">
                  <span className="text-[#b97861] mt-1 text-[10px]">■</span>
                  <span>ระยะเวลาทานบุฟเฟต์ <strong className="font-bold text-[#5A403E]">120 นาที</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#b97861] mt-1 text-[10px]">■</span>
                  <span>กรุณาสั่งอาหารแต่พอทาน หากทานไม่หมดทางร้านขออนุญาตปรับตามราคาในเมนู</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#b97861] mt-1 text-[10px]">■</span>
                  <span>ไม่อนุญาตให้นำอาหารหรือเครื่องดื่มจากภายนอกเข้ามาทานในร้าน</span>
                </li>
              </ul>
            </div>
          </div>

          <button 
            onClick={() => {
              setIsStarting(true);
              navigate('/order');
            }}
            disabled={isStarting}
            className="w-full mt-8 rounded-lg bg-[#5A403E] px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#4A3432] active:bg-[#302221] disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isStarting ? 'กำลังเข้าสู่ระบบ...' : 'เริ่มสั่งอาหาร'}
            {!isStarting && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            )}
          </button>
          
        </div>
      </div>
    </div>
  );
}
