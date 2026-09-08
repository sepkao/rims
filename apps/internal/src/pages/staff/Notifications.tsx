import { useCallback, useEffect, useState } from 'react'
import { BellRing, CalendarClock, CheckCircle2, RefreshCw, Snowflake, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type PrepAlert = {
  ingredientId: string
  ingredientName: string
  thresholdPlates: number
  availablePlates: number
  shortagePlates: number
  portionSizeKg: number
  recommendedTransferKg: number
  freezerAvailableKg: number
  severity: 'critical' | 'low'
}

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

export default function Notifications() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<PrepAlert[]>([])
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [prep, expiry] = await Promise.all([
        apiFetch<{ alerts: PrepAlert[] }>('/staff/prep-alerts'),
        apiFetch<{ alerts: ExpiryAlert[] }>('/staff/expiry-alerts'),
      ])
      setAlerts(prep.alerts)
      setExpiryAlerts(expiry.alerts)
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
          <div><span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]"><BellRing size={13} /> ALERTS</span><h1 className="mt-4 text-4xl font-black tracking-[-.035em]">ของต่ำ · ใกล้หมดอายุ</h1><p className="mt-2 text-sm font-bold text-[#6D5147]">แจ้งเตือนเนื้อใน Prep ที่ต่ำกว่าเกณฑ์ และล็อตใน Freezer ที่ใกล้หมดอายุ · อัปเดตอัตโนมัติทุก 10 วินาที</p></div>
          <button type="button" onClick={() => { void refresh() }} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 text-xs font-black shadow-[3px_3px_0_#2D1B17] disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />รีเฟรช</button>
        </div>
      </header>

      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <section className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#6D5147]"><TriangleAlert size={16} /> ของต่ำกว่าเกณฑ์ ({alerts.length})</h2>
        {!loading && alerts.length === 0 ? (
          <div className="rounded-[26px] border-2 border-green-900 bg-green-50 px-7 py-10 text-center shadow-[7px_7px_0_#2D1B17]"><CheckCircle2 className="mx-auto text-green-800" size={38} /><h3 className="mt-3 text-xl font-black text-green-900">Prep ครบตามเกณฑ์แล้ว</h3><p className="mt-1 text-sm font-bold text-green-800">ยังไม่มีวัตถุดิบเนื้อที่ต้องแปรรูปเติมในขณะนี้</p></div>
        ) : loading ? (
          <div className="rounded-[26px] border-2 border-[#2D1B17] bg-white px-6 py-10 text-center text-sm font-bold shadow-[7px_7px_0_#2D1B17]">กำลังตรวจสอบสต็อก Prep…</div>
        ) : (
          <div className="space-y-5">
            {alerts.map((alert, index) => {
              const canFill = alert.freezerAvailableKg >= alert.recommendedTransferKg
              return <article key={alert.ingredientId} className={`anim-up overflow-hidden rounded-[26px] border-2 border-[#2D1B17] shadow-[7px_7px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'}`} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2D1B17] shadow-[3px_3px_0_#2D1B17] ${alert.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-300'}`}><TriangleAlert size={23} /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#805349]">{alert.severity === 'critical' ? 'หมด Prep — เร่งด่วน' : 'ต่ำกว่าเกณฑ์'}</p><h3 className="mt-1 text-2xl font-black">{alert.ingredientName}</h3><p className="mt-1 text-xs font-bold text-[#75584E]">คงเหลือ {alert.availablePlates.toLocaleString('th-TH')} / ขั้นต่ำ {alert.thresholdPlates.toLocaleString('th-TH')} ถาด</p></div></div>
                  <div className="grid min-w-[330px] grid-cols-3 gap-3"><Metric label="ต้องเติม" value={`${alert.shortagePlates} ถาด`} /><Metric label="น้ำหนัก" value={`${alert.recommendedTransferKg.toFixed(3)} kg`} /><Metric label="Freezer" value={`${alert.freezerAvailableKg.toFixed(3)} kg`} /></div>
                </div>
                <footer className="flex flex-col gap-3 border-t-2 border-[#2D1B17] bg-white/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className={`flex items-center gap-2 text-xs font-black ${canFill ? 'text-green-800' : 'text-red-700'}`}><Snowflake size={15} />{canFill ? 'Freezer มีเพียงพอสำหรับเติมถึงเกณฑ์' : 'Freezer ไม่พอเติมครบเกณฑ์ กรุณาแจ้ง Owner'}</p><button type="button" onClick={() => navigate(`/staff/transfer-to-thaw-prep?ingredient=${encodeURIComponent(alert.ingredientId)}`)} disabled={alert.freezerAvailableKg <= 0} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-xs font-black text-white shadow-[3px_3px_0_#B97861] disabled:cursor-not-allowed disabled:opacity-40">ไปหน้าแปรรูป →</button></footer>
              </article>
            })}
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
                  <button type="button" onClick={() => navigate('/staff/freezer-stock')} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-xs font-black text-white shadow-[3px_3px_0_#B97861]">ไปดู Freezer stock →</button>
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border-2 border-[#2D1B17] bg-white px-3 py-3 text-center"><p className="text-[9px] font-black uppercase tracking-wider text-[#8A7067]">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>
}
