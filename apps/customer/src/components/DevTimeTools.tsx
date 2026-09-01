import { useState } from 'react';

export default function DevTimeTools({ onTriggerFetch }: { onTriggerFetch: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const shiftTime = async (minutes: number) => {
    try {
      const qrCode = sessionStorage.getItem('qr_session') || undefined;
      await fetch('http://localhost:3000/dev/time-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, tableSessionId: 1, qrCode })
      });
      onTriggerFetch();
    } catch (e) {
      console.error(e);
    }
  };

  const setExactTime = async (minutesLeft: number) => {
    try {
      const qrCode = sessionStorage.getItem('qr_session') || undefined;
      await fetch('http://localhost:3000/dev/set-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutesLeft, tableSessionId: 1, qrCode })
      });
      onTriggerFetch();
    } catch (e) {
      console.error(e);
    }
  };

  const forceConfirm = async () => {
    try {
      const qrCode = sessionStorage.getItem('qr_session') || undefined;
      await fetch('http://localhost:3000/dev/force-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableSessionId: 1, qrCode })
      });
      onTriggerFetch();
    } catch (e) {
      console.error(e);
    }
  };

  const resetSession = async () => {
    try {
      const qrCode = sessionStorage.getItem('qr_session') || undefined;
      await fetch('http://localhost:3000/dev/reset-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableSessionId: 1, qrCode })
      });
      onTriggerFetch();
      alert('รีเซ็ตเซสชันกลับไปสถานะ "ยังไม่เริ่ม" แล้วครับ\nสามารถไปเทสกด "เริ่มสั่งอาหาร" ที่หน้าแรกได้เลย');
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 left-4 z-50 bg-black text-white text-[10px] font-mono px-2 py-1 rounded opacity-50 hover:opacity-100 transition-opacity"
      >
        DEV TOOLS
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 left-4 z-50 bg-black/90 p-3 rounded-lg border border-gray-700 shadow-2xl flex flex-col gap-2 w-[180px]">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white text-[10px] font-mono font-bold text-green-400">DEV TOOLS</span>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      
      <div className="text-[10px] text-gray-400 font-mono mb-1">Shift Time</div>
      <div className="grid grid-cols-2 gap-1">
        <button onClick={() => shiftTime(10)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">+10m</button>
        <button onClick={() => shiftTime(-10)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">-10m</button>
        <button onClick={() => shiftTime(5)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">+5m</button>
        <button onClick={() => shiftTime(-5)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">-5m</button>
        <button onClick={() => shiftTime(1)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">+1m</button>
        <button onClick={() => shiftTime(-1)} className="bg-gray-800 text-white text-[10px] py-1 rounded hover:bg-gray-700 font-mono">-1m</button>
      </div>

      <div className="text-[10px] text-gray-400 font-mono mt-2 mb-1">Test Notifications (Set exact)</div>
      <div className="grid grid-cols-3 gap-1">
        <button onClick={() => setExactTime(31)} className="bg-purple-900/50 text-purple-300 border border-purple-800 text-[9px] py-1 rounded hover:bg-purple-800 font-mono">Set 31m</button>
        <button onClick={() => setExactTime(6)} className="bg-orange-900/50 text-orange-300 border border-orange-800 text-[9px] py-1 rounded hover:bg-orange-800 font-mono">Set 6m</button>
        <button onClick={() => setExactTime(1)} className="bg-red-900/50 text-red-300 border border-red-800 text-[9px] py-1 rounded hover:bg-red-800 font-mono">Set 1m</button>
      </div>
      
      <div className="text-[10px] text-gray-400 font-mono mt-1 mb-1">Grace Period (1m)</div>
      <button onClick={forceConfirm} className="w-full bg-blue-900/50 text-blue-300 text-[10px] py-1.5 rounded hover:bg-blue-800/80 font-mono border border-blue-800">
        Force Auto-Confirm
      </button>

      <div className="text-[10px] text-gray-400 font-mono mt-1 mb-1">Testing Flow</div>
      <button onClick={resetSession} className="w-full bg-red-900/50 text-red-300 text-[10px] py-1.5 rounded hover:bg-red-800/80 font-mono border border-red-800">
        Reset to "Not Started"
      </button>
    </div>
  );
}
