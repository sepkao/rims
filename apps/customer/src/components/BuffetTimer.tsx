import { useEffect, useState } from 'react';

export default function BuffetTimer({ expiresAt }: { expiresAt?: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        setIsExpired(true);
      } else if (diff > 24 * 60 * 60 * 1000) {
        setTimeLeft('ยังไม่เริ่มจับเวลา');
        setIsExpired(false);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
        setIsExpired(false);
      }
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border ${isExpired ? 'bg-[#FEF2F2] text-[#E53E3E] border-[#FCA5A5]' : 'bg-white text-[#5A403E] border-[#EAE5DF]'}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {isExpired ? 'หมดเวลาบุฟเฟต์' : `${timeLeft}`}
    </div>
  );
}
