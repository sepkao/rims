import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type ExpiryAlert = {
  lotId: string
  ingredientId: string
  ingredientName: string
  quantityKg: number
  expiryDate: string
  warningDays: number
  daysLeft: number
  severity: 'critical' | 'warning'
}

type LowStockAlert = {
  ingredientId: string
  ingredientName: string
  thresholdKg: number
  remainingKg: number
  severity: 'critical' | 'low'
}

export default function OwnerNotifications() {
  const navigate = useNavigate()
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [expiry, lowStock] = await Promise.all([
        apiFetch<{ alerts: ExpiryAlert[] }>('/owner/expiry-alerts'),
        apiFetch<{ alerts: LowStockAlert[] }>('/owner/low-stock-alerts'),
      ])
      setExpiryAlerts(expiry.alerts)
      setLowStockAlerts(lowStock.alerts)
      setUpdatedAt(new Date())
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => { void refresh(true) }, 10000)
    return () => window.clearInterval(interval)
  }, [refresh])

  return (
    <div className="w-full max-w-[1100px]">
      <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E7C7B8] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border-[24px] border-white/35" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]"><CalendarClock size={13} /> NOTIFICATIONS</span><h1 className="mt-4 text-4xl font-black tracking-[-.035em]">ของต่ำ · ใกล้หมดอายุ</h1><p className="mt-2 text-sm font-bold text-[#6D5147]">สต็อกเนื้อใน Freezer ที่ต่ำกว่าเกณฑ์สั่งซื้อ และล็อตที่ใกล้ถึงวันหมดอายุ · อัปเดตอัตโนมัติทุก 10 วินาที</p></div>
          <button type="button" onClick={() => { void refresh() }} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 text-xs font-black shadow-[3px_3px_0_#2D1B17] disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />รีเฟรช</button>
        </div>
      </header>

      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <section className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#6D5147]"><TriangleAlert size={16} /> สต็อกต่ำใน Freezer ({lowStockAlerts.length})</h2>
        {!loading && lowStockAlerts.length === 0 ? (
          <div className="rounded-[26px] border-2 border-green-900 bg-green-50 px-7 py-10 text-center shadow-[7px_7px_0_#2D1B17]"><CheckCircle2 className="mx-auto text-green-800" size={38} /><h3 className="mt-3 text-xl font-black text-green-900">สต็อก Freezer อยู่ในเกณฑ์ปกติ</h3><p className="mt-1 text-sm font-bold text-green-800">ยังไม่มีวัตถุดิบที่ต่ำกว่าเกณฑ์สั่งซื้อในขณะนี้</p></div>
        ) : loading ? (
          <div className="rounded-[26px] border-2 border-[#2D1B17] bg-white px-6 py-10 text-center text-sm font-bold shadow-[7px_7px_0_#2D1B17]">กำลังตรวจสอบสต็อก Freezer…</div>
        ) : (
          <div className="space-y-5">
            {lowStockAlerts.map((alert, index) => (
              <article key={alert.ingredientId} className={`anim-up overflow-hidden rounded-[26px] border-2 border-[#2D1B17] shadow-[7px_7px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'}`} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2D1B17] shadow-[3px_3px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-300'}`}><TriangleAlert size={23} /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#805349]">{alert.severity === 'critical' ? 'หมด Freezer — เร่งด่วน' : 'ต่ำกว่าเกณฑ์สั่งซื้อ'}</p><h3 className="mt-1 text-2xl font-black">{alert.ingredientName}</h3><p className="mt-1 text-xs font-bold text-[#75584E]">คงเหลือ {alert.remainingKg.toFixed(3)} / ขั้นต่ำ {alert.thresholdKg.toFixed(3)} kg</p></div></div>
                  <button type="button" onClick={() => navigate('/owner/ingredient-settings')} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-xs font-black text-white shadow-[3px_3px_0_#B97861]">ไปหน้าจัดการวัตถุดิบ →</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#6D5147]"><CalendarClock size={16} /> ใกล้หมดอายุใน Freezer ({expiryAlerts.length})</h2>
        {!loading && expiryAlerts.length === 0 ? (
          <div className="rounded-[26px] border-2 border-green-900 bg-green-50 px-7 py-10 text-center shadow-[7px_7px_0_#2D1B17]"><CheckCircle2 className="mx-auto text-green-800" size={38} /><h3 className="mt-3 text-xl font-black text-green-900">ยังไม่มีล็อตใกล้หมดอายุ</h3><p className="mt-1 text-sm font-bold text-green-800">ล็อตใน Freezer ทั้งหมดยังอยู่ในเกณฑ์ปกติ</p></div>
        ) : loading ? (
          <div className="rounded-[26px] border-2 border-[#2D1B17] bg-white px-6 py-10 text-center text-sm font-bold shadow-[7px_7px_0_#2D1B17]">กำลังตรวจสอบวันหมดอายุ…</div>
        ) : (
          <div className="space-y-5">
            {expiryAlerts.map((alert, index) => (
              <article key={alert.lotId} className={`anim-up overflow-hidden rounded-[26px] border-2 border-[#2D1B17] shadow-[7px_7px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'}`} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2D1B17] shadow-[3px_3px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-300'}`}><CalendarClock size={23} /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#805349]">{alert.severity === 'critical' ? 'หมดอายุวันนี้/พรุ่งนี้' : `เหลือ ${alert.daysLeft} วัน`}</p><h3 className="mt-1 text-2xl font-black">{alert.ingredientName}</h3><p className="mt-1 text-xs font-bold text-[#75584E]">ล็อต #{alert.lotId} · {alert.quantityKg.toFixed(3)} kg · หมดอายุ {new Date(alert.expiryDate).toLocaleDateString('th-TH')}</p></div></div>
                  <button type="button" onClick={() => navigate('/owner/freezer-stock')} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-xs font-black text-white shadow-[3px_3px_0_#B97861]">ไปดู Freezer stock →</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {updatedAt && <p className="mt-5 text-right text-[10px] font-bold text-[#8A7067]">ตรวจล่าสุด {updatedAt.toLocaleTimeString('th-TH')}</p>}
    </div>
  )
}
