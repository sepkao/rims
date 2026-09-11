import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'

type Movement = {
  id: string
  movementType: 'intake' | 'adjustment' | 'deduction' | 'return'
  quantity: number
  createdAt: string
  ingredientName: string
  category: 'Meat' | 'Vegetable'
  location: string
  unit: string
  batch: string
  actorName: string | null
  orderId: string | null
}

const TYPE_OPTIONS: Array<{ value: Movement['movementType'] | 'All'; label: string }> = [
  { value: 'All', label: 'ทั้งหมด' },
  { value: 'intake', label: 'รับเข้า' },
  { value: 'deduction', label: 'ตัดขาย' },
  { value: 'return', label: 'คืนสต็อก' },
  { value: 'adjustment', label: 'ปรับปรุง/ย้าย/ของเสีย' },
]

function typeBadge(type: Movement['movementType']) {
  switch (type) {
    case 'intake': return { label: 'รับเข้า', color: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]' }
    case 'deduction': return { label: 'ตัดขาย', color: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' }
    case 'return': return { label: 'คืนสต็อก', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' }
    case 'adjustment': return { label: 'ปรับปรุง/ย้าย/ของเสีย', color: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]' }
  }
}

export default function StockMovementHistory() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<Movement['movementType'] | 'All'>('All')
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ days: String(days), limit: '300' })
      if (typeFilter !== 'All') params.set('type', typeFilter)
      if (search.trim()) params.set('search', search.trim())
      const data = await apiFetch<{ movements: Movement[] }>(`/owner/stock-movements?${params.toString()}`)
      setMovements(data.movements)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดประวัติการเคลื่อนไหวไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [days, search, typeFilter])

  useEffect(() => { void load() }, [load])

  const intakeCount = useMemo(() => movements.filter((m) => m.movementType === 'intake').length, [movements])
  const deductionCount = useMemo(() => movements.filter((m) => m.movementType === 'deduction').length, [movements])
  const otherCount = movements.length - intakeCount - deductionCount

  return (
    <div className="admin-page max-w-[1200px] w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#302221] mb-1">ประวัติการเคลื่อนไหวสต็อก</h1>
          <p className="text-sm text-[#7B726B]">รับเข้า / ตัดขาย / คืนสต็อก / ปรับปรุงและย้ายของ — เรียงจากล่าสุดไปเก่าสุด</p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => setDays((current) => (current === 7 ? 30 : 7))}
            className={`admin-control flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-semibold shadow-sm transition-colors ${
              days === 7 ? 'border-[#694b49] bg-[#694b49] text-white' : 'border-[#e0dcd5] bg-white text-[#555] hover:bg-gray-50'
            }`}
          >
            {days === 7 ? '7 วันล่าสุด' : '30 วันล่าสุด'}
          </button>
          <input
            type="text"
            placeholder="ค้นหาวัตถุดิบ..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="admin-control w-full sm:w-[240px] px-4 py-2 bg-white border border-[#e0dcd5] rounded-md text-sm outline-none focus:border-[#694b49] transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="admin-stat-card bg-white p-5 rounded-lg border border-[#e8e3dd] shadow-sm">
          <p className="text-xs font-semibold text-[#7B726B] uppercase tracking-wide">รายการทั้งหมด (ช่วงที่เลือก)</p>
          <h2 className="text-2xl font-bold text-[#302221] mt-1">{movements.length.toLocaleString('th-TH')}</h2>
        </div>
        <div className="admin-stat-card bg-[#ecfdf5] p-5 rounded-lg border border-[#a7f3d0] shadow-sm">
          <p className="text-xs font-semibold text-[#065f46] uppercase tracking-wide">รับเข้า</p>
          <h2 className="text-2xl font-bold text-[#065f46] mt-1">{intakeCount.toLocaleString('th-TH')}</h2>
        </div>
        <div className="admin-stat-card bg-[#fef2f2] p-5 rounded-lg border border-[#fecaca] shadow-sm">
          <p className="text-xs font-semibold text-[#991b1b] uppercase tracking-wide">ตัดขาย</p>
          <h2 className="text-2xl font-bold text-[#991b1b] mt-1">{deductionCount.toLocaleString('th-TH')}</h2>
        </div>
      </div>

      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <div className="admin-surface bg-[#FDFBF7] rounded-lg border border-[#e8e3dd] shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto px-6 pt-4 pb-3 border-b border-[#e8e3dd] bg-white">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTypeFilter(option.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                typeFilter === option.value ? 'border-[#4A322F] bg-[#4A322F] text-white' : 'border-[#e0dcd5] text-[#666] hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
          {otherCount > 0 && typeFilter === 'All' && <span className="ml-auto shrink-0 text-[11px] font-semibold text-[#999]">คืนสต็อก/ปรับปรุง {otherCount.toLocaleString('th-TH')} รายการ</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4EFEA] text-[11px] font-bold text-[#7B726B] uppercase tracking-wider border-b border-[#e8e3dd]">
                <th className="px-6 py-4">เวลา</th>
                <th className="px-6 py-4">ประเภท</th>
                <th className="px-6 py-4">วัตถุดิบ</th>
                <th className="px-6 py-4">ล็อต / คลัง</th>
                <th className="px-6 py-4">จำนวน</th>
                <th className="px-6 py-4">ผู้ทำรายการ</th>
                <th className="px-6 py-4">ออเดอร์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e3dd] bg-white">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#777]">กำลังโหลด…</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#777]">ไม่พบรายการเคลื่อนไหวที่ตรงกับตัวกรอง</td></tr>
              ) : movements.map((m) => {
                const badge = typeBadge(m.movementType)
                const positive = m.quantity >= 0
                return (
                  <tr key={m.id} className="hover:bg-[#faf8f5] transition-colors">
                    <td className="px-6 py-4 text-sm text-[#555] whitespace-nowrap">{new Date(m.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${badge.color}`}>{badge.label}</span></td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-[#302221]">{m.ingredientName}</div>
                      <div className="text-[11px] text-[#7B726B] mt-0.5 uppercase tracking-wide">{m.category === 'Meat' ? 'เนื้อสัตว์' : 'ผัก'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#555]">{m.batch} · {m.location}</td>
                    <td className={`px-6 py-4 text-sm font-bold ${positive ? 'text-green-700' : 'text-red-700'}`}>{positive ? '+' : ''}{m.quantity.toLocaleString('th-TH', { minimumFractionDigits: m.unit === 'kg' ? 1 : 0, maximumFractionDigits: 1 })} {m.unit}</td>
                    <td className="px-6 py-4 text-sm text-[#555]">{m.actorName ?? 'ระบบ (อัตโนมัติ)'}</td>
                    <td className="px-6 py-4 text-sm text-[#555]">{m.orderId ? `#${m.orderId}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
