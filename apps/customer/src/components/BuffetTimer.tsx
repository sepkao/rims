import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';

export default function BuffetTimer({ expiresAt }: { expiresAt?: string }) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const now = Date.now();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setIsExpired(false);
      setTimeLeft(formatted);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (isExpired) navigate('/expired');
      }}
      title={isExpired ? 'แตะเพื่อดูสรุปหมดเวลา' : 'เวลานับถอยหลังบุฟเฟต์'}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border-2 transition-all active:translate-y-0.5 ${
        isExpired
          ? 'bg-red-50 text-red-700 border-red-600 shadow-[2px_2px_0_#DC2626] animate-pulse cursor-pointer'
          : 'bg-[#FFF8EF] text-[#2D1B17] border-[#2D1B17] shadow-[2px_2px_0_#2D1B17] cursor-default'
      }`}
    >
      <Clock size={13} strokeWidth={2.5} className={isExpired ? 'text-red-600' : 'text-[#B97861]'} />
      <span className="tracking-tight">{isExpired ? 'หมดเวลาบุฟเฟต์ ➔' : timeLeft}</span>
    </button>
  );
}
