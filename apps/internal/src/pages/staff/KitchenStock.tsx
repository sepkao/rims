import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Layers, List, Package } from 'lucide-react'
import { useInventory } from '../../contexts/InventoryContext'
import { formatInventoryQuantity } from '../../lib/format-quantity'
import type { InventoryBatch } from '../../types/inventory'

const statusLabel: Record<InventoryBatch['status'], string> = {
  Fresh: 'พร้อมใช้',
  'Expiring Soon': 'ใกล้หมดอายุ',
  Expired: 'หมดอายุ',
}

const statusClass: Record<InventoryBatch['status'], string> = {
  Fresh: 'bg-[#E8D8CA]',
  'Expiring Soon': 'bg-[#E7C7B8]',
  Expired: 'bg-[#B97861] text-white',
}

type GroupedStockItem = {
  ingredientId: string
  item: string
  category: InventoryBatch['category']
  totalQty: number
  unit: string
  formattedTotalQty: string
  lotCount: number
  earliestExpireDate: string
  status: InventoryBatch['status']
  lots: (InventoryBatch & { formattedQty: string })[]
}

export default function KitchenStockPage({ area, canTransfer = true }: { area: 'Freezer Stock' | 'Prep Fridge'; canTransfer?: boolean }) {
  const navigate = useNavigate()
  const { batches, loading, error } = useInventory()
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null)
  const [viewMode, setViewMode] = useState<'grouped' | 'batches'>('grouped')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!selectedBatch) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedBatch(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedBatch])

  const items = useMemo(() => batches.filter((batch) => {
    const location = batch.location?.toLowerCase() ?? ''
    const hasUsableStock = batch.status !== 'Expired' && Number.parseFloat(batch.qty) > 0
    const isInArea = area === 'Freezer Stock'
      ? location.includes('freezer')
      : location.includes('prep') || location.includes('thaw') || location.includes('ละลาย')

    return hasUsableStock && isInArea
  }), [area, batches])

  // คำนวณยอดรวมของแต่ละวัตถุดิบ (Grouped View) เพื่อให้ผู้ใช้ไม่ต้องนำล็อตมาบวกเอง
  const groupedItems = useMemo(() => {
    const map = new Map<string, GroupedStockItem>()
    for (const batch of items) {
      const numeric = Number.parseFloat(batch.qty)
      const unit = batch.qty.replace(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*/, '') || (area === 'Freezer Stock' ? 'kg' : 'plates')
      const formattedQty = formatInventoryQuantity(batch.qty)

      const existing = map.get(batch.ingredientId)
      if (existing) {
        existing.totalQty += Number.isFinite(numeric) ? numeric : 0
        existing.lotCount += 1
        existing.lots.push({ ...batch, formattedQty })
        if (batch.expireDate < existing.earliestExpireDate) {
          existing.earliestExpireDate = batch.expireDate
        }
        if (batch.status === 'Expiring Soon') {
          existing.status = 'Expiring Soon'
        }
      } else {
        map.set(batch.ingredientId, {
          ingredientId: batch.ingredientId,
          item: batch.item,
          category: batch.category,
          totalQty: Number.isFinite(numeric) ? numeric : 0,
          unit,
          formattedTotalQty: '',
          lotCount: 1,
          earliestExpireDate: batch.expireDate,
          status: batch.status,
          lots: [{ ...batch, formattedQty }],
        })
      }
    }

    const result = Array.from(map.values())
    for (const group of result) {
      group.formattedTotalQty = formatInventoryQuantity(group.totalQty, group.unit)
    }
    return result
  }, [items, area])

  const visibleGrouped = useMemo(() => {
    return groupedItems.filter((group) => {
      const matchesQuery = group.item.toLowerCase().includes(query.toLowerCase()) ||
        group.lots.some((lot) => lot.batch.toLowerCase().includes(query.toLowerCase()))
      const matchesAttention = !attentionOnly || group.status !== 'Fresh'
      return matchesQuery && matchesAttention
    })
  }, [groupedItems, query, attentionOnly])

  const visible = useMemo(() => items
    .filter((item) => (
      `${item.item} ${item.batch}`.toLowerCase().includes(query.toLowerCase())
      && (!attentionOnly || item.status !== 'Fresh')
    ))
    .map((item) => ({ ...item, qty: formatInventoryQuantity(item.qty) })), [attentionOnly, items, query])

  const toggleExpand = (ingredientId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  const attention = items.filter((item) => item.status !== 'Fresh').length
  const priority = items.find((item) => item.status === 'Expiring Soon') ?? items.find((item) => item.status === 'Fresh')

  return (
    <>
      <div className="w-full max-w-[1240px]">
        <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#DBC8B8] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
          <div className="absolute -right-8 -top-14 h-48 w-48 rounded-full border-[24px] border-white/30" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#F1E2CF] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">{area === 'Freezer Stock' ? 'FREEZER' : 'PREP FRIDGE'}</span>
              <h1 className="mt-4 text-4xl font-black tracking-[-.035em] text-[#2D1B17]">{area === 'Freezer Stock' ? 'คลังแช่แข็ง' : 'ตู้เตรียมครัว'}</h1>
              <p className="mt-2 text-sm font-semibold text-[#7A6057]">เช็กล็อต · สรุปยอดรวมวัตถุดิบ · หยิบแบบ FIFO</p>
            </div>
            <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-3.5 py-3 text-[#7A665F] shadow-[4px_4px_0_#2D1B17]">
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาของ หรือ batch..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
            </label>
          </div>
        </header>

        <section className="anim-down d-2 mb-7 grid gap-5 md:grid-cols-3">
          <Stat label="วัตถุดิบ" value={groupedItems.length} note={`รวมทั้งหมด ${items.length} ล็อต`} color="bg-[#F1E2CF]" sign="✦" />
          <Stat label="ต้องเช็ก" value={attention} note="เสี่ยงหมด / เหลือน้อย" color="bg-[#E7C7B8]" sign="!" />
          <Stat label="พร้อมหยิบ" value={items.length - attention} note="ใช้ได้ตามปกติ" color="bg-[#E8D8CA]" sign="✓" />
        </section>

        {error && <div className="anim-down d-2 mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

        {priority && <section className="anim-up d-3 mb-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
          <article className="flex items-center gap-4 rounded-[22px] border-2 border-[#2D1B17] bg-white p-5 shadow-[5px_5px_0_#2D1B17]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] text-xl font-black text-white shadow-[2px_2px_0_#2D1B17]">1</span>
            <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#8B5746]">Pick me first</p><h2 className="mt-1 text-xl font-black">{priority.item} <span className="font-mono text-xs text-[#987D74]">#{priority.batch}</span></h2><p className="mt-1 text-xs font-semibold text-[#80675F]">เหลือ {formatInventoryQuantity(priority.qty)} · ใช้ภายใน {priority.expireDate}</p></div>
          </article>
          <article className="rounded-[22px] border-2 border-[#2D1B17] bg-[#2D1B17] p-5 text-white shadow-[5px_5px_0_#B97861]"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#D4A996]">Live inventory</p><p className="mt-2 text-sm font-bold leading-6">ข้อมูลล่าสุดจาก API inventory · สรุปยอดรวมและเรียง FIFO อัตโนมัติ</p></article>
        </section>}

        <section className="anim-up d-4 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
          <div className="flex flex-col gap-4 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Stock shelf</h2>
              <p className="mt-1 text-xs font-semibold text-[#8A7067]">
                {viewMode === 'grouped' ? 'แสดงยอดรวมของแต่ละวัตถุดิบ (คลิกแถวเพื่อคลี่ดูล็อตย่อย)' : 'แสดงแยกล็อตทั้งหมดตามลำดับ FIFO'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* สลับโหมดการแสดงผล: รวมตามวัตถุดิบ vs แยกล็อต FIFO */}
              <div className="flex items-center rounded-xl border-2 border-[#2D1B17] bg-[#F4EFEA] p-1 shadow-[2px_2px_0_#2D1B17]">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    viewMode === 'grouped'
                      ? 'bg-[#2D1B17] text-white shadow-xs'
                      : 'text-[#6D5147] hover:bg-[#EAE5DF]'
                  }`}
                  title="รวมยอดสต็อกตามวัตถุดิบทั้งหมด"
                >
                  <Layers size={13} />
                  <span>รวมตามวัตถุดิบ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('batches')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    viewMode === 'batches'
                      ? 'bg-[#2D1B17] text-white shadow-xs'
                      : 'text-[#6D5147] hover:bg-[#EAE5DF]'
                  }`}
                  title="แสดงทุกล็อตแยกตามลำดับ FIFO"
                >
                  <List size={13} />
                  <span>แยกล็อต FIFO</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAttentionOnly((value) => !value)}
                className={`rounded-xl border-2 border-[#2D1B17] px-3.5 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17] transition-all active:translate-y-0.5 ${attentionOnly ? 'bg-[#2D1B17] text-white' : 'bg-[#E7C7B8]'}`}
              >
                {attentionOnly ? 'ดูทั้งหมด' : `ต้องเช็ก ${attention}`}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-14 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล inventory…</div>
          ) : (viewMode === 'grouped' ? visibleGrouped.length === 0 : visible.length === 0) ? (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-black">ยังไม่มีข้อมูลในโซนนี้</p>
              <p className="mt-1 text-xs font-semibold text-[#876E65]">เมื่อมีข้อมูลจาก API จะแสดงรายการที่นี่</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {viewMode === 'grouped' ? (
                /* ── โหมด 1: รวมตามวัตถุดิบ (Grouped View) ── */
                <table className="w-full min-w-[760px] text-left">
                  <thead className="border-b-2 border-[#2D1B17] bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.14em] text-white">
                    <tr>
                      <th className="px-6 py-4">วัตถุดิบ (Ingredient)</th>
                      <th className="px-4 py-4 text-center">จำนวนล็อต</th>
                      <th className="px-4 py-4">คงเหลือรวม (Total On Hand)</th>
                      <th className="px-4 py-4">หมดอายุเร็วสุด</th>
                      <th className="px-6 py-4">สถานะรวม</th>
                      <th className="px-6 py-4 text-right">ดูล็อตย่อย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGrouped.map((group, index) => {
                      const isExpanded = expandedIds.has(group.ingredientId)
                      return (
                        <tr key={group.ingredientId} className="contents">
                          <tr
                            onClick={() => toggleExpand(group.ingredientId)}
                            className="cursor-pointer border-b-2 border-[#2D1B17]/10 transition hover:bg-[#FFF8EF]"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black transition ${['bg-[#B97861] text-white', 'bg-[#DBC8B8]', 'bg-[#E8D8CA]', 'bg-[#D9B99A]'][index % 4]}`}>
                                  {group.item.charAt(0)}
                                </span>
                                <div>
                                  <span className="block text-sm font-black text-[#2D1B17]">{group.item}</span>
                                  <span className="mt-0.5 block text-[10px] font-bold text-[#92776E]">{group.category}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#2D1B17]/30 bg-[#F4EFEA] px-2.5 py-1 text-xs font-black text-[#63382E]">
                                <Package size={11} />
                                {group.lotCount} ล็อต
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-block rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-base font-black text-[#2D1B17] shadow-[2px_2px_0_#D9B99A]">
                                {group.formattedTotalQty}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-bold text-[#6D5147]">
                              {group.earliestExpireDate}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full border-2 border-[#2D1B17] px-2.5 py-1 text-[10px] font-black ${statusClass[group.status]}`}>
                                {statusLabel[group.status]}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-[#D9B99A] bg-white px-2.5 py-1 text-xs font-black text-[#6D5147] transition hover:bg-[#F4EFEA]"
                              >
                                <span>{isExpanded ? 'ย่อ' : 'คลี่ดู'}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </td>
                          </tr>

                          {/* คลี่แสดงรายละเอียดย่อยของทุกล็อตภายใต้วัตถุดิบนี้ */}
                          {isExpanded && (
                            <tr className="bg-[#FAF6F0] border-b-2 border-[#2D1B17]/20">
                              <td colSpan={6} className="px-6 py-3">
                                <div className="rounded-xl border-2 border-[#2D1B17] bg-white p-3.5 shadow-[3px_3px_0_#2D1B17]">
                                  <div className="mb-2 flex items-center justify-between border-b border-[#EAE5DF] pb-2">
                                    <span className="flex items-center gap-1.5 text-xs font-black text-[#573D35]">
                                      <Layers size={13} className="text-[#B97861]" />
                                      ทุกล็อตของ {group.item} (เรียงตามลำดับ FIFO หมดอายุก่อน-หลัง)
                                    </span>
                                    <span className="text-[10px] font-bold text-[#80675F]">คลิกแถวเพื่อดูรายละเอียดเจาะลึก</span>
                                  </div>
                                  <div className="divide-y divide-[#F4EFEA]">
                                    {group.lots.map((lot, lotIdx) => (
                                      <div
                                        key={lot.id}
                                        onClick={(e) => { e.stopPropagation(); setSelectedBatch(lot) }}
                                        className="flex flex-wrap items-center justify-between gap-2 py-2 px-2 transition hover:bg-[#FFF8EF] rounded-lg cursor-pointer text-xs"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="grid h-5 w-5 place-items-center rounded bg-[#F4EFEA] text-[10px] font-black text-[#5A403E] border border-[#EAE5DF]">
                                            {lotIdx + 1}
                                          </span>
                                          <span className="font-mono font-black text-[#2D1B17]">#{lot.batch}</span>
                                          <span className="text-[#80675F]">รับเข้า: {lot.receiveDate}</span>
                                          {lot.supplierReference && <span className="text-[10px] text-[#A68F86] font-semibold">(Ref: {lot.supplierReference})</span>}
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="font-black text-[#2D1B17] text-sm">{lot.formattedQty}</span>
                                          <span className="text-[#6D5147] text-xs font-bold">หมดอายุ: {lot.expireDate}</span>
                                          <span className={`inline-flex rounded-full border border-[#2D1B17] px-2 py-0.5 text-[9px] font-black ${statusClass[lot.status]}`}>
                                            {statusLabel[lot.status]}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                /* ── โหมด 2: แยกล็อตเดี่ยวตามลำดับ FIFO (By Batch View) ── */
                <table className="w-full min-w-[720px] text-left">
                  <thead className="border-b-2 border-[#2D1B17] bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.14em] text-white">
                    <tr>
                      <th className="px-6 py-4">Ingredient</th>
                      <th className="px-4 py-4">Batch</th>
                      <th className="px-4 py-4">On hand</th>
                      <th className="px-4 py-4">Use by</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, index) => (
                      <tr key={item.id} onClick={() => setSelectedBatch(item)} className="cursor-pointer border-b-2 border-[#2D1B17]/10 transition hover:bg-[#FFF8EF]">
                        <td className="px-6 py-4">
                          <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedBatch(item) }} className="group flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B97861] focus-visible:ring-offset-2">
                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black transition group-hover:-translate-y-0.5 ${['bg-[#B97861] text-white', 'bg-[#DBC8B8]', 'bg-[#E8D8CA]', 'bg-[#D9B99A]'][index % 4]}`}>
                              {item.item.charAt(0)}
                            </span>
                            <span>
                              <span className="block text-sm font-black">{item.item}</span>
                              <span className="mt-0.5 block text-[10px] font-bold text-[#92776E]">{item.category}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-bold">#{item.batch}</td>
                        <td className="px-4 py-4 text-sm font-black">{item.qty}</td>
                        <td className="px-4 py-4 text-xs font-bold">{item.expireDate}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full border-2 border-[#2D1B17] px-2.5 py-1 text-[10px] font-black ${statusClass[item.status]}`}>
                            {statusLabel[item.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <footer className="flex justify-between border-t-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em]">
            <span>
              {loading
                ? 'Loading'
                : viewMode === 'grouped'
                  ? `แสดง ${visibleGrouped.length}/${groupedItems.length} วัตถุดิบ (รวม ${items.length} ล็อต)`
                  : `แสดง ${visible.length}/${items.length} รายการ`}
            </span>
            <span>{viewMode === 'grouped' ? 'SUMMARIZED TOTALS ✦' : 'FIFO SORTED ✦'}</span>
          </footer>
        </section>
      </div>

      {selectedBatch && (
        <InventoryDetailsDialog
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onTransfer={canTransfer ? () => { setSelectedBatch(null); navigate('/staff/transfer-to-thaw-prep') } : undefined}
        />
      )}
    </>
  )
}

function InventoryDetailsDialog({ batch, onClose, onTransfer }: { batch: InventoryBatch; onClose: () => void; onTransfer?: () => void }) {
  const unitValue = batch.unitValue > 0
    ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(batch.unitValue)
    : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1B17]/70 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[8px_8px_0_#2D1B17]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5">
          <div><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#8B5746]">Inventory detail</span><h2 id="inventory-detail-title" className="mt-1 text-2xl font-black text-[#2D1B17]">{batch.item}</h2><p className="mt-1 font-mono text-xs font-bold text-[#75584E]">ล็อต #{batch.batch}</p></div>
          <button type="button" aria-label="ปิดรายละเอียด" onClick={onClose} className="rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-xl font-black leading-none shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5">×</button>
        </header>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Detail label="หมวดวัตถุดิบ" value={batch.category} />
          <Detail label="สถานะ" value={statusLabel[batch.status]} valueClass={statusClass[batch.status]} />
          <Detail label="จำนวนคงเหลือ" value={formatInventoryQuantity(batch.qty)} />
          <Detail label="พื้นที่จัดเก็บ" value={batch.location || 'ยังไม่ระบุ'} />
          <Detail label="วันที่รับเข้า" value={batch.receiveDate} />
          <Detail label="เลขใบส่งของ" value={batch.supplierReference || '—'} />
          <Detail label="วันหมดอายุ" value={batch.expireDate} />
          <Detail label="ต้นทุนต่อหน่วย" value={unitValue} />
          <Detail label="รหัสรายการ" value={batch.id} />
        </div>
        <div className="mx-6 rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-4 py-3 text-xs font-bold leading-5 text-[#60483F]">ตรวจสอบล็อตนี้ก่อนหยิบใช้ หากต้องเตรียมวัตถุดิบต่อ ให้ไปที่หน้าการโอนย้ายเพื่อดำเนินการ</div>
        <footer className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black">ปิด</button>
          {onTransfer && <button type="button" onClick={onTransfer} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition hover:-translate-y-0.5">ไปหน้าโอนย้าย →</button>}
        </footer>
      </section>
    </div>
  )
}

function Detail({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return <div className="rounded-2xl border-2 border-[#2D1B17]/15 bg-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#8A7067]">{label}</p><p className={`mt-1 text-sm font-black text-[#2D1B17] ${valueClass}`}>{value}</p></div>
}

function Stat({ label, value, note, color, sign }: { label: string; value: number; note: string; color: string; sign: string }) {
  return <article className={`relative overflow-hidden rounded-[22px] border-2 border-[#2D1B17] p-5 shadow-[5px_5px_0_#2D1B17] ${color}`}><span className="absolute right-4 top-2 text-4xl font-black opacity-20">{sign}</span><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#775B51]">{label}</p><p className="mt-2 text-4xl font-black">{String(value).padStart(2, '0')}</p><p className="mt-1 text-xs font-bold text-[#765F56]">{note}</p></article>
}

function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg> }
