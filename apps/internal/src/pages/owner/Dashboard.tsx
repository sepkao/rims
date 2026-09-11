import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  History,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useInventory } from '../../contexts/InventoryContext'
import { formatInventoryQuantity } from '../../lib/format-quantity'
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
    fifoQueue,
    loading: inventoryLoading,
    refresh: refreshInventory,
  } = useInventory()

  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [errorAlerts, setErrorAlerts] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const inStock = inventoryBatches.filter((batch) => Number.parseFloat(batch.qty) > 0)
  const expiring = inStock.filter((batch) => batch.status === 'Expiring Soon')
  const expired = inStock.filter((batch) => batch.status === 'Expired')
  const usable = inStock.filter((batch) => batch.status !== 'Expired')

  const refreshAlerts = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingAlerts(true)
    try {
      const [expiry, lowStock] = await Promise.all([
        apiFetch<{ alerts: ExpiryAlert[] }>('/owner/expiry-alerts'),
        apiFetch<{ alerts: LowStockAlert[] }>('/owner/low-stock-alerts'),
      ])
      setExpiryAlerts(expiry.alerts || [])
      setLowStockAlerts(lowStock.alerts || [])
      setLastChecked(new Date())
      setErrorAlerts('')
    } catch (caught) {
      setErrorAlerts(caught instanceof Error ? caught.message : 'โหลดการแจ้งเตือนไม่สำเร็จ')
    } finally {
      if (!quiet) setLoadingAlerts(false)
    }
  }, [])

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

  return (
    <div className="w-full max-w-[1240px]">
      {/* ─── Header Hero Banner ─── */}
      <header className="anim-down d-1 group relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17] transition-all duration-300 hover:shadow-[11px_11px_0_#2D1B17]">
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
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-xs font-black text-white shadow-[4px_4px_0_#B97861] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#3E2621] hover:shadow-[6px_6px_0_#B97861] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#B97861]"
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

      {/* ─── FIFO Queue Table ─── */}
      <section className="anim-up d-4 mb-7 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[7px_7px_0_#2D1B17] transition-all duration-300 hover:shadow-[9px_9px_0_#2D1B17]">
        <header className="flex flex-col gap-2 border-b-2 border-[#2D1B17] bg-[#E8D8CA] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] text-[#FFFDF9] shadow-[1.5px_1.5px_0_#B97861]">
                <Clock size={14} />
              </span>
              <h2 className="text-lg font-black text-[#2D1B17]">คิวหยิบใช้ตาม FIFO</h2>
            </div>
            <p className="mt-0.5 text-xs font-bold text-[#6D5147]">
              ใช้ล็อตที่รับเข้าก่อนเป็นลำดับแรก (First-In, First-Out) เพื่อลดโอกาสของเสียในครัว
            </p>
          </div>
          <span className="w-fit rounded-full border-2 border-[#2D1B17] bg-[#2D1B17] px-3.5 py-1 text-xs font-black text-white shadow-[2px_2px_0_#B97861]">
            {fifoQueue.length} ล็อตในระบบ
          </span>
        </header>

        <div className="divide-y-2 divide-[#2D1B17]/10">
          {fifoQueue.length === 0 ? (
            <div className="py-12 text-center text-sm font-black text-[#75584E]">
              ไม่มีล็อตวัตถุดิบคงค้างในระบบ
            </div>
          ) : (
            fifoQueue.map((batch, index) => {
              const badgeStyle =
                batch.status === 'Expiring Soon'
                  ? 'bg-[#E7C7B8] text-[#2D1B17]'
                  : batch.status === 'Expired'
                    ? 'bg-[#2D1B17] text-white shadow-[1px_1px_0_#B97861]'
                    : 'bg-white text-[#2D1B17]'

              return (
                <div
                  key={batch.id}
                  className="group flex flex-col gap-3 px-6 py-4 transition-all duration-200 hover:bg-[#FFF8EF] hover:pl-8 sm:flex-row sm:items-center"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#F1E2CF] text-sm font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17] transition-transform duration-200 group-hover:scale-110">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-[#2D1B17]">
                      {batch.item}{' '}
                      <span className="ml-1 rounded-md border border-[#2D1B17]/40 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#75584E]">
                        {batch.batch}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-[#75584E]">
                      รับเข้า {batch.receiveDate} · คงเหลือ{' '}
                      <span className="font-black text-[#2D1B17]">{formatInventoryQuantity(batch.qty)}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <p className="text-xs font-bold text-[#75584E]">
                      หมดอายุ: <span className="font-black text-[#2D1B17]">{batch.expireDate}</span>
                    </p>
                    <span
                      className={`rounded-full border-2 border-[#2D1B17] px-3 py-0.5 text-[10px] font-black shadow-[1.5px_1.5px_0_#2D1B17] transition-transform duration-200 group-hover:scale-105 ${badgeStyle}`}
                    >
                      {batch.status === 'Expiring Soon'
                        ? 'ควรใช้วันนี้'
                        : batch.status === 'Expired'
                          ? 'หมดอายุ'
                          : 'พร้อมใช้'}
                    </span>
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
