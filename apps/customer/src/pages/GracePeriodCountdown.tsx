import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { customerQuery, requireQrCode, type CustomerSession } from '../lib/customer-session'
import QrExpiryBanner from '../components/QrExpiryBanner'
import { AlertCircle, CheckCircle2, Clock, RotateCcw, UtensilsCrossed } from 'lucide-react'

type OrderedItem = {
  orderId: string
  status: 'pending' | 'cooking' | 'serving' | 'served' | 'cancelled' | 'unknown'
  confirmAt: string
}

export default function GracePeriodCountdown() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const [status, setStatus] = useState<OrderedItem['status'] | 'loading'>('loading')
  const [remaining, setRemaining] = useState(60)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [session, setSession] = useState<CustomerSession | null>(null)

  const refresh = useCallback(async () => {
    if (!orderId) return
    try {
      const data = await apiFetch<{ items: OrderedItem[]; session: CustomerSession }>(`/customer/orders${customerQuery()}`)
      setSession(data.session)
      const item = data.items.find((candidate) => candidate.orderId === orderId)
      if (!item) {
        setStatus('cancelled')
        return
      }
      setStatus(item.status)
      setRemaining(Math.max(0, Math.ceil((new Date(item.confirmAt).getTime() - Date.now()) / 1000)))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ตรวจสอบสถานะออเดอร์ไม่สำเร็จ')
    }
  }, [orderId])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 1000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const cancelOrder = async () => {
    if (!orderId || cancelling) return
    setCancelling(true)
    try {
      await apiFetch(`/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ qrCode: requireQrCode() }),
      })
      navigate('/order', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถยกเลิกออเดอร์ได้')
    } finally {
      setCancelling(false)
    }
  }

  if (!orderId) {
    return (
      <Result 
        title="ไม่พบเลขออเดอร์" 
        detail="กลับไปที่เมนูแล้วสั่งใหม่อีกครั้ง" 
        action="กลับหน้าเมนู" 
        onAction={() => navigate('/order', { replace: true })} 
        error 
      />
    )
  }

  if (status === 'cancelled') {
    return (
      <Result 
        title="รายการถูกยกเลิกแล้ว" 
        detail="ออเดอร์ถูกยกเลิกเรียบร้อย หรือวัตถุดิบหมดพอดี กรุณาเลือกเมนูใหม่อีกครั้ง" 
        action="กลับหน้าเมนู" 
        onAction={() => navigate('/order', { replace: true })} 
        error 
      />
    )
  }

  if (status === 'cooking' || status === 'serving' || status === 'served') {
    return (
      <Result 
        title={status === 'served' ? 'เสิร์ฟอาหารแล้ว!' : 'ครัวยืนยันออเดอร์แล้ว'} 
        detail={status === 'served' ? 'ขอให้อร่อยกับมื้อบุฟเฟต์สุดพิเศษค่ะ' : 'ครัวได้รับรายการและกำลังเตรียมอาหารเพื่อจัดเสิร์ฟ'} 
        action="ดูสถานะออเดอร์" 
        onAction={() => navigate('/order/history', { replace: true })} 
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <main className="flex h-screen w-full max-w-[430px] flex-col items-center justify-center bg-[#FDFBF7] px-7 text-center shadow-2xl border-x-2 border-[#2D1B17] relative overflow-hidden">
        <div className="absolute left-0 top-0 w-full"><QrExpiryBanner expiresAt={session?.expiresAt} /></div>

        <div className="anim-down d-1 w-full max-w-sm">
          {/* Brand Icon Header */}
          <div className="w-12 h-12 bg-[#FFF8EF] border-2 border-[#2D1B17] rounded-2xl shadow-[3px_3px_0_#2D1B17] flex items-center justify-center mx-auto mb-5 text-[#B97861]">
            <UtensilsCrossed size={22} strokeWidth={2.5} />
          </div>

          {/* Countdown Clock (Tactile Retro-Digital) */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-28 h-28 rounded-full border-4 border-[#2D1B17] bg-[#FFF8EF] shadow-[4px_4px_0_#2D1B17] flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-[#2D1B17] tracking-tight count-anim">
                {remaining}
              </span>
              <span className="text-[10px] font-bold text-[#7B726B] uppercase tracking-wider">วินาที</span>
            </div>
            
            <div className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500 border border-white" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-[#2D1B17] tracking-tight">ส่งออเดอร์เข้าครัวแล้ว</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#7B726B]">
            สามารถเปลี่ยนใจยกเลิกได้ภายใน <strong className="text-[#2D1B17] font-black">{remaining} วินาที</strong><br />
            เมื่อหมดเวลา ระบบจะตัดสต็อกและส่งเข้าคิวครัวทันที
          </p>

          {error && <p role="alert" className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-700">{error}</p>}

          <div className="mt-8 space-y-3">
            <button 
              type="button"
              onClick={cancelOrder} 
              disabled={cancelling || remaining <= 0} 
              className="w-full rounded-xl border-2 border-red-600 bg-red-50 hover:bg-red-100 py-3 font-black text-xs text-red-700 shadow-[3px_3px_0_#DC2626] active:translate-y-0.5 transition-all disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw size={13} strokeWidth={2.5} />
                <span>{cancelling ? 'กำลังยกเลิก…' : 'ยกเลิกออเดอร์นี้'}</span>
              </span>
            </button>

            <button 
              type="button"
              onClick={() => navigate('/order/history')} 
              className="shabu-btn-secondary w-full py-3 text-xs"
            >
              <Clock size={14} strokeWidth={2.5} />
              <span>ดูประวัติและติดตามสถานะ</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function Result({ 
  title, 
  detail, 
  action, 
  onAction, 
  error = false 
}: { 
  title: string; 
  detail: string; 
  action: string; 
  onAction: () => void; 
  error?: boolean 
}) {
  return (
    <div className="min-h-screen bg-[#F2ECE4] flex justify-center">
      <main className="flex h-screen w-full max-w-[430px] flex-col items-center justify-center bg-[#FDFBF7] px-7 text-center shadow-2xl border-x-2 border-[#2D1B17]">
        <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center mb-5 ${
          error 
            ? 'bg-red-100 border-red-600 text-red-700 shadow-[3px_3px_0_#DC2626]' 
            : 'bg-emerald-100 border-emerald-700 text-emerald-700 shadow-[3px_3px_0_#059669]'
        }`}>
          {error ? <AlertCircle size={32} strokeWidth={2.5} /> : <CheckCircle2 size={32} strokeWidth={2.5} />}
        </div>
        
        <h1 className="text-2xl font-black text-[#2D1B17] tracking-tight">{title}</h1>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#7B726B] max-w-[260px]">{detail}</p>
        
        <button 
          type="button"
          onClick={onAction} 
          className="shabu-btn-primary mt-8 w-full max-w-xs py-3 text-xs shadow-[3px_3px_0_#B97861]"
        >
          {action}
        </button>
      </main>
    </div>
  )
}
