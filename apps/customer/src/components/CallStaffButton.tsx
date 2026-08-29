import { useState } from 'react';

export default function CallStaffButton() {
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'calling' | 'success'>('idle');

  const handleCall = async () => {
    if (status === 'calling') return;
    setStatus('calling');
    try {
      const res = await fetch('http://localhost:3000/customer/call-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableSessionId: 1 })
      });
      if (res.ok) {
        setStatus('success');
      } else {
        alert('เกิดข้อผิดพลาดในการเรียกพนักงาน');
        setShowModal(false);
        setStatus('idle');
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเรียกพนักงาน');
      setShowModal(false);
      setStatus('idle');
    }
  };
  
  return (
    <>
      <button 
        onClick={() => { setShowModal(true); setStatus('idle'); }}
        className="absolute bottom-24 right-5 w-14 h-14 bg-[#5A403E] text-white rounded-full shadow-[0_4px_15px_rgba(90,64,62,0.3)] flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-all"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl w-full max-w-[320px] p-6 shadow-xl transform transition-all scale-100 opacity-100">
            {status === 'idle' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-[#F4EFEA] rounded-full flex items-center justify-center mx-auto mb-4 text-[#5A403E]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <h3 className="text-lg font-bold text-[#302221] mb-2">ต้องการเรียกพนักงาน?</h3>
                <p className="text-sm text-[#7B726B] mb-6">พนักงานจะรีบมาให้บริการที่โต๊ะของคุณ</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-[#F4EFEA] text-[#5A403E] font-bold rounded-xl hover:bg-[#EAE5DF] transition-colors">
                    ยกเลิก
                  </button>
                  <button onClick={handleCall} className="flex-1 py-3 bg-[#5A403E] text-white font-bold rounded-xl hover:bg-[#4A3432] transition-colors shadow-sm">
                    ยืนยัน
                  </button>
                </div>
              </div>
            )}

            {status === 'calling' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-[#EAE5DF] border-t-[#5A403E] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-bold text-[#302221]">กำลังเรียกพนักงาน...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-4 text-[#10B981] animate-bounce">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3 className="text-lg font-bold text-[#302221] mb-2">เรียกพนักงานสำเร็จ</h3>
                <p className="text-sm text-[#7B726B] mb-6">พนักงานกำลังเดินไปที่โต๊ะของคุณ กรุณารอสักครู่นะครับ</p>
                <button onClick={() => setShowModal(false)} className="w-full py-3 bg-[#5A403E] text-white font-bold rounded-xl hover:bg-[#4A3432] transition-colors shadow-sm">
                  กลับสู่หน้าหลัก
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
