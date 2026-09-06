import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Eye, EyeOff, Pencil, Plus, QrCode, ReceiptText, RefreshCw, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import CheckInDialog from './CheckInDialog'

type DiningTable = {
  id: string
  isHidden: boolean
  tableNumber: string
  status: 'empty' | 'occupied' | 'near_expiry' | 'expired' | 'pending_cleanup'
  activeSessionId: string | null
  expiresAt?: string
  adultCount?: number
  childCount?: number
  seniorCount?: number
  disabledCount?: number
  pendingOrders?: number
  confirmedOrders?: number
}

const tableSorter = new Intl.Collator('th', { numeric: true, sensitivity: 'base' })

const statusStyle: Record<DiningTable['status'], { label: string; className: string; accent: string }> = {
  empty: { label: 'ว่าง', className: 'bg-[#3F8F55] text-white', accent: 'bg-[#B97861]' },
  occupied: { label: 'มีลูกค้า', className: 'bg-[#D9B99A] text-[#2D1B17]', accent: 'bg-[#B97861]' },
  near_expiry: { label: 'ใกล้หมดเวลา', className: 'bg-amber-200 text-amber-950', accent: 'bg-amber-400' },
  expired: { label: 'หมดเวลา', className: 'bg-red-100 text-red-800', accent: 'bg-red-500' },
  pending_cleanup: { label: 'รอเก็บโต๊ะ', className: 'bg-[#DBC8B8] text-[#2D1B17]', accent: 'bg-[#7B726B]' },
}

function formatTimeRemaining(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return 'หมดเวลา'
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} นาที`
  return `${Math.floor(diffMins / 60)} ชม. ${diffMins % 60} นาที`
}

export default function TableList() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)
  const [showHidden, setShowHidden] = useState(false)
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [isHidden, setIsHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [checkInTarget, setCheckInTarget] = useState<{ table: DiningTable; sessionId?: string } | null>(null)

  const fetchData = async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    setError('')
    try {
      const data = await apiFetch<{ diningTables: DiningTable[] }>('/cashier/dining-tables?includeHidden=true')
      setTables(data.diningTables)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchData(true)
    const interval = setInterval(() => void fetchData(true), 10000)
    const tickInterval = setInterval(() => setTick((value) => value + 1), 60000)
    return () => { clearInterval(interval); clearInterval(tickInterval) }
  }, [])

  const visibleTables = useMemo(() => tables
    .filter((table) => showHidden || !table.isHidden)
    .sort((a, b) => Number(a.isHidden) - Number(b.isHidden) || tableSorter.compare(a.tableNumber, b.tableNumber)), [tables, showHidden])

  const available = tables.filter((table) => table.status === 'empty' && !table.isHidden).length
  const occupied = tables.filter((table) => table.status === 'occupied' && !table.isHidden).length
  const pendingCleanup = tables.filter((table) => table.status === 'pending_cleanup' && !table.isHidden).length
  const openBills = tables.filter((table) => table.activeSessionId).length
  const hiddenCount = tables.filter((table) => table.isHidden).length

  const startEdit = (table: DiningTable | 'new') => {
    setEditing(table)
    setTableNumber(table === 'new' ? '' : table.tableNumber)
    setIsHidden(table === 'new' ? false : table.isHidden)
    setEditError('')
  }

  const saveTable = async (deleting = false) => {
    if (!editing || saving) return
    if (deleting && !confirm('ยืนยันลบโต๊ะนี้? ประวัติบิลเดิมจะยังถูกเก็บไว้')) return
    setSaving(true)
    setEditError('')
    try {
      await apiFetch('/cashier/dining-tables' + (editing === 'new' ? '' : `/${editing.id}`), {
        method: deleting ? 'DELETE' : editing === 'new' ? 'POST' : 'PATCH',
        ...(deleting ? {} : { body: JSON.stringify({ tableNumber, isHidden }) }),
      })
      setEditing(null)
      await fetchData(true)
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  const handleClearTable = async (tableId: string) => {
    if (!confirm('ยืนยันว่าเก็บโต๊ะเรียบร้อยแล้ว?')) return
    try {
      await apiFetch(`/cashier/dining-tables/${tableId}/clear`, { method: 'POST' })
      await fetchData(true)
    } catch (caught) { alert(caught instanceof Error ? caught.message : 'ไม่สามารถเก็บโต๊ะได้') }
  }

  return (
    <div className="w-full max-w-[1240px] pb-20 text-[#2D1B17]">
      <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#DBC8B8] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <span className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-2 border-[#2D1B17]/20 bg-[#E7C7B8]" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex rotate-[-2deg] items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-[10px] font-black tracking-[.14em] shadow-[2px_2px_0_#2D1B17]"><Sparkles size={13} /> TABLE FLOOR</span>
            <h1 className="mt-4 text-4xl font-black tracking-[-.035em]">จัดการโต๊ะ</h1>
            <p className="mt-2 text-sm font-bold text-[#6D5147]">เช็กสถานะ เปิดโต๊ะ และจัดระเบียบพื้นที่ให้บริการ · อัปเดตทุก 10 วินาที</p>
          </div>
          <button onClick={() => startEdit('new')} className="group inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-3 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_#B97861] active:translate-y-0 active:shadow-[2px_2px_0_#B97861]">
            <Plus size={17} className="transition-transform group-hover:rotate-90" /> เพิ่มโต๊ะ
          </button>
        </div>
      </header>

      {error && <div className="anim-down d-2 mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric index={0} label="โต๊ะว่าง" value={loading ? '—' : available} note="พร้อม Check In" color="bg-[#E8D8CA]" icon={<CheckCircle2 size={20} />} />
        <Metric index={1} label="มีลูกค้า" value={loading ? '—' : occupied} note="กำลังให้บริการ" color="bg-[#D9B99A]" icon={<Users size={20} />} />
        <Metric index={2} label="รอเก็บโต๊ะ" value={loading ? '—' : pendingCleanup} note="รอทำความสะอาด" color="bg-[#E7C7B8]" icon={<Clock3 size={20} />} />
        <Metric index={3} label="บิลที่เปิดอยู่" value={loading ? '—' : openBills} note="รายการปัจจุบัน" color="bg-[#F1E2CF]" icon={<ReceiptText size={20} />} />
      </section>

      <section className="anim-up d-4 mt-8 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
        <div className="flex flex-col gap-4 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-xl font-black">แผนผังโต๊ะ</h2><p className="mt-1 text-xs font-semibold text-[#8A7067]">เรียงตามหมายเลขโต๊ะจากน้อยไปมาก</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowHidden((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] px-3.5 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17] transition-all hover:-translate-y-0.5 ${showHidden ? 'bg-[#2D1B17] text-white' : 'bg-[#E7C7B8]'}`}>
              {showHidden ? <EyeOff size={15} /> : <Eye size={15} />} {showHidden ? 'ซ่อนรายการที่ปิด' : `โต๊ะที่ซ่อน ${hiddenCount}`}
            </button>
            <button onClick={() => void fetchData()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-3.5 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17] transition hover:-translate-y-0.5 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />รีเฟรช</button>
          </div>
        </div>

        {loading ? <div className="px-6 py-16 text-center text-sm font-bold text-[#7B726B]"><RefreshCw className="mx-auto mb-3 animate-spin" />กำลังจัดโต๊ะ…</div>
          : visibleTables.length === 0 ? <div className="px-6 py-16 text-center"><p className="text-xl font-black">ยังไม่มีโต๊ะที่แสดง</p><p className="mt-2 text-sm font-semibold text-[#876E65]">กดเพิ่มโต๊ะ หรือเปิดดูโต๊ะที่ซ่อนไว้</p></div>
          : <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTables.map((table, index) => <TableCard key={table.id} table={table} index={index} onEdit={() => startEdit(table)} onClear={() => void handleClearTable(table.id)} onQr={() => setCheckInTarget({ table, sessionId: table.activeSessionId || undefined })} onCheckout={() => navigate(`/cashier/payment?sessionId=${table.activeSessionId}`)} onCheckIn={() => setCheckInTarget({ table })} />)}
          </div>}
        <footer className="flex justify-between border-t-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em]"><span>แสดง {visibleTables.length}/{tables.length} โต๊ะ</span><span>Natural order ✦</span></footer>
      </section>

      {editing && <TableDialog mode={editing} tableNumber={tableNumber} isHidden={isHidden} saving={saving} error={editError} onNumberChange={setTableNumber} onHiddenChange={setIsHidden} onClose={() => setEditing(null)} onSave={() => void saveTable()} onDelete={() => void saveTable(true)} />}
      {checkInTarget && <CheckInDialog table={checkInTarget.table} sessionId={checkInTarget.sessionId} onClose={() => setCheckInTarget(null)} onChanged={() => void fetchData(true)} />}
    </div>
  )
}

function TableCard({ table, index, onEdit, onClear, onQr, onCheckout, onCheckIn }: { table: DiningTable; index: number; onEdit: () => void; onClear: () => void; onQr: () => void; onCheckout: () => void; onCheckIn: () => void }) {
  const visual = statusStyle[table.status]
  const headCount = (Number(table.adultCount) || 0) + (Number(table.childCount) || 0) + (Number(table.seniorCount) || 0) + (Number(table.disabledCount) || 0)
  const canEdit = table.status === 'empty' && !table.activeSessionId
  return <article className={`anim-up group relative flex min-h-[245px] flex-col overflow-hidden rounded-[22px] border-2 border-[#2D1B17] bg-white shadow-[5px_5px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0_#2D1B17] ${table.isHidden ? 'opacity-70 grayscale-[35%]' : ''}`} style={{ animationDelay: `${Math.min(index, 10) * 55}ms` }}>
    <div className={`h-2 w-full ${table.isHidden ? 'bg-[#7B726B]' : visual.accent}`} />
    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#92776E]">Dining table</p><h3 className="mt-1 text-2xl font-black">โต๊ะ {table.tableNumber}</h3></div>
        {table.isHidden ? (
          <span className="rounded-full border-2 border-[#2D1B17] bg-red-100 px-3 py-1 text-[11px] font-black text-red-800 shadow-[2px_2px_0_#2D1B17]">ปิดใช้งาน</span>
        ) : table.status === 'empty' ? (
          <span className="rounded-full border-2 border-[#2D1B17] bg-[#3F8F55] px-3 py-1 text-[11px] font-black text-white shadow-[2px_2px_0_#2D1B17]">ว่าง</span>
        ) : (
          <span className={`rounded-full border-2 border-[#2D1B17] px-3 py-1 text-[11px] font-black shadow-[2px_2px_0_#2D1B17] ${visual.className}`}>{visual.label}</span>
        )}
      </div>
      <div className="mt-4 flex-1 rounded-xl border-2 border-[#2D1B17]/10 bg-[#FFF8EF] px-3.5 py-3">
        {table.activeSessionId ? <div className="space-y-1.5 text-xs font-bold text-[#75584E]"><p className="flex justify-between"><span>ลูกค้า</span><strong className="text-[#2D1B17]">{headCount} ท่าน</strong></p>{table.expiresAt && <p className="flex justify-between"><span>เหลือเวลา</span><strong className={table.status === 'expired' ? 'text-red-700' : 'text-[#2D1B17]'}>{formatTimeRemaining(table.expiresAt)}</strong></p>}<p className="flex justify-between"><span>ออเดอร์</span><strong className="text-[#2D1B17]">{table.confirmedOrders || 0} <span className="text-amber-700">(รอ {table.pendingOrders || 0})</span></strong></p></div>
          : <p className="flex h-full items-center gap-2 text-xs font-bold text-[#75584E]"><span className={`h-2.5 w-2.5 rounded-full ${table.isHidden ? 'bg-gray-400' : visual.accent}`} />{table.isHidden ? 'นำออกจากพื้นที่ให้บริการชั่วคราว' : table.status === 'pending_cleanup' ? 'รอลูกค้าออกและทำความสะอาด' : 'พร้อมให้บริการ'}</p>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {table.activeSessionId && <><button onClick={onQr} className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2D1B17] bg-white py-2 text-xs font-black transition hover:-translate-y-0.5"><QrCode size={14} />ดู QR</button><button onClick={onCheckout} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] py-2 text-xs font-black text-white transition hover:-translate-y-0.5">Check Out</button></>}
        {table.status === 'empty' && !table.isHidden && <button onClick={onCheckIn} className="col-span-2 rounded-xl border-2 border-[#2D1B17] bg-[#B97861] py-2 text-xs font-black text-white shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5">Check In →</button>}
        {table.status === 'pending_cleanup' && <button onClick={onClear} className="col-span-2 rounded-xl border-2 border-[#2D1B17] bg-[#E8D8CA] py-2 text-xs font-black transition hover:-translate-y-0.5">เก็บโต๊ะเรียบร้อย</button>}
        <button disabled={!canEdit} onClick={onEdit} title={canEdit ? 'แก้ไขโต๊ะ' : 'แก้ไขได้เมื่อโต๊ะว่าง'} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2D1B17]/30 py-2 text-xs font-black transition hover:border-[#2D1B17] hover:bg-[#F1E2CF] disabled:cursor-not-allowed disabled:opacity-35"><Pencil size={13} />แก้ไขโต๊ะ</button>
      </div>
    </div>
  </article>
}

function TableDialog({ mode, tableNumber, isHidden, saving, error, onNumberChange, onHiddenChange, onClose, onSave, onDelete }: { mode: DiningTable | 'new'; tableNumber: string; isHidden: boolean; saving: boolean; error: string; onNumberChange: (value: string) => void; onHiddenChange: (value: boolean) => void; onClose: () => void; onSave: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1B17]/70 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <form onSubmit={(event) => { event.preventDefault(); onSave() }} className="anim-up w-full max-w-lg overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[8px_8px_0_#2D1B17]">
      <header className="flex items-start justify-between border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#805349]">Table setup</p><h2 className="mt-1 text-2xl font-black">{mode === 'new' ? 'เพิ่มโต๊ะใหม่' : `แก้ไขโต๊ะ ${mode.tableNumber}`}</h2></div><button type="button" onClick={onClose} aria-label="ปิด" className="rounded-full border-2 border-[#2D1B17] bg-white p-2 shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5"><X size={17} /></button></header>
      <div className="space-y-5 p-6"><label className="block text-xs font-black uppercase tracking-wide text-[#73564C]">ชื่อ / หมายเลขโต๊ะ<input autoFocus required maxLength={50} disabled={saving} value={tableNumber} onChange={(event) => onNumberChange(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-base font-black normal-case outline-none transition-all focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#B97861]" placeholder="เช่น 12 หรือ A12" /></label>
        {mode !== 'new' && <button type="button" disabled={saving} onClick={() => onHiddenChange(!isHidden)} className={`flex w-full items-center gap-4 rounded-2xl border-2 border-[#2D1B17] p-4 text-left transition-all hover:-translate-y-0.5 ${isHidden ? 'bg-[#2D1B17] text-white shadow-[4px_4px_0_#B97861]' : 'bg-[#F1E2CF] shadow-[4px_4px_0_#2D1B17]'}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-current bg-white/10">{isHidden ? <EyeOff size={19} /> : <Eye size={19} />}</span><span><strong className="block text-sm font-black">{isHidden ? 'โต๊ะนี้ถูกซ่อนอยู่' : 'โต๊ะนี้เปิดให้บริการ'}</strong><span className="mt-0.5 block text-xs font-semibold opacity-70">กดเพื่อ{isHidden ? 'นำกลับมาแสดงและเปิด Check In' : 'ซ่อนจากหน้าการใช้งานชั่วคราว'}</span></span></button>}
        {error && <p role="alert" className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-between"><div>{mode !== 'new' && <button type="button" disabled={saving} onClick={onDelete} className="inline-flex items-center gap-2 rounded-xl border-2 border-red-800 bg-red-50 px-4 py-2.5 text-sm font-black text-red-800 transition hover:-translate-y-0.5"><Trash2 size={15} />ลบโต๊ะ</button>}</div><div className="flex gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black">ยกเลิก</button><button disabled={saving} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></div></footer>
    </form>
  </div>
}

function Metric({ label, value, note, color, icon, index }: { label: string; value: string | number; note: string; color: string; icon: React.ReactNode; index: number }) {
  return <article className={`anim-up relative overflow-hidden rounded-[22px] border-2 border-[#2D1B17] p-5 shadow-[5px_5px_0_#2D1B17] ${color}`} style={{ animationDelay: `${100 + index * 70}ms` }}><span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-white/70">{icon}</span><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#775B51]">{label}</p><p className="mt-2 text-4xl font-black">{typeof value === 'number' ? String(value).padStart(2, '0') : value}</p><p className="mt-1 text-xs font-bold text-[#765F56]">{note}</p></article>
}
