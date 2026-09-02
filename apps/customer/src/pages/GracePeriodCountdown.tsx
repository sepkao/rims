import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { customerQuery, requireQrCode, type CustomerSession } from '../lib/customer-session'
import QrExpiryBanner from '../components/QrExpiryBanner'

type OrderedItem = {
  orderId: string
  status: 'pending' | 'cooking' | 'served' | 'cancelled' | 'unknown'
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
    return <Result title="ไม่พบเลขออเดอร์" detail="กลับไปที่เมนูแล้วสั่งใหม่อีกครั้ง" action="กลับหน้าเมนู" onAction={() => navigate('/order', { replace: true })} />
  }
  if (status === 'cancelled') {
    return <Result title="รายการถูกยกเลิก" detail="วัตถุดิบอาจหมดพอดี หรือออเดอร์ถูกยกเลิกแล้ว กรุณาเลือกเมนูอีกครั้ง" action="กลับหน้าเมนู" onAction={() => navigate('/order', { replace: true })} error />
  }
  if (status === 'cooking' || status === 'served') {
    return <Result title={status === 'served' ? 'เสิร์ฟแล้ว' : 'ยืนยันออเดอร์แล้ว'} detail={status === 'served' ? 'ขอให้อร่อยกับมื้ออาหารค่ะ' : 'ครัวได้รับรายการแล้ว กำลังเตรียมอาหาร'} action="ดูประวัติออเดอร์" onAction={() => navigate('/order/cart', { replace: true })} />
  }

  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
      <main className="flex h-screen w-full max-w-[400px] flex-col items-center justify-center bg-[#FDFBF7] px-8 text-center shadow-xl relative">
        <div className="absolute left-0 top-0 w-full"><QrExpiryBanner expiresAt={session?.expiresAt} /></div>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-amber-100 text-3xl font-bold text-amber-800">{remaining}</div>
        <h1 className="mt-8 text-2xl font-bold text-[#302221]">ส่งออเดอร์แล้ว</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#7B726B]">ยังยกเลิกได้ภายใน {remaining} วินาที<br />หลังจากนั้นระบบจะยืนยันและส่งเข้าครัวอัตโนมัติ</p>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button onClick={cancelOrder} disabled={cancelling || remaining <= 0} className="mt-8 w-full rounded-lg border border-red-300 bg-white py-3 font-bold text-red-700 disabled:opacity-50">
          {cancelling ? 'กำลังยกเลิก…' : 'ยกเลิกออเดอร์'}
        </button>
        <button onClick={() => navigate('/order/cart')} className="mt-4 text-sm font-bold text-[#5A403E] underline">ดูประวัติออเดอร์</button>
      </main>
    </div>
  )
}

function Result({ title, detail, action, onAction, error = false }: { title: string; detail: string; action: string; onAction: () => void; error?: boolean }) {
  return (
    <div className="min-h-screen bg-[#EAE5DF] flex justify-center font-sans">
      <main className="flex h-screen w-full max-w-[400px] flex-col items-center justify-center bg-[#FDFBF7] px-8 text-center shadow-xl">
        <div className={`grid h-20 w-20 place-items-center rounded-full text-3xl ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{error ? '!' : '✓'}</div>
        <h1 className="mt-7 text-2xl font-bold text-[#302221]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#7B726B]">{detail}</p>
        <button onClick={onAction} className="mt-8 w-full rounded-lg bg-[#5A403E] py-3 font-bold text-white">{action}</button>
      </main>
    </div>
  )
}
