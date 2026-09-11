import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock } from 'lucide-react';
import { ORDERING_CUTOFF_MS } from '../lib/customer-session';

export default function QrExpiryBanner({ expiresAt }: { expiresAt?: string }) {
  const navigate = useNavigate();
  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs > ORDERING_CUTOFF_MS) return null;

  if (remainingMs <= 0) {
    return (
      <div 
        role="alert" 
        onClick={() => navigate('/expired')}
        className="bg-red-50 border-b-2 border-red-600 px-4 py-2 text-center text-xs font-black text-red-700 flex items-center justify-center gap-2 cursor-pointer hover:bg-red-100 transition-colors shadow-xs"
      >
        <AlertCircle size={14} className="text-red-600 shrink-0" />
        <span>รอบเวลาบุฟเฟต์หมดแล้ว • แตะเพื่อดูสรุปหรือเรียกเช็คบิล ➔</span>
      </div>
    );
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  return (
    <div 
      role="status" 
      className="bg-amber-100 border-b-2 border-amber-500 px-4 py-1.5 text-center text-xs font-black text-amber-900 flex items-center justify-center gap-1.5 shadow-2xs"
    >
      <Clock size={13} className="text-amber-700 animate-spin" />
      <span>ปิดรับออเดอร์ใหม่แล้ว • เหลือเวลาทานอีก {remainingMinutes} นาที</span>
    </div>
  );
}
