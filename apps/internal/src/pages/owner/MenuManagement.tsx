import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'

export default function MenuManagement() {
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ ingredients: IngredientPreset[] }>('/inventory/ingredients')
      .then((data) => setIngredients(data.ingredients))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load ingredients'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => ingredients.filter((ingredient) => (
    `${ingredient.name} ${ingredient.category}`.toLowerCase().includes(query.toLowerCase())
  )), [ingredients, query])

  const selected = ingredients.find((ingredient) => ingredient.id === selectedId) ?? null
  const selectedDraft = selected ? drafts[selected.id] ?? String(selected.defaultPortionSizeKg) : ''
  const meatCount = ingredients.filter((ingredient) => ingredient.category === 'meat').length
  const vegetableCount = ingredients.filter((ingredient) => ingredient.category === 'vegetable').length

  const updateDraft = (ingredientId: string, value: string) => {
    setDrafts((current) => ({ ...current, [ingredientId]: value }))
  }

  const resetDraft = (ingredientId: string) => {
    setDrafts((current) => {
      const next = { ...current }
      delete next[ingredientId]
      return next
    })
  }

  const saveDraft = async (ingredientId: string, value: string) => {
    const defaultPortionSizeKg = Number(value)
    if (!Number.isFinite(defaultPortionSizeKg) || defaultPortionSizeKg <= 0) throw new Error('ปริมาณต่อถาดต้องมากกว่า 0')
    setSavingId(ingredientId)
    setError('')
    try {
      const data = await apiFetch<{ ingredient: IngredientPreset }>(`/inventory/ingredients/${ingredientId}/portion-preset`, {
        method: 'PUT',
        body: JSON.stringify({ defaultPortionSizeKg }),
      })
      setIngredients((current) => current.map((ingredient) => ingredient.id === ingredientId ? data.ingredient : ingredient))
      resetDraft(ingredientId)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'บันทึก preset ไม่สำเร็จ'
      setError(message)
      throw caught
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <div className="w-full max-w-[1240px]">
        <header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#B97861] px-7 py-8 text-[#2D1B17] shadow-[8px_8px_0_#2D1B17] sm:px-9">
          <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-[#FFF8EF]/30" />
          <div className="relative max-w-3xl">
            <span className="inline-flex rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] shadow-[2px_2px_0_#2D1B17]">Owner settings ✦</span>
            <h1 className="mt-5 text-4xl font-black tracking-[-.035em] sm:text-5xl">Preset ปริมาณต่อถาด</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#563128]">กำหนดปริมาณมาตรฐานของวัตถุดิบ 1 ถาด เพื่อใช้คำนวณการแปลงจาก kg เป็นจำนวนถาดในระบบ</p>
            <div className="mt-5 inline-flex rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17]">หน่วยที่จัดเก็บ: kg / ถาด</div>
          </div>
        </header>

        <section className="mb-7 grid gap-5 sm:grid-cols-3">
          <Stat label="วัตถุดิบทั้งหมด" value={ingredients.length} note="จาก ingredients API" color="bg-[#F1E2CF]" sign="✦" />
          <Stat label="เนื้อสัตว์" value={meatCount} note="ใช้กับ Freezer → ถาด" color="bg-[#DBC8B8]" sign="🥩" />
          <Stat label="ผัก" value={vegetableCount} note="แปลงเป็นถาดตอนรับเข้า" color="bg-[#E8D8CA]" sign="🥬" />
        </section>

        {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
          <div className="flex flex-col gap-4 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">รายการ Preset ต่อถาด</h2><p className="mt-1 text-xs font-semibold text-[#8A7067]">คลิกวัตถุดิบเพื่อแก้ไขค่าบนหน้าจอ</p></div>
            <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-3.5 py-2.5 text-[#7A665F] shadow-[3px_3px_0_#2D1B17]">
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาวัตถุดิบ..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
            </label>
          </div>

          {loading ? <div className="px-6 py-14 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูลวัตถุดิบ…</div> : visible.length === 0 ? <div className="px-6 py-14 text-center"><p className="text-lg font-black">ยังไม่มีข้อมูลวัตถุดิบ</p><p className="mt-1 text-xs font-semibold text-[#876E65]">รายการจะแสดงเมื่อมีข้อมูลจาก ingredients API</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b-2 border-[#2D1B17] bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.14em] text-white"><tr><th className="px-6 py-4">Ingredient</th><th className="px-4 py-4">Category</th><th className="px-4 py-4">Preset / ถาด</th><th className="px-4 py-4">เทียบเป็นกรัม</th><th className="px-6 py-4">สถานะ</th></tr></thead><tbody>{visible.map((ingredient, index) => <IngredientRow key={ingredient.id} ingredient={ingredient} draft={drafts[ingredient.id]} index={index} onSelect={() => setSelectedId(ingredient.id)} />)}</tbody></table></div>}
          <footer className="flex justify-between border-t-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em]"><span>{loading ? 'Loading' : `แสดง ${visible.length}/${ingredients.length} รายการ`}</span><span>Preset source: ingredients API ✦</span></footer>
        </section>

        <div className="mt-5 rounded-2xl border-2 border-[#2D1B17]/15 bg-[#FFF8EF] px-5 py-4 text-xs font-bold leading-5 text-[#60483F]">Owner เป็นผู้กำหนดค่า preset ได้เท่านั้น ส่วน Staff จะเห็นค่าเดียวกันในหน้า Transfer แบบแก้ไขไม่ได้</div>
      </div>

      {selected && <PresetDialog ingredient={selected} value={selectedDraft} saving={savingId === selected.id} onChange={(value) => updateDraft(selected.id, value)} onReset={() => resetDraft(selected.id)} onSave={async () => { try { await saveDraft(selected.id, selectedDraft); setSelectedId(null) } catch { /* Error is shown on the page. */ } }} onClose={() => setSelectedId(null)} />}
    </>
  )
}

function IngredientRow({ ingredient, draft, index, onSelect }: { ingredient: IngredientPreset; draft?: string; index: number; onSelect: () => void }) {
  const value = draft ?? String(ingredient.defaultPortionSizeKg)
  const changed = draft !== undefined && Number(draft) !== ingredient.defaultPortionSizeKg
  return <tr onClick={onSelect} className="cursor-pointer border-b-2 border-[#2D1B17]/10 transition hover:bg-[#FFF8EF]"><td className="px-6 py-4"><button type="button" onClick={onSelect} className="group flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B97861] focus-visible:ring-offset-2"><span className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black transition group-hover:-translate-y-0.5 ${['bg-[#B97861] text-white', 'bg-[#DBC8B8]', 'bg-[#E8D8CA]', 'bg-[#D9B99A]'][index % 4]}`}>{ingredient.name.charAt(0)}</span><span><span className="block text-sm font-black">{ingredient.name}</span><span className="mt-0.5 block text-[10px] font-bold text-[#92776E]">ID: {ingredient.id}</span></span></button></td><td className="px-4 py-4 text-xs font-black">{ingredient.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'}</td><td className="px-4 py-4 text-sm font-black">{formatKg(Number(value))} kg</td><td className="px-4 py-4 text-xs font-bold">{formatGrams(Number(value))} g</td><td className="px-6 py-4">{changed ? <span className="rounded-full border-2 border-[#2D1B17] bg-[#E7C7B8] px-2.5 py-1 text-[10px] font-black">ยังไม่บันทึก</span> : <span className="rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA] px-2.5 py-1 text-[10px] font-black">ค่าจาก API</span>}</td></tr>
}

function PresetDialog({ ingredient, value, saving, onChange, onReset, onSave, onClose }: { ingredient: IngredientPreset; value: string; saving: boolean; onChange: (value: string) => void; onReset: () => void; onSave: () => Promise<void>; onClose: () => void }) {
  const numericValue = Number(value)
  const valid = Number.isFinite(numericValue) && numericValue > 0
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1B17]/70 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="preset-dialog-title" className="w-full max-w-lg rounded-[26px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[8px_8px_0_#2D1B17]" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between gap-4 border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5"><div><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#8B5746]">Portion preset</span><h2 id="preset-dialog-title" className="mt-1 text-2xl font-black text-[#2D1B17]">{ingredient.name}</h2><p className="mt-1 text-xs font-bold text-[#75584E]">{ingredient.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'} · 1 ถาด</p></div><button type="button" aria-label="ปิดหน้าตั้งค่า" onClick={onClose} className="rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-xl font-black leading-none shadow-[2px_2px_0_#2D1B17]">×</button></header><div className="space-y-5 p-6"><label className="block text-xs font-black uppercase tracking-[.06em] text-[#513931]">ปริมาณมาตรฐานต่อถาด<input autoFocus type="number" min="0.001" step="0.001" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-lg font-black outline-none focus:shadow-[3px_3px_0_#B97861]" /><span className="mt-2 block text-xs font-bold text-[#80675F]">หน่วยฐานข้อมูล: kg / ถาด · เท่ากับ {valid ? `${formatGrams(numericValue)} g / ถาด` : 'กรุณาระบุค่ามากกว่า 0'}</span></label><div className="rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-4 py-3 text-xs font-bold leading-5 text-[#60483F]">ค่านี้ใช้เป็นพอร์ชั่นมาตรฐานตอนแปลงวัตถุดิบจากน้ำหนักเป็นจำนวนถาด และไม่ใช่จำนวนถาดที่มีอยู่ในคลัง</div></div><footer className="flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end"><button type="button" onClick={onReset} disabled={saving} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black disabled:opacity-50">คืนค่าจาก API</button><button type="button" onClick={() => { void onSave() }} disabled={!valid || saving} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึก Preset'}</button></footer></section></div>
}

function Stat({ label, value, note, color, sign }: { label: string; value: number; note: string; color: string; sign: string }) {
  return <article className={`relative overflow-hidden rounded-[22px] border-2 border-[#2D1B17] p-5 shadow-[5px_5px_0_#2D1B17] ${color}`}><span className="absolute right-4 top-2 text-4xl font-black opacity-20">{sign}</span><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#775B51]">{label}</p><p className="mt-2 text-4xl font-black">{String(value).padStart(2, '0')}</p><p className="mt-1 text-xs font-bold text-[#765F56]">{note}</p></article>
}

function formatKg(value: number) { return Number.isFinite(value) ? value.toFixed(3) : '—' }
function formatGrams(value: number) { return Number.isFinite(value) ? Math.round(value * 1000).toLocaleString('th-TH') : '—' }
function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg> }
