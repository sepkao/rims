import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { requireQrCode } from '../lib/customer-session';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';

export default function CallStaffButton() {
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'calling' | 'success'>('idle');
  const [coolingDown, setCoolingDown] = useState(false);
  const [error, setError] = useState('');

  const handleCall = async () => {
    if (status === 'calling' || coolingDown) return;
    setStatus('calling');
    setError('');
    try {
      await apiFetch('/customer/call-staff', {
        method: 'POST',
        body: JSON.stringify({ qrCode: requireQrCode() })
      });
      setStatus('success');
      setCoolingDown(true);
      window.setTimeout(() => setCoolingDown(false), 30_000);
      window.setTimeout(() => setShowModal(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเรียกพนักงาน');
      setStatus('idle');
    }
  };
  
  return (
    <>
      <button 
        type="button"
        onClick={() => { setShowModal(true); setStatus('idle'); setError(''); }}
        disabled={coolingDown}
        aria-label="เรียกพนักงาน"
        className="absolute bottom-24 right-4 w-12 h-12 bg-[#B97861] text-white rounded-2xl border-2 border-[#2D1B17] shadow-[3px_3px_0_#2D1B17] flex items-center justify-center z-40 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2D1B17] active:translate-y-0.5 active:shadow-[1px_1px_0_#2D1B17] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        title="เรียกพนักงานมาที่โต๊ะ"
      >
        <Bell size={20} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="bg-[#FDFBF7] rounded-3xl border-2 border-[#2D1B17] shadow-[8px_8px_0_#2D1B17] w-full max-w-[320px] p-6 text-center transform scale-100 animate-scale-in">
            {status === 'idle' && (
              <div>
                <div className="w-14 h-14 bg-[#FFF8EF] border-2 border-[#2D1B17] rounded-2xl shadow-[3px_3px_0_#2D1B17] flex items-center justify-center mx-auto mb-4 text-[#B97861]">
                  <Bell size={26} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-black text-[#2D1B17] mb-1">ต้องการเรียกพนักงาน?</h3>
                <p className="text-xs font-semibold text-[#7B726B] mb-5 leading-relaxed">
                  พนักงานจะได้รับสัญญาณแจ้งเตือนและรีบมาให้บริการที่โต๊ะของคุณ
                </p>
                {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-700">{error}</p>}
                
                <div className="flex gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)} 
                    className="flex-1 py-2.5 rounded-xl border-2 border-[#2D1B17] bg-white text-[#2D1B17] font-bold text-xs shadow-[2px_2px_0_#2D1B17] hover:bg-gray-50 active:translate-y-0.5"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="button"
                    onClick={handleCall} 
                    className="flex-1 py-2.5 rounded-xl border-2 border-[#2D1B17] bg-[#B97861] text-white font-black text-xs shadow-[2px_2px_0_#2D1B17] hover:bg-[#A66751] active:translate-y-0.5"
                  >
                    ยืนยันเรียก
                  </button>
                </div>
              </div>
            )}

            {status === 'calling' && (
              <div className="py-6">
                <Loader2 size={36} className="animate-spin text-[#B97861] mx-auto mb-3" />
                <p className="font-black text-[#2D1B17] text-sm">กำลังส่งสัญญาณเรียกพนักงาน…</p>
              </div>
            )}

            {status === 'success' && (
              <div className="py-4">
                <div className="w-14 h-14 bg-emerald-100 border-2 border-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-700 shadow-[3px_3px_0_#047857]">
                  <CheckCircle2 size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-base font-black text-[#2D1B17] mb-1">แจ้งพนักงานแล้ว!</h3>
                <p className="text-xs text-[#7B726B] font-semibold">พนักงานกำลังเดินทางมาที่โต๊ะของคุณ</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
