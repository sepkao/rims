import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../../contexts/InventoryContext'
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

export default function KitchenStockPage({ area }: { area: 'Freezer Stock' | 'Prep Fridge' }) {
  const navigate = useNavigate()
  const { batches, loading, error } = useInventory()
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null)

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
    return area === 'Freezer Stock'
      ? location.includes('freezer')
      : location.includes('prep') || location.includes('thaw') || location.includes('ละลาย')
  }), [area, batches])

  const visible = useMemo(() => items.filter((item) => (
    `${item.item} ${item.batch}`.toLowerCase().includes(query.toLowerCase())
    && (!attentionOnly || item.status !== 'Fresh')
  )), [attentionOnly, items, query])

  const attention = items.filter((item) => item.status !== 'Fresh').length
  const priority = items.find((item) => item.status === 'Expiring Soon') ?? items.find((item) => item.status === 'Fresh')

  return (
    <>
      <div className="w-full max-w-[1240px]">
        <header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#DBC8B8] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
          <div className="absolute -right-8 -top-14 h-48 w-48 rounded-full border-[24px] border-white/30" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#F1E2CF] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">{area === 'Freezer Stock' ? 'FREEZER' : 'PREP FRIDGE'}</span>
              <h1 className="mt-4 text-4xl font-black tracking-[-.035em] text-[#2D1B17]">{area === 'Freezer Stock' ? 'คลังแช่แข็ง' : 'ตู้เตรียมครัว'}</h1>
              <p className="mt-2 text-sm font-semibold text-[#7A6057]">เช็กล็อต · ดูวันหมดอายุ · หยิบแบบ FIFO</p>
            </div>
            <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-3.5 py-3 text-[#7A665F] shadow-[4px_4px_0_#2D1B17]">
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาของ หรือ batch..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
            </label>
          </div>
        </header>

        <section className="mb-7 grid gap-5 md:grid-cols-3">
          <Stat label="ทั้งหมด" value={items.length} note="รายการในโซนนี้" color="bg-[#F1E2CF]" sign="✦" />
          <Stat label="ต้องเช็ก" value={attention} note="เสี่ยงหมด / เหลือน้อย" color="bg-[#E7C7B8]" sign="!" />
          <Stat label="พร้อมหยิบ" value={items.length - attention} note="ใช้ได้ตามปกติ" color="bg-[#E8D8CA]" sign="✓" />
        </section>

        {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

        {priority && <section className="mb-7 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
          <article className="flex items-center gap-4 rounded-[22px] border-2 border-[#2D1B17] bg-white p-5 shadow-[5px_5px_0_#2D1B17]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] text-xl font-black text-white shadow-[2px_2px_0_#2D1B17]">1</span>
            <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#8B5746]">Pick me first</p><h2 className="mt-1 text-xl font-black">{priority.item} <span className="font-mono text-xs text-[#987D74]">#{priority.batch}</span></h2><p className="mt-1 text-xs font-semibold text-[#80675F]">เหลือ {priority.qty} · ใช้ภายใน {priority.expireDate}</p></div>
          </article>
          <article className="rounded-[22px] border-2 border-[#2D1B17] bg-[#2D1B17] p-5 text-white shadow-[5px_5px_0_#B97861]"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#D4A996]">Data source</p><p className="mt-2 text-sm font-bold leading-6">ข้อมูลจะแสดงเมื่อเชื่อมต่อ API inventory แล้ว</p></article>
        </section>}

        <section className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
          <div className="flex flex-col gap-4 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Stock shelf</h2><p className="mt-1 text-xs font-semibold text-[#8A7067]">คลิกแถววัตถุดิบเพื่อดูรายละเอียดและจัดการ</p></div><button onClick={() => setAttentionOnly((value) => !value)} className={`rounded-xl border-2 border-[#2D1B17] px-3.5 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17] ${attentionOnly ? 'bg-[#2D1B17] text-white' : 'bg-[#E7C7B8]'}`}>{attentionOnly ? 'ดูทั้งหมด' : `ต้องเช็ก ${attention}`}</button></div>
          {loading ? <div className="px-6 py-14 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล inventory…</div> : visible.length === 0 ? <div className="px-6 py-14 text-center"><p className="text-lg font-black">ยังไม่มีข้อมูลในโซนนี้</p><p className="mt-1 text-xs font-semibold text-[#876E65]">เมื่อมีข้อมูลจาก API จะแสดงรายการที่นี่</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b-2 border-[#2D1B17] bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.14em] text-white"><tr><th className="px-6 py-4">Ingredient</th><th className="px-4 py-4">Batch</th><th className="px-4 py-4">On hand</th><th className="px-4 py-4">Use by</th><th className="px-6 py-4">Status</th></tr></thead><tbody>{visible.map((item, index) => <tr key={item.id} onClick={() => setSelectedBatch(item)} className="cursor-pointer border-b-2 border-[#2D1B17]/10 transition hover:bg-[#FFF8EF]"><td className="px-6 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedBatch(item) }} className="group flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B97861] focus-visible:ring-offset-2"><span className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black transition group-hover:-translate-y-0.5 ${['bg-[#B97861] text-white', 'bg-[#DBC8B8]', 'bg-[#E8D8CA]', 'bg-[#D9B99A]'][index % 4]}`}>{item.item.charAt(0)}</span><span><span className="block text-sm font-black">{item.item}</span><span className="mt-0.5 block text-[10px] font-bold text-[#92776E]">{item.category}</span></span></button></td><td className="px-4 py-4 font-mono text-xs font-bold">#{item.batch}</td><td className="px-4 py-4 text-sm font-black">{item.qty}</td><td className="px-4 py-4 text-xs font-bold">{item.expireDate}</td><td className="px-6 py-4"><span className={`inline-flex rounded-full border-2 border-[#2D1B17] px-2.5 py-1 text-[10px] font-black ${statusClass[item.status]}`}>{statusLabel[item.status]}</span></td></tr>)}</tbody></table></div>}
          <footer className="flex justify-between border-t-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em]"><span>{loading ? 'Loading' : `แสดง ${visible.length}/${items.length} รายการ`}</span><span>FIFO sorted ✦</span></footer>
        </section>
      </div>

      {selectedBatch && <InventoryDetailsDialog batch={selectedBatch} onClose={() => setSelectedBatch(null)} onTransfer={() => { setSelectedBatch(null); navigate('/staff/transfer-to-thaw-prep') }} />}
    </>
  )
}

function InventoryDetailsDialog({ batch, onClose, onTransfer }: { batch: InventoryBatch; onClose: () => void; onTransfer: () => void }) {
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
          <Detail label="จำนวนคงเหลือ" value={batch.qty} />
          <Detail label="พื้นที่จัดเก็บ" value={batch.location || 'ยังไม่ระบุ'} />
          <Detail label="วันที่รับเข้า" value={batch.receiveDate} />
          <Detail label="วันหมดอายุ" value={batch.expireDate} />
          <Detail label="ต้นทุนต่อหน่วย" value={unitValue} />
          <Detail label="รหัสรายการ" value={batch.id} />
        </div>
        <div className="mx-6 rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-4 py-3 text-xs font-bold leading-5 text-[#60483F]">ตรวจสอบล็อตนี้ก่อนหยิบใช้ หากต้องเตรียมวัตถุดิบต่อ ให้ไปที่หน้าการโอนย้ายเพื่อดำเนินการ</div>
        <footer className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black">ปิด</button>
          <button type="button" onClick={onTransfer} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition hover:-translate-y-0.5">ไปหน้าโอนย้าย →</button>
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

