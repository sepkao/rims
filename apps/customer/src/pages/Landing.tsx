import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { clearCustomerSession, getQrCode, storeQrCode, type CustomerSession } from '../lib/customer-session';
import { useCart } from '../lib/CartContext';
import { ArrowRight, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import Expired from './Expired';

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
        const isNetworkErr = caught instanceof Error && (caught.message.includes('Failed to fetch') || caught.message.includes('NetworkError'));
        if (!isNetworkErr) {
          clearCustomerSession();
        }
        setError(caught instanceof Error ? caught.message : 'ตรวจสอบ QR ไม่สำเร็จ');
        setIsExpired(true);
      })
      .finally(() => setLoading(false));
  }, [clearCart, sessionToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
        <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col justify-center items-center shadow-2xl border-x-2 border-[#2D1B17]">
          <div className="w-12 h-12 border-4 border-[#EAE5DF] border-t-[#B97861] rounded-full animate-spin mb-5"></div>
          <p className="text-[#2D1B17] font-black text-sm animate-pulse">กำลังตรวจสอบข้อมูลโต๊ะของคุณ…</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return <Expired customError={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl border-x-2 border-[#2D1B17] overflow-hidden">
        
        {/* ── Top Shabu Hero (Brown/Terracotta Theme) ───────────────── */}
        <div className="anim-down d-1 relative h-[42%] bg-gradient-to-br from-[#B97861] via-[#C4845F] to-[#D9A882] border-b-2 border-[#2D1B17] p-6 flex flex-col items-center justify-center text-white overflow-hidden group">
          {/* Decorative Background Rings like Staff Dashboard */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full border-[28px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-6 left-6 h-32 w-32 rounded-full border-[16px] border-white/10" />

          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-[#2D1B17] border-2 border-white rounded-2xl shadow-[3px_3px_0_#2D1B17] flex items-center justify-center mb-3">
              <UtensilsCrossed size={26} strokeWidth={2.5} className="text-[#E8D8CA]" />
            </div>

            <span className="rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3.5 py-0.8 text-[10px] font-black uppercase tracking-widest text-[#2D1B17] shadow-[2px_2px_0_#2D1B17] mb-2">
              All-you-can-eat buffet
            </span>

            <h1 className="text-3xl font-black text-[#2D1B17] tracking-tight drop-shadow-xs">
              SHABU RIMS
            </h1>
            <p className="text-xs font-bold text-[#563128]/90 mt-1">
              สแกน สั่งสด เสิร์ฟไว อิ่มอร่อยไม่อั้น
            </p>
          </div>
        </div>

        {/* ── Bottom Details Card ──────────────────────────────────── */}
        <div className="anim-up d-2 flex-1 bg-[#FDFBF7] relative z-20 px-6 pt-6 pb-8 flex flex-col justify-between rounded-t-[2.5rem] -mt-7 shadow-[0_-8px_25px_rgba(45,27,23,0.12)]">
          <div>
            {/* Table Information Card */}
            <div className="shabu-card p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-[#B97861] uppercase tracking-wider mb-0.5">TABLE NUMBER</p>
                <p className="text-3xl font-black text-[#2D1B17]">
                  โต๊ะ {session?.tableNumber?.replace('MOCK-', '') || '00'}
                </p>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full text-emerald-800">
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                  <span className="text-[10px] font-black">พร้อมสั่งอาหาร</span>
                </div>
                <p className="text-[11px] text-[#7B726B] font-semibold">
                  เริ่มรอบ {session?.startedAt ? new Date(session.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'} น.
                </p>
              </div>
            </div>

            {/* Dining Guidelines */}
            <div className="px-1">
              <h2 className="text-xs font-black text-[#2D1B17] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#B97861]"></span>
                กติกาและข้อตกลงในการรับประทาน
              </h2>
              <ul className="text-xs font-semibold text-[#5A403E] space-y-2.5 leading-relaxed">
                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-[#EAE5DF]">
                  <span className="text-[#B97861] font-black">✦</span>
                  <span>ระยะเวลาทานบุฟเฟต์ <strong className="font-black text-[#2D1B17]">120 นาที</strong> (นับถอยหลังตั้งแต่เปิดโต๊ะ)</span>
                </li>
                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-[#EAE5DF]">
                  <span className="text-[#B97861] font-black">✦</span>
                  <span>กรุณาสั่งอาหารแต่พอทาน หากทานไม่หมดทางร้านขออนุญาตปรับตามราคาจริงในเมนู</span>
                </li>
                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-[#EAE5DF]">
                  <span className="text-[#B97861] font-black">✦</span>
                  <span>ไม่อนุญาตให้นำอาหารหรือเครื่องดื่มจากภายนอกเข้ามาทานในร้าน</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button 
            type="button"
            onClick={() => {
              setIsStarting(true);
              navigate('/order');
            }}
            disabled={isStarting}
            className="shabu-btn-primary w-full py-3.5 text-sm shadow-[4px_4px_0_#B97861] active:translate-y-0.5 transition-all"
          >
            <span>{isStarting ? 'กำลังเข้าสู่เมนู…' : 'เริ่มสั่งอาหาร'}</span>
            {!isStarting && <ArrowRight size={16} strokeWidth={2.5} />}
          </button>
        </div>

      </div>
    </div>
  );
}
