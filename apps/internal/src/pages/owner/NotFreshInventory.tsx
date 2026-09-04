import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInventory } from '../../contexts/InventoryContext'
import { apiFetch } from '../../lib/api'

const CATEGORY_OPTIONS = ['All', 'Meat', 'Vegetable', 'Others'] as const

type WasteSummary = {
  month: string
  availableMonths: string[]
  lossValue: number
  itemsForDisposal: number
}

function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
}

// สร้างไฟล์ CSV จากรายการที่กำลังแสดงอยู่ แล้วสั่งดาวน์โหลดผ่านเบราว์เซอร์
function exportToCsv(rows: { item: string; category: string; batch: string; expireDate: string; qty: string; unitValue: number }[]) {
  const header = ['Ingredient Name', 'Category', 'Batch No.', 'Expiry Date', 'Quantity', 'Value']
  const lines = rows.map((row) => [row.item, row.category, row.batch, row.expireDate, row.qty, row.unitValue.toFixed(2)]
    .map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\r\n')

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `expired-goods-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExpiredGoodsPage() {
  const { batches, loading, error, disposeLot } = useInventory()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_OPTIONS[number]>('All')
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)

  // แยกทิ้งได้ 2 ทาง: กดยืนยันตรงนี้ (dispose, บังคับกรอกเหตุผล) หรือปล่อยให้ scan ของหน้า Waste Review
  // เสนอ candidate ไว้ก่อนแล้วมา confirm ที่นี่ก็ได้ — backend จะอัปเดตแถว pending_review เดิม ไม่สร้างซ้ำ (ดู PUT /owner/waste-records/:id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('หมดอายุและไม่ปลอดภัยสำหรับการใช้งาน')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  // Loss Value / Items For Disposal มาจาก waste_records ที่ยืนยันแล้ว (ของเสียจริง) แยกตามเดือน — คนละแหล่งกับตารางด้านล่าง
  // ซึ่งเป็นล็อตที่ยังนั่งอยู่ในคลังตอนนี้ (stock_lots) ที่หมดอายุแล้วแต่ยังไม่ถูกยืนยันเป็นของเสีย
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null)
  const [wasteError, setWasteError] = useState('')
  const [wasteLoading, setWasteLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const loadWasteSummary = useCallback(async (month: string | null) => {
    setWasteLoading(true)
    setWasteError('')
    try {
      const query = month ? `?month=${month}` : ''
      const data = await apiFetch<WasteSummary>(`/owner/waste-records/summary${query}`)
      setWasteSummary(data)
      setSelectedMonth(data.month)
    } catch (caught) {
      setWasteError(caught instanceof Error ? caught.message : 'โหลดสรุปของเสียรายเดือนไม่สำเร็จ')
    } finally {
      setWasteLoading(false)
    }
  }, [])

  useEffect(() => { void loadWasteSummary(selectedMonth) }, [selectedMonth, loadWasteSummary])

  const expired = useMemo(() => batches.filter((batch) => (
    batch.status === 'Expired'
    && Number.parseFloat(batch.qty) > 0
    && (categoryFilter === 'All' || batch.category === categoryFilter)
    && `${batch.item} ${batch.batch}`.toLowerCase().includes(query.toLowerCase())
  )), [batches, categoryFilter, query])
  const expiringSoon = batches.filter((batch) => batch.status === 'Expiring Soon' && Number.parseFloat(batch.qty) > 0).length
  const selected = expired.find((batch) => batch.id === selectedId)

  async function confirmDisposal() {
    if (!selected || !reason.trim()) return
    setSubmitting(true)
    setActionError('')
    try {
      await disposeLot(selected.id, reason.trim())
      setSelectedId(null)
      setReason('หมดอายุและไม่ปลอดภัยสำหรับการใช้งาน')
      await loadWasteSummary(selectedMonth) // ยืนยันของเสียใหม่แล้ว การ์ดสรุปรายเดือนต้องอัปเดตตาม
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'ไม่สามารถบันทึกการแยกทิ้งได้')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="admin-page w-full max-w-[1200px]">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-[26px] font-bold text-[#302221]">Expired Goods Check</h1><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredients..." className="admin-control w-full rounded-md border-none bg-[#F4EFEA] px-4 py-2.5 text-sm sm:w-[320px]" /></div>
    {(error || wasteError || actionError) && <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error || wasteError || actionError}</div>}

    <div className="mb-4 flex items-center justify-between">
      <p className="text-sm font-semibold text-[#7B726B]">Loss Value และ Items For Disposal นับจากของเสียที่ Owner ยืนยันแล้วในเดือนที่เลือก</p>
      {wasteSummary && wasteSummary.availableMonths.length > 0 && (
        <select
          value={wasteSummary.month}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="admin-control rounded-md border border-[#e0dcd5] bg-white px-3 py-2 text-sm font-semibold"
        >
          {wasteSummary.availableMonths.map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}
        </select>
      )}
    </div>

    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <Summary label="Loss Value" value={wasteLoading ? '…' : formatCurrency(wasteSummary?.lossValue ?? 0)} note={wasteSummary ? `ของเสียยืนยันแล้วเดือน ${formatMonthLabel(wasteSummary.month)}` : 'ยังไม่มีของเสียที่ยืนยันแล้ว'} />
      <Summary label="Items For Disposal" value={wasteLoading ? '…' : String(wasteSummary?.itemsForDisposal ?? 0)} note="รายการของเสียที่ยืนยันแล้วในเดือนนี้" />
      <Summary label="Expiring Soon Alerts" value={String(expiringSoon)} note="ล็อตในคลังตอนนี้ที่ใกล้หมดอายุ (ไม่ขึ้นกับเดือนที่เลือก)" />
    </div>

    <div className="admin-surface overflow-hidden rounded-lg bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e8e3dd] bg-[#FDFBF7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 className="text-lg font-bold text-[#302221]">ล็อตหมดอายุที่ยังมีของเหลือ</h2><p className="mt-1 text-xs text-[#7B726B]">ล็อตที่ยอดเป็นศูนย์จะอยู่ใน Inventory history เท่านั้น</p></div>
        <div className="flex gap-3">
          <div className="relative">
            <button onClick={() => setShowCategoryMenu((value) => !value)} className={`admin-control rounded-md border px-4 py-2 text-sm font-semibold ${categoryFilter !== 'All' ? 'border-[#694b49] text-[#4A322F]' : ''}`}>
              {categoryFilter === 'All' ? 'Filter' : `Category: ${categoryFilter}`}
            </button>
            {showCategoryMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-[#e8e3dd] bg-white shadow-lg">
                {CATEGORY_OPTIONS.map((option) => (
                  <button key={option} onClick={() => { setCategoryFilter(option); setShowCategoryMenu(false) }} className={`block w-full px-4 py-2 text-left text-xs font-semibold hover:bg-[#F4EFEA] ${categoryFilter === option ? 'text-[#4A322F]' : 'text-[#777]'}`}>
                    {option === 'All' ? 'ทุกหมวดหมู่' : option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            disabled={expired.length === 0}
            onClick={() => exportToCsv(expired)}
            className="admin-primary rounded-md bg-[#4A322F] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล…</div>
      ) : expired.length === 0 ? (
        <div className="p-12 text-center"><p className="font-bold text-[#302221]">ไม่มีล็อตรอแยกทิ้ง</p><p className="mt-1 text-sm text-[#7B726B]">ล็อตที่ดำเนินการแล้วสามารถตรวจสอบย้อนหลังได้ในประวัติ</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b bg-[#FDFBF7] text-[10px] font-bold uppercase tracking-widest text-[#999]">
                <th className="px-6 py-4">Ingredient Name</th>
                <th className="px-6 py-4">Batch No.</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Value</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expired.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">!</span><div><p className="text-sm font-medium text-[#302221]">{item.item}</p><p className="text-xs text-[#7B726B]">{item.category} · {item.location}</p></div></div></td>
                  <td className="px-6 py-4 font-mono text-xs text-[#7B726B]">{item.batch}</td>
                  <td className="px-6 py-4 text-sm text-[#555]">{item.expireDate}</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-700">{item.qty}</td>
                  <td className="px-6 py-4 text-sm font-bold text-[#302221]">{formatCurrency(item.unitValue)}</td>
                  <td className="px-6 py-4"><button type="button" onClick={() => { setSelectedId(item.id); setActionError('') }} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800">ยืนยันแยกทิ้ง</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-[#e8e3dd] bg-[#FDFBF7] px-6 py-4 text-xs font-medium text-[#7B726B]">รอดำเนินการ {expired.length} รายการ</div>
    </div>

    {selected && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelectedId(null) }}>
        <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border-2 border-[#302221] bg-white p-6 shadow-[7px_7px_0_#302221]">
          <h2 className="text-xl font-black text-[#302221]">ยืนยันแยกทิ้ง {selected.item}</h2>
          <p className="mt-2 text-sm text-[#7B726B]">ระบบจะตัดยอดคงเหลือทั้งหมด {selected.qty} และบันทึกผู้ดำเนินการ เวลา มูลค่าของเสีย และเหตุผล การดำเนินการนี้ย้อนกลับจากหน้านี้ไม่ได้</p>
          <label className="mt-5 block text-sm font-bold text-[#302221]">เหตุผล<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-[#cfc2b8] p-3 font-normal outline-none focus:border-[#8b5e55]" /></label>
          {actionError && <p className="mt-3 text-sm font-bold text-red-700">{actionError}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={submitting} onClick={() => setSelectedId(null)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">ยกเลิก</button>
            <button type="button" disabled={submitting || !reason.trim()} onClick={() => void confirmDisposal()} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'กำลังบันทึก…' : 'แยกทิ้งทั้งหมด'}</button>
          </div>
        </section>
      </div>
    )}
  </div>
}
function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <div className="admin-stat-card flex items-center justify-between rounded-lg bg-white p-6"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#7B726B]">{label}</p><h2 className="text-3xl font-bold text-[#302221]">{value}</h2><p className="mt-1 text-xs text-[#7B726B]">{note}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFEA] text-xl text-[#555]">⌁</div></div> }
function formatCurrency(value: number) { return `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}` }
