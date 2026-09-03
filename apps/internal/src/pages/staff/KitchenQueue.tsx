import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Refrigerator, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type Ingredient = {
  id: string
  name: string
  category: 'meat' | 'vegetable'
  defaultPortionSizeKg: number
  thawPrepThresholdPlates: number | null
}

type Lot = {
  ingredientId: string
  quantity: number
  location?: string
  status: 'Fresh' | 'Expiring Soon' | 'Expired'
}

type PrepAlert = Ingredient & {
  prepPlates: number
  shortage: number
  freezerKg: number
  freezerPlates: number
}

function isPrep(location = '') {
  const value = location.toLowerCase()
  return value.includes('prep') || value.includes('thaw') || value.includes('ละลาย')
}

function isFreezer(location = '') {
  return location.toLowerCase().includes('freezer')
}

export default function StaffKitchenQueuePage() {
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadQueue = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const [ingredientData, lotData] = await Promise.all([
        apiFetch<{ ingredients: Ingredient[] }>('/inventory/ingredients'),
        apiFetch<{ lots: Lot[] }>('/inventory/lots'),
      ])
      setIngredients(ingredientData.ingredients ?? [])
      setLots(lotData.lots ?? [])
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดคิวเติม Prep ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue(true)
    const polling = window.setInterval(() => void loadQueue(), 10_000)
    return () => window.clearInterval(polling)
  }, [loadQueue])

  const alerts = useMemo<PrepAlert[]>(() => ingredients
    .filter((ingredient) => ingredient.category === 'meat' && ingredient.thawPrepThresholdPlates !== null)
    .map((ingredient) => {
      const usable = lots.filter((lot) => lot.ingredientId === ingredient.id && lot.status !== 'Expired')
      const prepPlates = usable.filter((lot) => isPrep(lot.location)).reduce((sum, lot) => sum + lot.quantity, 0)
      const freezerKg = usable.filter((lot) => isFreezer(lot.location)).reduce((sum, lot) => sum + lot.quantity, 0)
      const threshold = ingredient.thawPrepThresholdPlates ?? 0
      return {
        ...ingredient,
        prepPlates,
        shortage: Math.max(0, Math.ceil(threshold - prepPlates)),
        freezerKg,
        freezerPlates: ingredient.defaultPortionSizeKg > 0
          ? Math.floor(freezerKg / ingredient.defaultPortionSizeKg)
          : 0,
      }
    })
    .filter((ingredient) => ingredient.prepPlates < (ingredient.thawPrepThresholdPlates ?? 0))
    .sort((a, b) => {
      const aRatio = a.prepPlates / Math.max(a.thawPrepThresholdPlates ?? 1, 1)
      const bRatio = b.prepPlates / Math.max(b.thawPrepThresholdPlates ?? 1, 1)
      return aRatio - bRatio || a.name.localeCompare(b.name, 'th')
    }), [ingredients, lots])

  const visibleAlerts = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? alerts.filter((alert) => alert.name.toLowerCase().includes(value)) : alerts
  }, [alerts, query])

  return (
    <div className="w-full max-w-[1500px] bg-[#FDFBF7] p-4 pb-20 sm:p-6">
      <header className="anim-down d-1 mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[#2D1B17] bg-[#E04F34] text-white shadow-[3px_3px_0_#2D1B17]"><Refrigerator size={21} /></span>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-2xl font-black text-[#302221]">Kitchen Queue</h1><span className="rounded-full bg-[#EAE5DF] px-2 py-0.5 text-[10px] font-bold">Live 10s</span></div>
            <p className="text-xs font-semibold text-[#7B726B]">แจ้งเตือนวัตถุดิบใน Prep ที่เหลือถึงหรือต่ำกว่าค่าขั้นต่ำ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="relative min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B726B]" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาวัตถุดิบ..." className="w-full rounded-xl border border-[#EAE5DF] bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#B97861]" /></label>
          <button type="button" onClick={() => void loadQueue(true)} className="rounded-xl border-2 border-[#2D1B17] bg-white px-3 text-[#302221]" title="รีเฟรช"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      {error && <div role="alert" className="mb-4 rounded-xl border-2 border-red-700 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}

      {!loading && alerts.length > 0 && <div className="mb-5 flex items-center gap-3 rounded-xl border-2 border-[#E04F34] bg-[#FFF5F2] p-3 shadow-[3px_3px_0_#E04F34]"><Bell size={18} className="text-[#E04F34]" /><div><p className="text-sm font-black text-[#B8321B]">มี {alerts.length} รายการที่ควรเติม Prep</p><p className="text-[11px] font-semibold text-[#7B726B]">เรียงจากรายการที่เหลือน้อยที่สุดเมื่อเทียบกับค่าขั้นต่ำ</p></div></div>}

      {loading ? (
        <div className="rounded-2xl border-2 border-dashed border-[#D6D0C4] bg-white p-14 text-center text-sm font-bold text-[#7B726B]">กำลังตรวจสอบสต็อก Prep…</div>
      ) : visibleAlerts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#B7C9B1] bg-white p-14 text-center"><CheckCircle2 className="mx-auto text-green-700" size={38} /><p className="mt-3 text-lg font-black text-[#302221]">{query ? 'ไม่พบวัตถุดิบที่ค้นหา' : 'สต็อก Prep อยู่ในระดับปกติ'}</p><p className="mt-1 text-xs font-semibold text-[#7B726B]">ยังไม่มีรายการที่เหลือถึงค่าขั้นต่ำ</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleAlerts.map((alert) => {
            const threshold = alert.thawPrepThresholdPlates ?? 0
            const critical = alert.prepPlates === 0
            const sourceEnough = alert.freezerPlates >= alert.shortage
            return <article key={alert.id} className={`overflow-hidden rounded-2xl border-2 border-[#2D1B17] bg-white shadow-[5px_5px_0_#2D1B17] ${critical ? 'ring-2 ring-red-500/30' : ''}`}>
              <header className={`flex items-center justify-between border-b-2 border-[#2D1B17] px-4 py-3 ${critical ? 'bg-[#E04F34] text-white' : 'bg-amber-100 text-[#302221]'}`}><div className="flex items-center gap-2"><AlertTriangle size={17} /><h2 className="font-black">{alert.name}</h2></div><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-[#7A3024]">{critical ? 'หมดแล้ว' : 'ควรเติม'}</span></header>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 text-center"><Metric label="คงเหลือ" value={`${alert.prepPlates.toLocaleString('th-TH')} ถาด`} /><Metric label="ขั้นต่ำ" value={`${threshold.toLocaleString('th-TH')} ถาด`} /><Metric label="ควรเติมอย่างน้อย" value={`${alert.shortage.toLocaleString('th-TH')} ถาด`} accent /></div>
                <p className={`mt-3 rounded-lg px-3 py-2 text-[11px] font-bold ${sourceEnough ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>Freezer ทำได้ประมาณ {alert.freezerPlates.toLocaleString('th-TH')} ถาด ({alert.freezerKg.toFixed(3)} kg){!sourceEnough && ' — สต็อกต้นทางไม่พอ'}</p>
                <button type="button" onClick={() => navigate('/staff/transfer-to-thaw-prep')} className="mt-4 w-full rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5">เติมจาก Freezer →</button>
              </div>
            </article>
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-3 ${accent ? 'border-[#E04F34] bg-[#FFF5F2]' : 'border-[#EAE5DF] bg-[#FAF8F5]'}`}><p className="text-[9px] font-black uppercase text-[#876E65]">{label}</p><p className={`mt-1 text-sm font-black ${accent ? 'text-[#B8321B]' : 'text-[#302221]'}`}>{value}</p></div>
}
