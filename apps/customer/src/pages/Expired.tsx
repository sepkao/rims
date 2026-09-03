import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { getQrCode, requireQrCode, type CustomerSession } from '../lib/customer-session';
import { 
  AlertCircle, 
  ArrowRight, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Hourglass, 
  ReceiptText, 
  RefreshCw, 
  Sparkles, 
  UtensilsCrossed 
} from 'lucide-react';

export default function Expired({ 
  customError, 
  onRetry 
}: { 
  customError?: string; 
  onRetry?: () => void;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isCallingStaff, setIsCallingStaff] = useState(false);
  const [callSuccess, setCallSuccess] = useState(false);
  const [callError, setCallError] = useState('');
  const [totalOrdersCount, setTotalOrdersCount] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSession = async () => {
    setIsRefreshing(true);
    const qrCode = getQrCode();
    if (!qrCode) {
      setIsRefreshing(false);
      return;
    }
    try {
      const data = await apiFetch<{ session: CustomerSession }>(`/customer/session?qr_code=${encodeURIComponent(qrCode)}`);
      setSession(data.session);

      // Fetch order count if available
      try {
        const orderData = await apiFetch<{ items: Array<{ qty: number }> }>(`/customer/orders?qr_code=${encodeURIComponent(qrCode)}`);
        if (orderData?.items) {
          const totalDishes = orderData.items.reduce((sum, i) => sum + (i.qty || 1), 0);
          setTotalOrdersCount(totalDishes);
        }
      } catch {
        // Ignored
      }
    } catch {
      // Session might be strictly closed
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const handleCallStaff = async () => {
    if (isCallingStaff) return;
    setIsCallingStaff(true);
    setCallError('');
    try {
      await apiFetch('/customer/call-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: requireQrCode() }),
      });
      setCallSuccess(true);
    } catch (caught) {
      setCallError(caught instanceof Error ? caught.message : 'เรียกพนักงานไม่สำเร็จ');
    } finally {
      setIsCallingStaff(false);
    }
  };

  const isNetworkError = customError && (customError.includes('Failed to fetch') || customError.includes('NetworkError'));

  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center font-sans">
      <div className="w-full max-w-[430px] bg-[#FDFBF7] h-screen flex flex-col relative shadow-2xl border-x-2 border-[#2D1B17] overflow-hidden">
        
        {/* ── Brand Header ─────────────────────────────────────────── */}
        <header className="anim-down d-1 bg-white px-4 py-3 border-b-2 border-[#2D1B17] shrink-0 sticky top-0 z-20 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2D1B17] rounded-lg border border-[#2D1B17] flex items-center justify-center text-[#E8D8CA] shadow-2xs">
              <UtensilsCrossed size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xs font-black text-[#2D1B17] tracking-tight">SHABU RIMS</h1>
              <p className="text-[9px] font-bold text-[#7B726B]">ALL-YOU-CAN-EAT BUFFET</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rotate-[-2deg] rounded-md border-2 border-[#2D1B17] bg-[#FFF8EF] px-2 py-0.5 text-[11px] font-black text-[#2D1B17] shadow-xs">
              โต๊ะ {session?.tableNumber?.replace('MOCK-', '') || '--'}
            </span>
            <button
              type="button"
              onClick={onRetry || loadSession}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-[#2D1B17] bg-[#FFF8EF] hover:bg-white text-[#2D1B17] shadow-2xs active:translate-y-0.5 transition-all"
              title="ตรวจสอบอีกครั้ง"
            >
              <RefreshCw size={13} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* ── Scrollable Body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-4">
          
          {/* Hero Expired Visual Card */}
          <div className="anim-down d-2 bg-gradient-to-br from-[#FFF8EF] via-white to-[#F7EFE8] rounded-3xl border-2 border-[#2D1B17] shadow-[5px_5px_0_#2D1B17] p-6 text-center relative overflow-hidden">
            {/* Background Decorative Rings */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-[#B97861]/10" />
            
            <div className="relative inline-flex items-center justify-center mb-4">
              <div className="w-18 h-18 bg-white border-2 border-[#2D1B17] rounded-2xl shadow-[3px_3px_0_#2D1B17] flex items-center justify-center text-[#B97861]">
                <Hourglass size={34} strokeWidth={2.5} className="steam-anim" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 border-2 border-white text-white font-black text-[10px] shadow-xs">
                !
              </span>
            </div>

            <div className="inline-block rotate-[-1.5deg] mb-2 rounded-full border-2 border-[#2D1B17] bg-[#2D1B17] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
              ✦ หมดรอบเวลาบุฟเฟต์ ✦
            </div>

            <h2 className="text-xl font-black text-[#2D1B17] tracking-tight">
              {isNetworkError ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์' : 'QR Code หมดอายุแล้ว'}
            </h2>

            <p className="mt-1.5 text-xs font-semibold text-[#7B726B] leading-relaxed max-w-[280px] mx-auto">
              {isNetworkError
                ? 'กรุณาตรวจสอบว่าเชื่อมต่อ Wi-Fi ของร้านแล้ว และกดปุ่มลองใหม่อีกครั้ง'
                : (customError || 'รอบเวลาการสั่งอาหารของโต๊ะนี้สิ้นสุดลงแล้ว ขอบคุณที่มาอุดหนุน SHABU RIMS ค่ะ')}
            </p>
          </div>

          {/* Session Details Card */}
          <div className="anim-up d-3 shabu-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#EAE5DF] pb-2.5">
              <span className="text-xs font-black text-[#2D1B17] flex items-center gap-1.5">
                <Clock size={14} className="text-[#B97861]" strokeWidth={2.5} />
                <span>ข้อมูลรอบโต๊ะ</span>
              </span>
              <span className="text-[10px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                ปิดรับออเดอร์แล้ว
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#FFF8EF] p-2.5 rounded-xl border border-[#EAE5DF]">
                <p className="text-[10px] font-bold text-[#7B726B] mb-0.5">หมายเลขโต๊ะ</p>
                <p className="text-base font-black text-[#2D1B17]">
                  โต๊ะ {session?.tableNumber?.replace('MOCK-', '') || '--'}
                </p>
              </div>

              <div className="bg-[#FFF8EF] p-2.5 rounded-xl border border-[#EAE5DF]">
                <p className="text-[10px] font-bold text-[#7B726B] mb-0.5">เวลาสิ้นสุดรอบ</p>
                <p className="text-sm font-black text-[#2D1B17]">
                  {session?.expiresAt ? new Date(session.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : 'หมดเวลา'}
                </p>
              </div>
            </div>

            {totalOrdersCount !== null && (
              <div className="bg-white p-2.5 rounded-xl border-2 border-[#2D1B17] flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <ReceiptText size={16} className="text-[#B97861]" strokeWidth={2.5} />
                  <span className="text-xs font-bold text-[#2D1B17]">สั่งอาหารไปทั้งหมด</span>
                </div>
                <span className="text-xs font-black text-[#2D1B17] bg-[#FFF8EF] px-2 py-0.5 rounded border border-[#2D1B17]">
                  {totalOrdersCount} จาน
                </span>
              </div>
            )}
          </div>

          {/* Guidelines / Next Steps */}
          <div className="anim-up d-4 bg-white rounded-2xl border-2 border-[#2D1B17] p-4 shadow-[3px_3px_0_#2D1B17] space-y-2.5">
            <h3 className="text-xs font-black text-[#2D1B17] flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles size={13} className="text-[#B97861]" />
              <span>คำแนะนำสำหรับท่าน</span>
            </h3>

            <ul className="text-xs font-semibold text-[#5A403E] space-y-2 leading-relaxed">
              <li className="flex items-start gap-2 bg-[#FFF8EF] p-2 rounded-xl border border-[#EAE5DF]">
                <span className="text-[#B97861] font-black">1.</span>
                <span>สามารถนั่งรับประทานอาหารที่อยู่บนโต๊ะต่อจนหมดได้ตามอัธยาศัย</span>
              </li>
              <li className="flex items-start gap-2 bg-[#FFF8EF] p-2 rounded-xl border border-[#EAE5DF]">
                <span className="text-[#B97861] font-black">2.</span>
                <span>หากต้องการต่อเวลาบุฟเฟต์ หรือสั่งอาหารเพิ่ม สามารถติดต่อพนักงานประจำร้านได้ทันที</span>
              </li>
              <li className="flex items-start gap-2 bg-[#FFF8EF] p-2 rounded-xl border border-[#EAE5DF]">
                <span className="text-[#B97861] font-black">3.</span>
                <span>เมื่อพร้อมชำระเงิน กรุณากดปุ่มเรียกพนักงาน หรือชำระเงินที่เคาน์เตอร์แคชเชียร์</span>
              </li>
            </ul>
          </div>

          {/* Call Staff Notification Toast */}
          {callSuccess && (
            <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-3 text-xs font-black text-emerald-800 shadow-[2px_2px_0_#059669] flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={16} strokeWidth={2.5} />
              <span>ส่งสัญญาณเรียกพนักงานแล้ว พนักงานกำลังมาหาที่โต๊ะค่ะ</span>
            </div>
          )}

          {callError && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700 shadow-[2px_2px_0_#DC2626] flex items-center gap-2">
              <AlertCircle size={16} strokeWidth={2.5} />
              <span>{callError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="anim-up d-4 space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleCallStaff}
              disabled={isCallingStaff || callSuccess}
              className="shabu-btn-primary w-full py-3.5 text-xs shadow-[3px_3px_0_#B97861] flex items-center justify-center gap-2"
            >
              <Bell size={15} strokeWidth={2.5} />
              <span>{isCallingStaff ? 'กำลังส่งสัญญาณ…' : (callSuccess ? '✓ แจ้งพนักงานแล้ว' : '🔔 เรียกพนักงาน / เช็คบิล')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/order/history?tab=history')}
              className="shabu-btn-secondary w-full py-3 text-xs flex items-center justify-center gap-2"
            >
              <ReceiptText size={14} strokeWidth={2.5} />
              <span>ดูประวัติและรายการอาหารที่สั่ง</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 rounded-xl border-2 border-[#7B726B] bg-white hover:bg-gray-50 text-[#2D1B17] font-bold text-xs shadow-xs active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={12} strokeWidth={2.5} />
                <span>ลองตรวจสอบอีกครั้ง</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
