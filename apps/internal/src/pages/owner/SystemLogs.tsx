import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { apiFetch } from '../../lib/api'

type SystemLog = { id: string; timestamp: string; action: string; details: unknown; actor: string | null }
type LogMeta = { title: string; description: string; category: string; tone: string }

const actionMeta: Record<string, LogMeta> = {
  'inventory.expired_lot_disposed': { title: 'แยกวัตถุดิบหมดอายุแล้ว', description: 'ตัดยอดคงเหลือและบันทึกเป็นของเสีย', category: 'คลังสินค้า', tone: 'bg-red-50 text-red-800 border-red-200' },
  'menu.category_created': { title: 'เพิ่มหมวดหมู่เมนู', description: 'สร้างหมวดหมู่ใหม่สำหรับจัดกลุ่มเมนู', category: 'เมนู', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
  'menu.category_renamed': { title: 'เปลี่ยนชื่อหมวดหมู่เมนู', description: 'อัปเดตชื่อหมวดและเมนูเดิมในหมวดนั้น', category: 'เมนู', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
  'inventory.lot_received': { title: 'รับวัตถุดิบเข้าคลัง', description: 'เพิ่มล็อตใหม่เข้าสู่ระบบ', category: 'คลังสินค้า', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  'inventory.ingredient_created': { title: 'สร้างวัตถุดิบใหม่', description: 'เพิ่มชื่อวัตถุดิบเข้าทะเบียนเพื่อใช้รับเข้าและจัดการสต็อก', category: 'ทะเบียนวัตถุดิบ', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  'inventory.lot_transferred': { title: 'โอนล็อตไปยัง Prep', description: 'ย้ายวัตถุดิบจาก Freezer ไปเตรียมเป็นถาด', category: 'คลังสินค้า', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  'inventory.ingredient_fifo_transferred': { title: 'โอนวัตถุดิบตาม FIFO', description: 'ตัดจากล็อตเก่าก่อนและส่งไปยัง Prep', category: 'คลังสินค้า', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  'ingredient.portion_preset_updated': { title: 'แก้ไขขนาดต่อถาด', description: 'เปลี่ยนค่ามาตรฐานการแบ่งวัตถุดิบ', category: 'ตั้งค่า', tone: 'bg-blue-50 text-blue-800 border-blue-200' },
  'staff.order_acknowledged': { title: 'ครัวรับทราบออเดอร์', description: 'พนักงานครัวเริ่มดำเนินการออเดอร์', category: 'ออเดอร์', tone: 'bg-violet-50 text-violet-800 border-violet-200' },
  'staff.orders_acknowledged_all': { title: 'ครัวรับทราบทุกออเดอร์', description: 'รับออเดอร์ที่รอดำเนินการทั้งหมด', category: 'ออเดอร์', tone: 'bg-violet-50 text-violet-800 border-violet-200' },
  'staff.order_served': { title: 'เสิร์ฟออเดอร์แล้ว', description: 'พนักงานยืนยันการเสิร์ฟ', category: 'ออเดอร์', tone: 'bg-violet-50 text-violet-800 border-violet-200' },
  'cashier.checkout': { title: 'ชำระเงินและปิดโต๊ะ', description: 'แคชเชียร์บันทึกการชำระเงินเรียบร้อย', category: 'การชำระเงิน', tone: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  'cashier.table_cleared': { title: 'เคลียร์โต๊ะแล้ว', description: 'โต๊ะพร้อมรับลูกค้ารอบถัดไป', category: 'โต๊ะ', tone: 'bg-slate-50 text-slate-800 border-slate-200' },
}

const labels: Record<string, string> = {
  item: 'วัตถุดิบ', quantity: 'จำนวน', unit: 'หน่วย', reason: 'เหตุผล', wasteCost: 'มูลค่าของเสีย', lotId: 'รหัสล็อต',
  lotHeaderId: 'เลขที่รับเข้า', lineCount: 'จำนวนรายการ', reference: 'เลขอ้างอิง', orderId: 'เลขออเดอร์', count: 'จำนวนออเดอร์',
  diningTableId: 'หมายเลขโต๊ะ', tableSessionId: 'รอบโต๊ะ', receiptNumber: 'เลขที่ใบเสร็จ', paymentMethod: 'วิธีชำระ', subtotal: 'ยอดรวม',
  cashReceived: 'เงินสดที่รับ', changeAmount: 'เงินทอน', paymentReference: 'เลขอ้างอิงการชำระ', ingredientName: 'วัตถุดิบ',
  quantityKg: 'น้ำหนัก', plateCount: 'จำนวนถาด', totalPlateCount: 'จำนวนถาดรวม', sourceQuantityRemainingKg: 'คงเหลือใน Freezer',
  defaultPortionSizeKg: 'ขนาดต่อถาด', ingredientId: 'รหัสวัตถุดิบ', storageName: 'พื้นที่จัดเก็บ', name: 'ชื่อ', category: 'หมวด', categoryId: 'รหัสหมวด', previousName: 'ชื่อเดิม',
}

function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (['wasteCost', 'subtotal', 'cashReceived', 'changeAmount'].includes(key)) return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value))
  if (key === 'defaultPortionSizeKg') return `${Math.round(Number(value) * 1000).toLocaleString('th-TH')} กรัม/ถาด`
  if (['quantityKg', 'sourceQuantityRemainingKg'].includes(key)) return `${value} กก.`
  if (Array.isArray(value)) return `${value.length} รายการ`
  if (typeof value === 'object') return 'รายละเอียดเพิ่มเติม'
  return String(value)
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { apiFetch<{ logs: SystemLog[] }>('/owner/system-logs?limit=200').then((data) => setLogs(data.logs)).catch((caught) => setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดประวัติระบบได้')).finally(() => setLoading(false)) }, [])
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? logs.filter((log) => `${actionMeta[log.action]?.title ?? log.action} ${actionMeta[log.action]?.category ?? ''} ${log.actor ?? 'ระบบ'} ${JSON.stringify(log.details)}`.toLowerCase().includes(needle)) : logs
  }, [logs, query])

  return <div className="admin-page w-full max-w-[1200px] pb-10">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#8b5e55]">Audit trail</p><h1 className="text-[28px] font-bold text-[#302221]">ประวัติการทำงานของระบบ</h1><p className="mt-1 text-sm text-[#7B726B]">ตรวจสอบว่าใครทำอะไรและเกิดขึ้นเมื่อใด</p></div><label className="flex w-full items-center gap-2 rounded-xl border border-[#d8cec5] bg-white px-4 py-3 sm:w-[340px]"><Search size={17} className="text-[#8b756c]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเหตุการณ์หรือชื่อพนักงาน" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></header>
    {error && <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="admin-surface overflow-hidden rounded-xl bg-white"><div className="flex items-center justify-between border-b bg-[#FDFBF7] px-5 py-4"><h2 className="font-bold text-[#302221]">กิจกรรมล่าสุด</h2><span className="rounded-full bg-[#F4EFEA] px-3 py-1 text-xs font-bold text-[#6f5850]">{visible.length} รายการ</span></div>
      {loading ? <div className="px-6 py-12 text-center text-sm font-bold text-[#777]">กำลังโหลดประวัติ…</div> : visible.length === 0 ? <div className="px-6 py-12 text-center text-sm text-[#777]">ไม่พบประวัติที่ค้นหา</div> : <div className="divide-y divide-[#eee7e1]">{visible.map((log) => {
        const meta = actionMeta[log.action] ?? { title: 'กิจกรรมระบบ', description: log.action, category: 'ระบบ', tone: 'bg-slate-50 text-slate-800 border-slate-200' }
        const details = asRecord(log.details); const entries = Object.entries(details).filter(([key]) => key !== 'lines' && key !== 'allocations'); const expanded = expandedId === log.id
        return <article key={log.id} className="px-5 py-5 hover:bg-[#fffdf9]"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.tone}`}>{meta.category}</span><h3 className="font-bold text-[#302221]">{meta.title}</h3></div><p className="mt-1.5 text-sm text-[#7B726B]">{meta.description}</p><p className="mt-2 text-xs font-semibold text-[#8b756c]">โดย {log.actor ?? 'ระบบอัตโนมัติ'}</p></div><div className="shrink-0 sm:text-right"><p className="text-sm font-bold text-[#4A322F]">{new Date(log.timestamp).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</p><p className="mt-1 text-xs text-[#7B726B]">{new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.</p></div></div>
          {entries.length > 0 && <div className="mt-4 grid gap-2 rounded-xl bg-[#F8F4EF] p-4 sm:grid-cols-2 lg:grid-cols-3">{entries.slice(0, expanded ? entries.length : 6).map(([key, value]) => <div key={key}><p className="text-[10px] font-bold uppercase tracking-wide text-[#9a857d]">{labels[key] ?? key}</p><p className="mt-0.5 break-words text-sm font-semibold text-[#4A322F]">{formatValue(key, value)}</p></div>)}</div>}
          {(entries.length > 6 || 'lines' in details || 'allocations' in details) && <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)} className="mt-3 text-xs font-bold text-[#8b5e55] hover:underline">{expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดทั้งหมด'}</button>}
          {expanded && ('lines' in details || 'allocations' in details) && <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-[#2D1B17] p-4 text-xs text-[#FFF8EF]">{JSON.stringify(details.lines ?? details.allocations, null, 2)}</pre>}
        </article>
      })}</div>}
    </section>
  </div>
}
