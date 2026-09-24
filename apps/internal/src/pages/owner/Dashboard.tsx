import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  Flame,
  History,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useInventory } from '../../contexts/InventoryContext'
import { apiFetch } from '../../lib/api'

type SalesPeriod = 'day' | 'week' | 'month'

type TopIngredient = {
  id: string
  name: string
  category: 'meat' | 'vegetable'
  netPlates: number
}

type TopIngredientsResponse = {
  period: SalesPeriod
  periodStart: string
  periodEnd: string
  totalNetPlates: number
  ingredients: TopIngredient[]
}

const salesPeriodOptions: Array<{ value: SalesPeriod; label: string }> = [
  { value: 'day', label: 'วันนี้' },
  { value: 'week', label: 'สัปดาห์นี้' },
  { value: 'month', label: 'เดือนนี้' },
]

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
  storage: string
  unit: 'kg' | 'plate'
  threshold: number
  remaining: number
  severity: 'critical' | 'low'
}

function formatCardCount(value: number) {
  return value.toLocaleString('th-TH', { minimumIntegerDigits: 2 })
}

export default function DashboardPage() {
  const {
    batches: inventoryBatches,
    loading: inventoryLoading,
    refresh: refreshInventory,
  } = useInventory()

  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [errorAlerts, setErrorAlerts] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('day')
  const [salesData, setSalesData] = useState<TopIngredientsResponse | null>(null)

  const inStock = inventoryBatches.filter((batch) => Number.parseFloat(batch.qty) > 0)
  const expiring = inStock.filter((batch) => batch.status === 'Expiring Soon')
  const expired = inStock.filter((batch) => batch.status === 'Expired')
  const usable = inStock.filter((batch) => batch.status !== 'Expired')

  const refreshAlerts = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingAlerts(true)
    try {
      const [expiry, lowStock, topIngredients] = await Promise.all([
        apiFetch<{ alerts: ExpiryAlert[] }>('/owner/expiry-alerts'),
        apiFetch<{ alerts: LowStockAlert[] }>('/owner/low-stock-alerts'),
        apiFetch<TopIngredientsResponse>(`/owner/top-ingredients?period=${salesPeriod}`),
      ])
      setExpiryAlerts(expiry.alerts || [])
      setLowStockAlerts(lowStock.alerts || [])
      setSalesData(topIngredients)
      setLastChecked(new Date())
      setErrorAlerts('')
    } catch (caught) {
      setErrorAlerts(caught instanceof Error ? caught.message : 'โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      if (!quiet) setLoadingAlerts(false)
    }
  }, [salesPeriod])

  const handleRefreshAll = async () => {
    await Promise.all([refreshInventory(), refreshAlerts(false)])
  }

  useEffect(() => {
    void refreshAlerts()
    const interval = window.setInterval(() => {
      void refreshAlerts(true)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [refreshAlerts])

  const isLoading = inventoryLoading || loadingAlerts
  const selectedPeriod = salesPeriodOptions.find((option) => option.value === salesPeriod) ?? salesPeriodOptions[0]
  const totalNetPlates = Math.max(0, Math.round(Number(salesData?.totalNetPlates ?? 0)))
  const maxIngredientPlates = Math.max(
    1,
    ...((salesData?.ingredients ?? []).map((ingredient) => Number(ingredient.netPlates))),
  )

  return (
    <div className="w-full max-w-[1240px]">
      {/* ─── Header Hero Banner ─── */}
      <header className="system-hero anim-down d-1 group relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17] transition-all duration-300 hover:shadow-[11px_11px_0_#2D1B17]">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-white/40 transition-transform duration-700 ease-out group-hover:scale-110" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black tracking-wide text-[#2D1B17] shadow-[2px_2px_0_#2D1B17] transition-transform duration-200 hover:scale-105">
              <Flame size={13} className="animate-pulse text-[#B97861]" /> FRESHNESS & INVENTORY HUB
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-[-.035em] text-[#2D1B17]">
              ศูนย์ควบคุมความสดและสต็อก
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-bold text-[#6D5147]">
              จัดลำดับการใช้วัตถุดิบตาม FIFO, ตรวจจับวัตถุดิบต่ำกว่าเกณฑ์ และติดตามล็อตเสี่ยงหมดอายุแบบ Real-time
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { void handleRefreshAll() }}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 text-xs font-black text-[#2D1B17] shadow-[3px_3px_0_#2D1B17] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#FBF8F3] hover:shadow-[5px_5px_0_#2D1B17] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#2D1B17] disabled:opacity-50"
              title="รีเฟรชข้อมูลทั้งระบบ"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : 'transition-transform duration-500 hover:rotate-180'} />
              รีเฟรชสต็อก
            </button>
            <Link
              to="/owner/history"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#93AF54] px-5 py-2.5 text-xs font-black text-white shadow-[4px_4px_0_#2D1B17] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#86A149] hover:shadow-[6px_6px_0_#2D1B17] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#2D1B17]"
            >
              <History size={14} />
              ดูทุกล็อตสินค้า
            </Link>
          </div>
        </div>
      </header>

      {errorAlerts && (
        <div className="anim-down d-2 mb-6 rounded-[22px] border-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-4 text-sm font-black text-[#2D1B17] shadow-[4px_4px_0_#2D1B17]">
          {errorAlerts}
        </div>
      )}

      {/* ─── Metric Stat Cards (Staggered Animation & Hover Lift) ─── */}
      <section className="mb-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Usable */}
        <article className="anim-up d-1 group relative overflow-hidden rounded-[24px] border-2 border-[#2D1B17] bg-[#E8D8CA] p-5 shadow-[5px_5px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[8px_8px_0_#2D1B17] cursor-default">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#75584E]">
              ล็อตพร้อมใช้งาน
            </p>
            <span className="rounded-full border-2 border-[#2D1B17] bg-white px-2 py-0.5 text-[9px] font-black text-[#2D1B17] shadow-[1px_1px_0_#2D1B17] transition-transform duration-200 group-hover:scale-105">
              FIFO
            </span>
          </div>
          <p className="count-anim mt-2 text-4xl font-black text-[#2D1B17]">
            {formatCardCount(usable.length)}{' '}
            <span className="text-sm font-bold text-[#6D5147]">ล็อต</span>
          </p>
          <p className="mt-1 text-xs font-bold text-[#75584E]">วัตถุดิบสมบูรณ์ในระบบ</p>
        </article>

        {/* Expiring soon */}
        <article className="anim-up d-2 group relative overflow-hidden rounded-[24px] border-2 border-[#2D1B17] bg-[#E7C7B8] p-5 shadow-[5px_5px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[8px_8px_0_#2D1B17] cursor-default">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#63483F]">
              ต้องใช้ก่อน
            </p>
            <span className="rounded-full border-2 border-[#2D1B17] bg-white px-2 py-0.5 text-[9px] font-black text-[#2D1B17] shadow-[1px_1px_0_#2D1B17] transition-transform duration-200 group-hover:scale-105">
              ใกล้หมดอายุ
            </span>
          </div>
          <p className="count-anim mt-2 text-4xl font-black text-[#2D1B17]">
            {formatCardCount(expiring.length)}{' '}
            <span className="text-sm font-bold text-[#63483F]">ล็อต</span>
          </p>
          <p className="mt-1 text-xs font-bold text-[#63483F]">ใกล้ถึงกำหนดใน 3 วัน</p>
        </article>

        {/* Expired */}
        <article className="anim-up d-3 group relative overflow-hidden rounded-[24px] border-2 border-[#2D1B17] bg-[#DBC8B8] p-5 shadow-[5px_5px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[8px_8px_0_#2D1B17] cursor-default">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#553C34]">
              ต้องดำเนินการ
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#2D1B17] bg-[#2D1B17] px-2 py-0.5 text-[9px] font-black text-white shadow-[1px_1px_0_#B97861] transition-transform duration-200 group-hover:scale-105">
              {expired.length > 0 && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              )}
              หมดอายุ
            </span>
          </div>
          <p className="count-anim mt-2 text-4xl font-black text-[#2D1B17]">
            {formatCardCount(expired.length)}{' '}
            <span className="text-sm font-bold text-[#553C34]">ล็อต</span>
          </p>
          <p className="mt-1 text-xs font-bold text-[#553C34]">แยกออกจากสต็อกทันที</p>
        </article>

        {/* Low Stock (Reorder Alert) */}
        <article className="anim-up d-4 group relative overflow-hidden rounded-[24px] border-2 border-[#2D1B17] bg-[#F1E2CF] p-5 shadow-[5px_5px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[8px_8px_0_#2D1B17] cursor-default">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#75584E]">
              สต็อกต่ำกว่าเกณฑ์
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full border-2 border-[#2D1B17] px-2 py-0.5 text-[9px] font-black shadow-[1px_1px_0_#2D1B17] transition-transform duration-200 group-hover:scale-105 ${
                lowStockAlerts.length > 0 ? 'bg-[#2D1B17] text-white' : 'bg-white text-[#2D1B17]'
              }`}
            >
              {lowStockAlerts.length > 0 && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              )}
              {lowStockAlerts.length > 0 ? 'ต้องสั่งซื้อ' : 'ปกติ'}
            </span>
          </div>
          <p className="count-anim mt-2 text-4xl font-black text-[#2D1B17]">
            {formatCardCount(lowStockAlerts.length)}{' '}
            <span className="text-sm font-bold text-[#75584E]">รายการ</span>
          </p>
          <p className="mt-1 text-xs font-bold text-[#75584E]">
            {lowStockAlerts.length > 0 ? 'ต่ำกว่าเกณฑ์สั่งซื้อ' : 'สต็อกอยู่ในเกณฑ์ปกติ'}
          </p>
        </article>
      </section>

      {/* ─── Live Alerts: Low Stock & Expiry Alerts ─── */}
      <section className="mb-7 grid gap-6 lg:grid-cols-2">
        {/* Card 1: Low Stock Alerts */}
        <div className="anim-up d-3 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[7px_7px_0_#2D1B17] transition-all duration-300 hover:shadow-[9px_9px_0_#2D1B17]">
          <header className="flex items-center justify-between border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] text-[#FFFDF9] shadow-[2px_2px_0_#B97861]">
                <TriangleAlert size={16} />
              </span>
              <div>
                <h2 className="text-base font-black text-[#2D1B17]">สต็อกต่ำกว่าเกณฑ์สั่งซื้อ</h2>
                <p className="text-[10px] font-bold text-[#75584E]">เนื้อสัตว์ใน Freezer และผักใน Prep</p>
              </div>
            </div>
            <span className="rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-xs font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">
              {lowStockAlerts.length} รายการ
            </span>
          </header>

          <div className="p-5">
            {lowStockAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-[#2D1B17] bg-[#FFF8EF] py-8 text-center shadow-[3px_3px_0_#2D1B17]">
                <CheckCircle2 size={36} className="mb-2 text-[#2D1B17]" />
                <p className="text-base font-black text-[#2D1B17]">สต็อกอยู่ในเกณฑ์ปกติ</p>
                <p className="mt-1 text-xs font-bold text-[#75584E]">ไม่มีวัตถุดิบที่ต่ำกว่าเกณฑ์สั่งซื้อในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {lowStockAlerts.map((alert, index) => (
                  <div
                    key={alert.ingredientId}
                    className="anim-right flex flex-col gap-3 rounded-2xl border-2 border-[#2D1B17] bg-white p-4 shadow-[3px_3px_0_#2D1B17] transition-all duration-200 hover:-translate-y-1 hover:bg-[#FFF8EF] hover:shadow-[5px_5px_0_#2D1B17] sm:flex-row sm:items-center sm:justify-between"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg border-2 border-[#2D1B17] px-2 py-0.5 text-[9px] font-black uppercase shadow-[1px_1px_0_#2D1B17] ${
                            alert.severity === 'critical'
                              ? 'bg-[#2D1B17] text-white'
                              : 'bg-[#E8D8CA] text-[#2D1B17]'
                          }`}
                        >
                          {alert.severity === 'critical' ? 'หมดสต็อก' : 'ต่ำกว่าเกณฑ์'}
                        </span>
                        <h3 className="truncate text-base font-black text-[#2D1B17]">
                          {alert.ingredientName}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#75584E]">
                        พื้นที่: <span className="font-black text-[#2D1B17]">{alert.storage}</span> · คงเหลือ{' '}
                        <span className="text-sm font-black text-[#2D1B17]">
                          {alert.remaining.toFixed(alert.unit === 'kg' ? 3 : 0)}
                        </span>{' '}
                        / เกณฑ์ขั้นต่ำ {alert.threshold.toFixed(alert.unit === 'kg' ? 3 : 0)}{' '}
                        {alert.unit === 'kg' ? 'กก.' : 'ถาด'}
                      </p>
                    </div>

                    <Link
                      to="/owner/ingredient-settings"
                      className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0_#B97861] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#3E2621] hover:shadow-[4px_4px_0_#B97861] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#B97861]"
                    >
                      ตั้งค่าวัตถุดิบ →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Expiry Alerts */}
        <div className="anim-up d-3 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[7px_7px_0_#2D1B17] transition-all duration-300 hover:shadow-[9px_9px_0_#2D1B17]">
          <header className="flex items-center justify-between border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] text-[#FFFDF9] shadow-[2px_2px_0_#B97861]">
                <CalendarClock size={16} />
              </span>
              <div>
                <h2 className="text-base font-black text-[#2D1B17]">ใกล้หมดอายุใน Freezer</h2>
                <p className="text-[10px] font-bold text-[#75584E]">ล็อตแช่แข็งที่ต้องรีบใช้ก่อนหมดอายุ</p>
              </div>
            </div>
            <span className="rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-xs font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">
              {expiryAlerts.length} ล็อต
            </span>
          </header>

          <div className="p-5">
            {expiryAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-[#2D1B17] bg-[#FFF8EF] py-8 text-center shadow-[3px_3px_0_#2D1B17]">
                <CheckCircle2 size={36} className="mb-2 text-[#2D1B17]" />
                <p className="text-base font-black text-[#2D1B17]">ยังไม่มีล็อตใกล้หมดอายุ</p>
                <p className="mt-1 text-xs font-bold text-[#75584E]">ทุกล็อตใน Freezer ยังมีความสดสมบูรณ์</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {expiryAlerts.map((alert, index) => (
                  <div
                    key={alert.lotId}
                    className="anim-right flex flex-col gap-3 rounded-2xl border-2 border-[#2D1B17] bg-white p-4 shadow-[3px_3px_0_#2D1B17] transition-all duration-200 hover:-translate-y-1 hover:bg-[#FFF8EF] hover:shadow-[5px_5px_0_#2D1B17] sm:flex-row sm:items-center sm:justify-between"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg border-2 border-[#2D1B17] px-2 py-0.5 text-[9px] font-black uppercase shadow-[1px_1px_0_#2D1B17] ${
                            alert.severity === 'critical'
                              ? 'bg-[#2D1B17] text-white'
                              : 'bg-[#E8D8CA] text-[#2D1B17]'
                          }`}
                        >
                          {alert.severity === 'critical' ? 'หมดอายุวันนี้/พรุ่งนี้' : `เหลือ ${alert.daysLeft} วัน`}
                        </span>
                        <h3 className="truncate text-base font-black text-[#2D1B17]">
                          {alert.ingredientName}{' '}
                          <span className="font-mono text-xs font-bold text-[#75584E]">#{alert.lotId}</span>
                        </h3>
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#75584E]">
                        คงเหลือ{' '}
                        <span className="text-sm font-black text-[#2D1B17]">
                          {alert.quantityKg.toFixed(1)} kg
                        </span>{' '}
                        · หมดอายุ{' '}
                        <span className="font-black text-[#2D1B17]">
                          {new Date(alert.expiryDate).toLocaleDateString('th-TH')}
                        </span>
                      </p>
                    </div>

                    <Link
                      to="/owner/freezer-stock"
                      className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0_#B97861] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#3E2621] hover:shadow-[4px_4px_0_#B97861] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#B97861]"
                    >
                      ดู Freezer →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Best-selling ingredients ─── */}
      <section className="anim-up d-4 mb-7 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[7px_7px_0_#2D1B17] transition-all duration-300 hover:shadow-[9px_9px_0_#2D1B17]">
        <header className="border-b-2 border-[#2D1B17] bg-[#E8D8CA] px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] text-[#FFFDF9] shadow-[1.5px_1.5px_0_#B97861]">
                  <TrendingUp size={16} />
                </span>
                <h2 className="text-lg font-black text-[#2D1B17]">วัตถุดิบขายดี</h2>
              </div>
              <p className="mt-1 text-xs font-bold text-[#6D5147]">
                จัดอันดับจากยอดใช้ในออเดอร์ที่ยืนยันแล้ว โดยหักรายการคืนออก
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {salesPeriodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (option.value !== salesPeriod) setSalesData(null)
                    setSalesPeriod(option.value)
                  }}
                  className={`rounded-xl border-2 border-[#2D1B17] px-3.5 py-2 text-xs font-black transition-all ${
                    salesPeriod === option.value
                      ? 'bg-[#2D1B17] text-white shadow-[3px_3px_0_#B97861]'
                      : 'bg-white text-[#2D1B17] hover:bg-[#FFF8EF]'
                  }`}
                  aria-pressed={salesPeriod === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#2D1B17] bg-white px-4 py-3 shadow-[3px_3px_0_#2D1B17]">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#75584E]">
                ยอดรวม {selectedPeriod.label}
              </p>
              <p className="mt-0.5 text-2xl font-black text-[#2D1B17]">
                {totalNetPlates.toLocaleString('th-TH')}
                <span className="ml-1.5 text-xs text-[#75584E]">ถาด</span>
              </p>
            </div>
            <span className="rounded-full border-2 border-[#2D1B17] bg-[#F1E2CF] px-3 py-1 text-[10px] font-black text-[#2D1B17]">
              อัปเดตทุก 15 วินาที
            </span>
          </div>
        </header>

        <div className="divide-y-2 divide-[#2D1B17]/10">
          {loadingAlerts && !salesData ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <RefreshCw size={28} className="animate-spin text-[#B97861]" />
              <p className="mt-3 text-sm font-black text-[#2D1B17]">กำลังสรุปยอดขาย...</p>
            </div>
          ) : !salesData?.ingredients.length ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <TrendingUp size={36} className="text-[#B97861]" />
              <p className="mt-3 text-base font-black text-[#2D1B17]">ยังไม่มียอดขายในช่วงนี้</p>
              <p className="mt-1 text-xs font-bold text-[#75584E]">ข้อมูลจะแสดงเมื่อมีการยืนยันออเดอร์</p>
            </div>
          ) : (
            salesData.ingredients.map((ingredient, index) => {
              const plateCount = Math.max(0, Number(ingredient.netPlates))
              const percentage = Math.max(8, (plateCount / maxIngredientPlates) * 100)

              return (
                <div
                  key={ingredient.id}
                  className="group flex items-center gap-4 px-6 py-4 transition-all duration-200 hover:bg-[#FFF8EF] hover:pl-8"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black shadow-[2px_2px_0_#2D1B17] transition-transform group-hover:scale-110 ${
                    index === 0
                      ? 'rotate-[-3deg] bg-[#B97861] text-white'
                      : index === 1
                        ? 'rotate-[-2deg] bg-[#DBC8B8] text-[#2D1B17]'
                        : 'bg-[#F1E2CF] text-[#2D1B17]'
                  }`}>
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-[#2D1B17]">{ingredient.name}</p>
                        <span className="mt-1 inline-flex rounded-full border border-[#2D1B17]/30 bg-white px-2 py-0.5 text-[9px] font-black text-[#75584E]">
                          {ingredient.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'}
                        </span>
                      </div>
                      <p className="shrink-0 text-xl font-black text-[#2D1B17]">
                        {plateCount.toLocaleString('th-TH')}
                        <span className="ml-1 text-[10px] text-[#75584E]">ถาด</span>
                      </p>
                    </div>

                    <div className="mt-2.5 h-3 overflow-hidden rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA]">
                      <div
                        className="h-full rounded-full bg-[#93AF54] transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ─── Detail Breakdown: Kitchen Freshness & Expired Quarantines ─── */}
      <section className="anim-up d-5 grid gap-6 lg:grid-cols-2">
        {/* Freshness alerts */}
        <div className="rounded-[26px] border-2 border-[#2D1B17] bg-[#E8D8CA] p-6 shadow-[6px_6px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0_#2D1B17]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] text-[#FFFDF9] shadow-[1.5px_1.5px_0_#B97861]">
              <Sparkles size={14} />
            </span>
            <h2 className="text-base font-black text-[#2D1B17]">แจ้งเตือนความสดในครัว</h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {expiring.length === 0 ? (
              <p className="rounded-xl border-2 border-[#2D1B17]/20 bg-white px-4 py-3 text-xs font-bold text-[#75584E]">
                ไม่มีล็อตที่ใกล้หมดอายุภายใน 3 วัน
              </p>
            ) : (
              expiring.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 shadow-[2px_2px_0_#2D1B17] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2D1B17]"
                >
                  <p className="text-xs font-black text-[#2D1B17]">
                    <b>{batch.item}</b> · <span className="font-mono text-[#75584E]">{batch.batch}</span>
                  </p>
                  <span className="rounded-md border-2 border-[#2D1B17] bg-[#F1E2CF] px-2 py-0.5 text-[10px] font-black text-[#2D1B17]">
                    หมดอายุ {batch.expireDate}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expired Quarantines */}
        <div className="rounded-[26px] border-2 border-[#2D1B17] bg-[#DBC8B8] p-6 shadow-[6px_6px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0_#2D1B17]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] text-white shadow-[1.5px_1.5px_0_#B97861]">
              <ShieldAlert size={14} />
            </span>
            <h2 className="text-base font-black text-[#2D1B17]">ล็อตที่ต้องแยกออก (ของเสีย)</h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {expired.length === 0 ? (
              <p className="rounded-xl border-2 border-[#2D1B17]/20 bg-white px-4 py-3 text-xs font-bold text-[#75584E]">
                ไม่มีล็อตหมดอายุตกค้างในระบบ
              </p>
            ) : (
              expired.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 shadow-[2px_2px_0_#2D1B17] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2D1B17]"
                >
                  <p className="text-xs font-black text-[#2D1B17]">
                    <b>{batch.item}</b> · <span className="font-mono text-[#75584E]">{batch.batch}</span>
                  </p>
                  <span className="rounded-md border-2 border-[#2D1B17] bg-[#2D1B17] px-2 py-0.5 text-[10px] font-black text-white shadow-[1px_1px_0_#B97861]">
                    หมดอายุแล้ว {batch.expireDate}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {lastChecked && (
        <p className="mt-6 text-right text-[11px] font-bold text-[#75584E]">
          ตรวจสอบข้อมูลล่าสุด {lastChecked.toLocaleTimeString('th-TH')}
        </p>
      )}
    </div>
  )
}
