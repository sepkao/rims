import { useMemo, useState } from 'react'
import { useInventory } from '../../contexts/InventoryContext'

export default function StaffPrepFridgePage() {
  const { batches, loading, error } = useInventory()
  const [query, setQuery] = useState('')
  const prepItems = useMemo(() => batches.filter((batch) => {
    const location = batch.location?.toLowerCase() ?? ''
    return location.includes('prep') || location.includes('thaw') || location.includes('ละลาย')
  }).filter((batch) => `${batch.item} ${batch.batch}`.toLowerCase().includes(query.toLowerCase())), [batches, query])
  const attention = prepItems.filter((batch) => batch.status !== 'Fresh').length

  return <div className="w-full max-w-[1240px] bg-[#FDFBF7] pb-20">
    <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-[#EAE5DF] bg-[#FDFBF7]"><h1 className="text-2xl font-medium text-[#302221]">Prep Fridge Monitor</h1><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory..." className="w-[260px] rounded-full bg-[#F4EFEA] px-4 py-2 text-sm outline-none" /></header>
    <div className="py-8">
      {error && <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      <div className="mb-8 grid gap-6 lg:grid-cols-[3fr_2fr]"><div className="rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm"><p className="text-[10px] font-mono uppercase tracking-wider text-[#999]">Inventory API</p><h2 className="mt-1 text-xl font-medium text-[#302221]">Ingredient Status</h2><div className="mt-6 flex gap-4"><Metric label="รายการทั้งหมด" value={prepItems.length} /><Metric label="ต้องตรวจสอบ" value={attention} /></div></div><div className="rounded-xl border border-[#EAE5DF] bg-[#FCE8E8] p-6 shadow-sm"><h2 className="text-xl font-medium text-[#C53030]">Critical Stock Alert</h2><p className="mt-2 text-sm leading-relaxed text-[#C53030]">การแจ้งเตือนจะแสดงเมื่อ API ส่งข้อมูลวัตถุดิบที่ต่ำกว่า threshold</p></div></div>
      <div className="mb-6 flex items-end justify-between border-b border-[#302221] pb-3"><div><h2 className="text-xl font-medium text-[#302221]">Prep Trays</h2><p className="text-xs text-[#7B726B]">ข้อมูลจาก inventory API</p></div></div>
      {loading ? <div className="rounded-xl border border-[#EAE5DF] bg-white p-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล…</div> : prepItems.length === 0 ? <div className="rounded-xl border border-dashed border-[#CFC4BA] bg-white p-10 text-center"><p className="font-bold text-[#302221]">ยังไม่มีข้อมูลตู้เตรียมครัว</p><p className="mt-1 text-sm text-[#7B726B]">เมื่อเชื่อมต่อข้อมูลจริง รายการจะปรากฏที่หน้านี้</p></div> : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{prepItems.map((item) => <article key={item.id} className="rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div className="flex h-16 w-16 items-center justify-center rounded bg-[#F4EFEA] text-2xl font-black text-[#5A403E]">{item.item.charAt(0)}</div><span className="rounded bg-[#EAE5DF] px-2 py-1 text-[10px] font-mono font-bold uppercase">{item.status}</span></div><h3 className="mt-5 text-lg font-medium text-[#302221]">{item.item}</h3><p className="mt-1 text-xs text-[#7B726B]">Batch {item.batch}</p><div className="mt-4 flex justify-between text-sm"><span className="font-bold">คงเหลือ</span><span>{item.qty}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAE5DF]"><div className="h-full bg-[#5A403E]" style={{ width: item.status === 'Expired' ? '8%' : item.status === 'Expiring Soon' ? '35%' : '70%' }} /></div></article>)}</div>}
    </div>
  </div>
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="flex-1 rounded-lg bg-[#F4EFEA] p-4"><p className="text-[11px] font-bold text-[#7B726B]">{label}</p><p className="text-3xl font-medium text-[#302221]">{value}</p></div> }
