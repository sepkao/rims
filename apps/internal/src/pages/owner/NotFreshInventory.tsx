import { useMemo, useState } from 'react'
import { useInventory } from '../../contexts/InventoryContext'

export default function ExpiredGoodsPage() {
  const { batches, loading, error, disposeLot } = useInventory()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('หมดอายุและไม่ปลอดภัยสำหรับการใช้งาน')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const expired = useMemo(() => batches.filter((batch) => batch.status === 'Expired' && Number.parseFloat(batch.qty) > 0 && `${batch.item} ${batch.batch}`.toLowerCase().includes(query.toLowerCase())), [batches, query])
  const expiringSoon = batches.filter((batch) => batch.status === 'Expiring Soon' && Number.parseFloat(batch.qty) > 0).length
  const lostValue = expired.reduce((total, batch) => total + batch.unitValue, 0)
  const selected = expired.find((batch) => batch.id === selectedId)

  async function confirmDisposal() {
    if (!selected || !reason.trim()) return
    setSubmitting(true)
    setActionError('')
    try {
      await disposeLot(selected.id, reason.trim())
      setSelectedId(null)
      setReason('หมดอายุและไม่ปลอดภัยสำหรับการใช้งาน')
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'ไม่สามารถบันทึกการแยกทิ้งได้')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="admin-page w-full max-w-[1200px]">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-[26px] font-bold text-[#302221]">Expired Goods Check</h1><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredients..." className="admin-control w-full rounded-md border-none bg-[#F4EFEA] px-4 py-2.5 text-sm sm:w-[320px]" /></div>
    {(error || actionError) && <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error || actionError}</div>}
    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3"><Summary label="Loss Value" value={formatCurrency(lostValue)} note="จากล็อตที่หมดอายุในระบบ" /><Summary label="Items For Disposal" value={String(expired.length)} note="ล็อตที่ต้องตรวจสอบ" /><Summary label="Expiring Soon Alerts" value={String(expiringSoon)} note="ล็อตที่ API แจ้งเตือน" /></div>
    <div className="admin-surface overflow-hidden rounded-lg bg-white"><div className="flex flex-col gap-3 border-b border-[#e8e3dd] bg-[#FDFBF7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="text-lg font-bold text-[#302221]">ล็อตหมดอายุที่ยังมีของเหลือ</h2><p className="mt-1 text-xs text-[#7B726B]">ล็อตที่ยอดเป็นศูนย์จะอยู่ใน Inventory history เท่านั้น</p></div></div>{loading ? <div className="p-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล…</div> : expired.length === 0 ? <div className="p-12 text-center"><p className="font-bold text-[#302221]">ไม่มีล็อตรอแยกทิ้ง</p><p className="mt-1 text-sm text-[#7B726B]">ล็อตที่ดำเนินการแล้วสามารถตรวจสอบย้อนหลังได้ในประวัติ</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead><tr className="border-b bg-[#FDFBF7] text-[10px] font-bold uppercase tracking-widest text-[#999]"><th className="px-6 py-4">Ingredient Name</th><th className="px-6 py-4">Batch No.</th><th className="px-6 py-4">Expiry Date</th><th className="px-6 py-4">Quantity</th><th className="px-6 py-4">Value</th><th className="px-6 py-4">Action</th></tr></thead><tbody className="divide-y">{expired.map((item) => <tr key={item.id}><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">!</span><div><p className="text-sm font-medium text-[#302221]">{item.item}</p><p className="text-xs text-[#7B726B]">{item.category} · {item.location}</p></div></div></td><td className="px-6 py-4 font-mono text-xs text-[#7B726B]">{item.batch}</td><td className="px-6 py-4 text-sm text-[#555]">{item.expireDate}</td><td className="px-6 py-4 text-sm font-bold text-red-700">{item.qty}</td><td className="px-6 py-4 text-sm font-bold text-[#302221]">{formatCurrency(item.unitValue)}</td><td className="px-6 py-4"><button type="button" onClick={() => { setSelectedId(item.id); setActionError('') }} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800">ยืนยันแยกทิ้ง</button></td></tr>)}</tbody></table></div>}<div className="border-t border-[#e8e3dd] bg-[#FDFBF7] px-6 py-4 text-xs font-medium text-[#7B726B]">รอดำเนินการ {expired.length} รายการ</div></div>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelectedId(null) }}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border-2 border-[#302221] bg-white p-6 shadow-[7px_7px_0_#302221]"><h2 className="text-xl font-black text-[#302221]">ยืนยันแยกทิ้ง {selected.item}</h2><p className="mt-2 text-sm text-[#7B726B]">ระบบจะตัดยอดคงเหลือทั้งหมด {selected.qty} และบันทึกผู้ดำเนินการ เวลา มูลค่าของเสีย และเหตุผล การดำเนินการนี้ย้อนกลับจากหน้านี้ไม่ได้</p><label className="mt-5 block text-sm font-bold text-[#302221]">เหตุผล<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-[#cfc2b8] p-3 font-normal outline-none focus:border-[#8b5e55]" /></label>{actionError && <p className="mt-3 text-sm font-bold text-red-700">{actionError}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setSelectedId(null)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">ยกเลิก</button><button type="button" disabled={submitting || !reason.trim()} onClick={() => void confirmDisposal()} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'กำลังบันทึก…' : 'แยกทิ้งทั้งหมด'}</button></div></section></div>}
  </div>
}
function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <div className="admin-stat-card flex items-center justify-between rounded-lg bg-white p-6"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#7B726B]">{label}</p><h2 className="text-3xl font-bold text-[#302221]">{value}</h2><p className="mt-1 text-xs text-[#7B726B]">{note}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFEA] text-xl text-[#555]">⌁</div></div> }
function formatCurrency(value: number) { return `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}` }
