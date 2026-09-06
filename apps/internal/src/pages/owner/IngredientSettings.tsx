import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, CheckCircle2, Pencil, RotateCcw, Search, TriangleAlert, X } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'

type Draft = {
  name: string
  portionGrams: string
  thresholdPlates: string
  isActive: boolean
}

export default function IngredientSettings() {
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [selected, setSelected] = useState<IngredientPreset | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadIngredients = useCallback(async () => {
    try {
      const data = await apiFetch<{ ingredients: IngredientPreset[] }>('/owner/ingredients')
      setIngredients(data.ingredients)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลวัตถุดิบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadIngredients() }, [loadIngredients])

  const visible = useMemo(() => ingredients.filter((ingredient) => {
    const matchesQuery = `${ingredient.name} ${ingredient.category}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'active' ? ingredient.isActive !== false : ingredient.isActive === false)
    return matchesQuery && matchesFilter
  }), [filter, ingredients, query])

  const openEditor = (ingredient: IngredientPreset) => {
    setSelected(ingredient)
    setDraft({
      name: ingredient.name,
      portionGrams: String(Math.round(ingredient.defaultPortionSizeKg * 1000)),
      thresholdPlates: String(ingredient.thawPrepThresholdPlates ?? 0),
      isActive: ingredient.isActive !== false,
    })
    setError('')
    setSuccess('')
  }

  const closeEditor = () => {
    if (saving) return
    setSelected(null)
    setDraft(null)
  }

  const save = async () => {
    if (!selected || !draft || saving) return
    const name = draft.name.trim().replace(/\s+/g, ' ')
    const portionGrams = Number(draft.portionGrams)
    const threshold = Number(draft.thresholdPlates)
    if (!name || name.length > 120) return setError('กรุณากรอกชื่อวัตถุดิบไม่เกิน 120 ตัวอักษร')
    if (!Number.isSafeInteger(portionGrams) || portionGrams < 1 || portionGrams > 9999) return setError('น้ำหนักต้องเป็นจำนวนเต็ม 1–9,999 กรัมต่อถาด')
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 100000) return setError('จำนวนขั้นต่ำต้องเป็นจำนวนเต็ม 0–100,000 ถาด')
    if (selected.isActive !== false && !draft.isActive && !window.confirm(`เก็บ “${selected.name}” เข้าคลังถาวรหรือไม่? รายการจะไม่ปรากฏในงานรับของและแปรรูปใหม่`)) return

    setSaving(true)
    setError('')
    try {
      const data = await apiFetch<{ ingredient: IngredientPreset }>(`/owner/ingredients/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          defaultPortionSizeKg: portionGrams / 1000,
          thawPrepThresholdPlates: threshold,
          isActive: draft.isActive,
        }),
      })
      setIngredients((current) => current.map((item) => item.id === selected.id
        ? { ...item, ...data.ingredient }
        : item))
      setSuccess(`บันทึกข้อมูล ${name} แล้ว`)
      setSelected(null)
      setDraft(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกข้อมูลไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = ingredients.filter((item) => item.isActive !== false).length
  const archivedCount = ingredients.length - activeCount
  const lowCount = ingredients.filter((item) => item.isActive !== false && (item.thawPrepThresholdPlates ?? 0) > 0 && Number(item.prepAvailablePlates ?? 0) < Number(item.thawPrepThresholdPlates)).length

  return (
    <div className="w-full max-w-[1240px]">
      <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border-[24px] border-white/40" />
        <span className="relative inline-flex rounded-full border-2 border-[#2D1B17] bg-[#DBC8B8] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">INGREDIENT SETTINGS ✦</span>
        <h1 className="relative mt-4 text-4xl font-black tracking-[-.035em]">จัดการวัตถุดิบ</h1>
        <p className="relative mt-2 max-w-2xl text-sm font-bold text-[#6D5147]">แก้ชื่อ น้ำหนักต่อถาด เกณฑ์ขั้นต่ำ และสถานะใช้งานได้จากหน้าเดียว โดยข้อมูลเก่าจะยังคงอยู่ในประวัติ</p>
      </header>

      <section className="mb-7 grid gap-5 sm:grid-cols-3"><Stat label="กำลังใช้งาน" value={activeCount} color="bg-[#E8D8CA]" /><Stat label="ต่ำกว่าเกณฑ์" value={lowCount} color={lowCount ? 'bg-[#E7C7B8]' : 'bg-[#F1E2CF]'} /><Stat label="เก็บถาวร" value={archivedCount} color="bg-[#DBC8B8]" /></section>
      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
      {success && <div className="mb-5 flex items-center gap-2 rounded-2xl border-2 border-green-800 bg-green-50 px-5 py-4 text-sm font-bold text-green-800"><CheckCircle2 size={18} />{success}</div>}

      <section className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
        <div className="flex flex-col gap-4 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex self-start rounded-xl border-2 border-[#2D1B17] bg-white p-1">{(['active', 'archived', 'all'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-4 py-2 text-xs font-black ${filter === value ? 'bg-[#2D1B17] text-white' : ''}`}>{value === 'active' ? 'ใช้งาน' : value === 'archived' ? 'เก็บถาวร' : 'ทั้งหมด'}</button>)}</div>
          <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-3.5 py-2.5 shadow-[3px_3px_0_#2D1B17]"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาวัตถุดิบ..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /></label>
        </div>

        {loading ? <div className="px-6 py-14 text-center text-sm font-bold">กำลังโหลดข้อมูล…</div> : visible.length === 0 ? <div className="px-6 py-14 text-center text-sm font-bold">ไม่พบวัตถุดิบในรายการนี้</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b-2 border-[#2D1B17] bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.12em] text-white"><tr><th className="px-6 py-4">วัตถุดิบ</th><th className="px-4 py-4">กรัม/ถาด</th><th className="px-4 py-4">Prep / ขั้นต่ำ</th><th className="px-4 py-4">สถานะ</th><th className="px-6 py-4 text-right">จัดการ</th></tr></thead><tbody>{visible.map((ingredient) => {
          const available = Number(ingredient.prepAvailablePlates ?? 0)
          const threshold = Number(ingredient.thawPrepThresholdPlates ?? 0)
          const low = ingredient.isActive !== false && threshold > 0 && available < threshold
          return <tr key={ingredient.id} className={`border-b-2 border-[#2D1B17]/10 ${ingredient.isActive === false ? 'bg-stone-100 opacity-70' : 'hover:bg-[#FFF8EF]'}`}><td className="px-6 py-4"><p className="text-sm font-black">{ingredient.name}</p><p className="mt-1 text-[10px] font-bold text-[#92776E]">ID {ingredient.id} · {ingredient.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'}</p></td><td className="px-4 py-4 text-lg font-black">{Math.round(ingredient.defaultPortionSizeKg * 1000).toLocaleString('th-TH')} g</td><td className="px-4 py-4"><p className="text-sm font-black">{available.toLocaleString('th-TH')} / {threshold.toLocaleString('th-TH')} ถาด</p>{low && <p className="mt-1 flex items-center gap-1 text-[10px] font-black text-red-700"><TriangleAlert size={12} />ขาด {threshold - available} ถาด</p>}</td><td className="px-4 py-4"><Status active={ingredient.isActive !== false} /></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => openEditor(ingredient)} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17]"><Pencil size={14} />แก้ไข</button></td></tr>
        })}</tbody></table></div>}
      </section>

      {selected && draft && <Editor ingredient={selected} draft={draft} saving={saving} onDraft={setDraft} onSave={() => { void save() }} onClose={closeEditor} />}
    </div>
  )
}

function Editor({ ingredient, draft, saving, onDraft, onSave, onClose }: { ingredient: IngredientPreset; draft: Draft; saving: boolean; onDraft: (draft: Draft) => void; onSave: () => void; onClose: () => void }) {
  const inputClass = 'w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-sm font-black outline-none focus:shadow-[3px_3px_0_#B97861]'
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1B17]/70 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[8px_8px_0_#2D1B17]"><header className="flex items-start justify-between border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[.14em]">Ingredient #{ingredient.id}</p><h2 className="mt-1 text-2xl font-black">แก้ไขวัตถุดิบ</h2><p className="mt-1 text-xs font-bold text-[#75584E]">ประเภท: {ingredient.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'} · ไม่อนุญาตให้เปลี่ยนหลังสร้าง</p></div><button type="button" onClick={onClose} aria-label="ปิด" className="rounded-full border-2 border-[#2D1B17] bg-white p-2"><X size={17} /></button></header><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="ชื่อวัตถุดิบ" wide><input autoFocus value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} className={inputClass} maxLength={120} /></Field><Field label="น้ำหนักต่อถาด (กรัม)"><input type="number" min="1" max="9999" step="1" value={draft.portionGrams} onChange={(event) => onDraft({ ...draft, portionGrams: event.target.value })} className={inputClass} /></Field><Field label="ขั้นต่ำใน Prep (ถาด)"><input type="number" min="0" max="100000" step="1" value={draft.thresholdPlates} onChange={(event) => onDraft({ ...draft, thresholdPlates: event.target.value })} className={inputClass} /></Field><div className="sm:col-span-2 rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black">สถานะวัตถุดิบ</p><p className="mt-1 text-xs font-bold text-[#75584E]">เก็บถาวรแล้วจะไม่แสดงในงานรับของ แปรรูป หรือแจ้งเตือนใหม่</p></div><button type="button" onClick={() => onDraft({ ...draft, isActive: !draft.isActive })} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-[#2D1B17] px-4 py-2 text-xs font-black ${draft.isActive ? 'bg-green-100 text-green-900' : 'bg-stone-200'}`}>{draft.isActive ? <CheckCircle2 size={15} /> : <Archive size={15} />}{draft.isActive ? 'ใช้งาน' : 'เก็บถาวร'}</button></div></div></div><footer className="flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => onDraft({ name: ingredient.name, portionGrams: String(Math.round(ingredient.defaultPortionSizeKg * 1000)), thresholdPlates: String(ingredient.thawPrepThresholdPlates ?? 0), isActive: ingredient.isActive !== false })} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black"><RotateCcw size={15} />คืนค่า</button><button type="button" onClick={onSave} disabled={saving} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}</button></footer></section></div>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`text-xs font-black ${wide ? 'sm:col-span-2' : ''}`}>{label}<div className="mt-2">{children}</div></label> }
function Status({ active }: { active: boolean }) { return <span className={`inline-flex rounded-full border-2 border-[#2D1B17] px-3 py-1 text-[10px] font-black ${active ? 'bg-green-50 text-green-900' : 'bg-stone-200'}`}>{active ? 'ใช้งาน' : 'เก็บถาวร'}</span> }
function Stat({ label, value, color }: { label: string; value: number; color: string }) { return <article className={`rounded-[22px] border-2 border-[#2D1B17] p-5 shadow-[5px_5px_0_#2D1B17] ${color}`}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#775B51]">{label}</p><p className="mt-2 text-4xl font-black">{value.toLocaleString('th-TH')}</p></article> }
