import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useInventory } from '../../contexts/InventoryContext'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'
import type { InventoryBatch } from '../../types/inventory'

type Category = Extract<InventoryBatch['category'], 'Meat' | 'Vegetable'>
type Unit = 'kg' | 'plates'
type DraftLine = {
  id: string
  ingredientId: string
  item: string
  category: Category
  quantity: string
  unit: Unit
  unitCost: string
  expireDate: string
}

const field = 'mt-1.5 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-4 py-3 text-sm font-semibold text-[#2D1B17] outline-none transition-all duration-300 placeholder:text-[#A99188] hover:bg-white focus:-translate-y-1 focus:shadow-[4px_4px_0_#B97861] focus:border-[#2D1B17] disabled:cursor-not-allowed disabled:bg-[#F1E2CF] disabled:opacity-70'
const today = new Date().toISOString().slice(0, 10)

function createDraftLine(): DraftLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ingredientId: '',
    item: '',
    category: 'Meat',
    quantity: '',
    unit: 'kg',
    unitCost: '',
    expireDate: '',
  }
}

const categoryLabel: Record<Category, string> = {
  Meat: 'เนื้อสัตว์',
  Vegetable: 'ผัก',
}

export default function AddLotPage() {
  const { receiveLot } = useInventory()
  const [entry, setEntry] = useState<DraftLine>(() => createDraftLine())
  const [lines, setLines] = useState<DraftLine[]>([])
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [ingredientLoading, setIngredientLoading] = useState(true)
  const [ingredientError, setIngredientError] = useState('')
  const [reference, setReference] = useState('')
  const [receiveDate, setReceiveDate] = useState(today)
  const [savedLot, setSavedLot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [creatingIngredient, setCreatingIngredient] = useState(false)
  const [newCategory, setNewCategory] = useState<'meat' | 'vegetable'>('meat')

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<{ ingredients: IngredientPreset[] }>('/inventory/ingredients')
      .then((data) => setIngredients(data.ingredients))
      .catch((caught) => setIngredientError(caught instanceof Error ? caught.message : 'โหลดทะเบียนวัตถุดิบไม่สำเร็จ'))
      .finally(() => setIngredientLoading(false))
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [lines.length])

  const totalValue = useMemo(
    () => lines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitCost || 0), 0),
    [lines],
  )

  function updateEntry<K extends keyof DraftLine>(key: K, value: DraftLine[K]) {
    setEntry((current) => ({ ...current, [key]: value }))
  }

  function handleIngredientChange(value: string) {
    const normalizedValue = value.trim().toLocaleLowerCase('th-TH')
    const ingredient = ingredients.find((candidate) => candidate.name.trim().toLocaleLowerCase('th-TH') === normalizedValue)
    setEntry((current) => ({
      ...current,
      ingredientId: ingredient?.id ?? '',
      item: ingredient?.name ?? value,
      category: ingredient?.category === 'vegetable' ? 'Vegetable' : 'Meat',
      unit: ingredient?.category === 'vegetable' ? current.unit : 'kg',
    }))
  }

  async function createIngredient() {
    const name = entry.item.trim()
    setError('')
    if (!name) return setError('กรอกชื่อวัตถุดิบใหม่ก่อน')
    setCreatingIngredient(true)
    try {
      const data = await apiFetch<{ ingredient: IngredientPreset }>('/inventory/ingredients', {
        method: 'POST',
        body: JSON.stringify({ name, category: newCategory }),
      })
      setIngredients((current) => [...current, data.ingredient].sort((a, b) => a.name.localeCompare(b.name, 'th')))
      setEntry((current) => ({ ...current, ingredientId: data.ingredient.id, item: data.ingredient.name, category: newCategory === 'meat' ? 'Meat' : 'Vegetable', unit: newCategory === 'meat' ? 'kg' : 'plates' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้างวัตถุดิบใหม่ไม่สำเร็จ')
    } finally {
      setCreatingIngredient(false)
    }
  }

  function addLine() {
    setError('')
    setSavedLot(null)
    if (!entry.ingredientId) {
      setError('กรุณาเลือกวัตถุดิบจากทะเบียน ห้ามใช้ชื่อที่พิมพ์ขึ้นเอง')
      return
    }
    if (!entry.quantity || !entry.expireDate || entry.unitCost.trim() === '') {
      setError('กรอกจำนวน ต้นทุน และวันหมดอายุให้ครบก่อนเพิ่มเข้ารายการ')
      return
    }
    if (!Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0) {
      setError('จำนวนต้องมากกว่า 0')
      return
    }
    if (entry.unit === 'plates' && !Number.isInteger(Number(entry.quantity))) {
      setError('จำนวนจานต้องเป็นจำนวนเต็ม')
      return
    }
    if (!Number.isFinite(Number(entry.unitCost)) || Number(entry.unitCost) < 0) {
      setError('ต้นทุนต่อหน่วยต้องเป็น 0 หรือมากกว่า')
      return
    }

    setLines((current) => [...current, { ...entry, item: entry.item.trim(), id: `${Date.now()}-${current.length}` }])
    setEntry(createDraftLine())
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  async function submitLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedLot(null)
    setError('')
    if (!reference.trim()) {
      setError('กรอกเลขใบเสร็จส่งของก่อนยืนยัน LOT')
      return
    }
    if (!lines.length) {
      setError('เพิ่มวัตถุดิบอย่างน้อย 1 รายการก่อนยืนยันรับเข้า')
      return
    }

    setSubmitting(true)
    try {
      const lotId = await receiveLot({
        reference: reference.trim(),
        receiveDate,
        items: lines.map((line) => ({
          ingredientId: line.ingredientId,
          qty: `${line.quantity} ${line.unit}`,
          expireDate: line.expireDate,
          unitCost: Number(line.unitCost),
        })),
      })
      setSavedLot(lotId)
      setLines([])
      setReference('')
      setEntry(createDraftLine())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึก LOT ไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <header className="anim-down d-1 relative mb-8 overflow-hidden rounded-[32px] border-2 border-[#2D1B17] bg-gradient-to-br from-[#D9B99A] to-[#E8D8CA] px-8 py-10 shadow-[8px_8px_0_#2D1B17] transition-all hover:shadow-[12px_12px_0_#2D1B17] group">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/20 blur-3xl transition-transform duration-700 group-hover:scale-150 group-hover:bg-white/30" />
        <span className="relative z-10 inline-flex origin-bottom-left rotate-[-3deg] animate-[bounce_2s_infinite] items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-4 py-1.5 text-[11px] font-black tracking-wider text-[#2D1B17] shadow-[3px_3px_0_#2D1B17]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B97861] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B97861]"></span>
          </span>
          DATABASE INTAKE ✦
        </span>
        <h1 className="relative z-10 mt-6 text-5xl font-black tracking-tight text-[#2D1B17] drop-shadow-sm">รับของเข้าคลัง</h1>
        <p className="relative z-10 mt-3 max-w-2xl text-base font-bold text-[#73552E] opacity-90">หยิบวัตถุดิบหลายรายการใส่ LOT เดียว แล้วกดยืนยันเพื่อเพิ่มสต็อกพร้อมกัน</p>
      </header>

      <section className="anim-down d-2 mb-8 grid gap-4 sm:grid-cols-3" aria-label="สถานะการรับเข้า">
        <StatusStep number="01" label="กรอกข้อมูล" active={lines.length === 0} done={lines.length > 0} />
        <StatusStep number="02" label={`จัดรายการเข้าคิว ${lines.length ? `(${lines.length})` : ''}`} active={lines.length > 0} done={false} />
        <StatusStep number="03" label="ยืนยันเพิ่มสต็อก" active={false} done={false} />
      </section>

      <div className={`overflow-hidden transition-all duration-500 ${savedLot ? 'mb-6 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        {savedLot && (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] px-6 py-5 text-white shadow-[6px_6px_0_#2D1B17]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2D1B17] bg-white text-xl font-black text-emerald-700">✓</div>
            <div>
              <p className="text-lg font-black">เพิ่มสต็อกสำเร็จ!</p>
              <p className="text-sm font-bold opacity-90">รายการถูกบันทึกลงใน LOT #{savedLot} เรียบร้อยแล้ว</p>
            </div>
          </div>
        )}
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${(error || ingredientError) ? 'mb-6 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        {(error || ingredientError) && (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-red-800 bg-[#FFF0F0] px-6 py-5 text-red-800 shadow-[6px_6px_0_#991B1B]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-red-800 bg-red-100 text-lg font-black">!</div>
            <div className="font-bold">{error || ingredientError}</div>
          </div>
        )}
      </div>

      <form onSubmit={submitLot}>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(400px,.8fr)]">
          <section className="anim-up d-3 flex flex-col overflow-hidden rounded-[32px] border-2 border-[#2D1B17] bg-white shadow-[8px_8px_0_#2D1B17] transition-all hover:shadow-[12px_12px_0_#2D1B17]">
            <div className="relative border-b-2 border-[#2D1B17] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-[#E7C7B8] px-8 py-6">
              <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent"></div>
              <div className="relative z-10">
                <p className="inline-block rounded-full bg-white/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#8B5746] backdrop-blur-sm shadow-sm">Goods receiving</p>
                <h2 className="mt-3 text-2xl font-black text-[#2D1B17]">เพิ่มวัตถุดิบเข้าคิว LOT</h2>
                <p className="mt-1.5 text-sm font-bold text-[#76564A]">ข้อมูลวันที่และเลขใบเสร็จใช้ร่วมกันทั้ง LOT</p>
              </div>
            </div>

            <div className="grid gap-6 border-b-2 border-[#2D1B17]/10 bg-[#FFFDF9] p-8 sm:grid-cols-2">
              <Field label="เลขใบเสร็จส่งของ">
                <input value={reference} onChange={(event) => setReference(event.target.value)} required className={field} placeholder="เช่น B-0817" />
              </Field>
              <Field label="วันที่รับเข้า">
                <StyledDatePicker value={receiveDate} onChange={setReceiveDate} required />
              </Field>
            </div>

            <div className="flex-1 bg-gradient-to-b from-[#FFF8EF] to-white p-8">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#8B5746]">Pick ingredients</p>
                  <h3 className="mt-1 text-xl font-black text-[#2D1B17]">รายการใหม่ที่จะหยิบใส่ LOT</h3>
                </div>
                <span className="rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA] px-4 py-1.5 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">เพิ่มทีละรายการ</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="ชื่อวัตถุดิบ">
                  <IngredientCombobox
                    ingredients={ingredients}
                    value={entry.item}
                    selectedId={entry.ingredientId}
                    loading={ingredientLoading}
                    onChange={handleIngredientChange}
                  />
                  {!entry.ingredientId && entry.item.trim() && <div className="mt-3 rounded-xl border-2 border-dashed border-[#B97861] bg-[#FFF8EF] p-3"><p className="text-xs font-bold normal-case tracking-normal text-[#76564A]">ยังไม่มี “{entry.item.trim()}” ในทะเบียน</p><select value={newCategory} onChange={(event) => setNewCategory(event.target.value as 'meat' | 'vegetable')} className="mt-3 w-full rounded-lg border border-[#BFA99D] bg-white px-3 py-2 text-xs font-bold normal-case tracking-normal"><option value="meat">เนื้อสัตว์</option><option value="vegetable">ผัก</option></select><p className="mt-2 text-[11px] font-semibold normal-case tracking-normal text-[#8B5746]">ขนาดต่อถาดกำหนดและแก้ไขได้โดย Owner เท่านั้น</p><button type="button" disabled={creatingIngredient} onClick={() => void createIngredient()} className="mt-3 w-full rounded-lg bg-[#2D1B17] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{creatingIngredient ? 'กำลังสร้าง…' : `+ สร้างวัตถุดิบ “${entry.item.trim()}”`}</button></div>}
                </Field>
                <Field label="หมวดวัตถุดิบ">
                  <div className="relative">
                    <input disabled value={entry.ingredientId ? categoryLabel[entry.category] : 'เลือกวัตถุดิบก่อน'} className={`${field} ${entry.ingredientId ? 'bg-white' : ''}`} />
                  </div>
                </Field>
                <Field label="พื้นที่จัดเก็บ">
                  <input disabled value={entry.ingredientId ? (entry.category === 'Meat' ? 'Freezer (kg)' : 'ตู้พักละลาย (plate)') : 'เลือกวัตถุดิบก่อน'} className={`${field} ${entry.ingredientId ? 'bg-white text-blue-900' : ''}`} />
                </Field>
                <Field label="จำนวน">
                  <input value={entry.quantity} onChange={(event) => updateEntry('quantity', event.target.value)} type="number" min={entry.unit === 'plates' ? '1' : '0.001'} step={entry.unit === 'plates' ? '1' : '0.001'} className={field} placeholder={entry.unit === 'plates' ? '0' : '0.000'} />
                </Field>
                <Field label="หน่วย">
                  <select value={entry.unit} onChange={(event) => updateEntry('unit', event.target.value as Unit)} disabled={!entry.ingredientId || entry.category === 'Meat'} className={`${field} appearance-none cursor-pointer`}>
                    <option value="kg">kg</option>
                    {entry.category === 'Vegetable' && <option value="plates">plates</option>}
                  </select>
                </Field>
                <Field label={`ต้นทุนต่อ${entry.unit === 'plates' ? 'จาน' : 'kg'} (บาท)`}>
                  <input value={entry.unitCost} onChange={(event) => updateEntry('unitCost', event.target.value)} type="number" min="0" step="0.01" className={field} placeholder="0.00" />
                </Field>
                <Field label="วันหมดอายุ">
                  <StyledDatePicker value={entry.expireDate} onChange={(v) => updateEntry('expireDate', v)} />
                </Field>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="group relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-[#2D1B17] bg-[#B97861] px-6 py-4 text-base font-black text-white shadow-[6px_6px_0_#2D1B17] transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0_#2D1B17] active:translate-y-1 active:shadow-[2px_2px_0_#2D1B17]"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></span>
                <span className="relative z-10 text-lg font-black leading-none">+</span>
                <span className="relative z-10">เพิ่มรายการนี้เข้า LOT</span>
              </button>
            </div>
          </section>

          <aside className="anim-up d-4 flex h-[800px] flex-col overflow-hidden rounded-[32px] border-2 border-[#2D1B17] bg-[#2D1B17] text-white shadow-[8px_8px_0_#B97861] transition-all hover:shadow-[12px_12px_0_#B97861] xl:sticky xl:top-6">
            <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b-2 border-white/10 bg-[#3A2620] px-7 py-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#D9B99A]">LOT staging zone</p>
                <h2 className="mt-2 text-2xl font-black flex items-center gap-2">
                  รายการที่รอยืนยัน
                  {lines.length > 0 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white shadow-sm">{lines.length}</span>}
                </h2>
              </div>
              <span className={`relative flex h-3 w-3 mt-2`}>
                {lines.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${lines.length ? 'bg-green-500' : 'bg-gray-500'}`}></span>
              </span>
            </div>

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-6 scroll-smooth scrollbar-thin scrollbar-thumb-[#513931] scrollbar-track-transparent">
              {!lines.length ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D9B99A]/40 bg-white/5 p-8 text-center transition-all">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#D9B99A]/40 bg-white/10 text-xl font-black text-[#D9B99A]">
                    +
                  </div>
                  <p className="mt-6 text-lg font-black text-white">ยังไม่มีรายการใน LOT</p>
                  <p className="mt-2 text-sm font-bold text-[#D9B99A]/80">เพิ่มวัตถุดิบทางซ้าย แล้วรายการจะมาอยู่ที่โซนนี้</p>
                </div>
              ) : lines.map((line, index) => (
                <article key={line.id} className="anim-right group relative rounded-2xl border-2 border-[#D9B99A] bg-[#513931] p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0_#D9B99A]">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#E7C7B8] text-sm font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-white">{line.item}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#D9B99A]">{categoryLabel[line.category]}</span>
                        <span className="text-[10px] font-bold text-[#D9B99A]/60">•</span>
                        <span className="text-[10px] font-bold text-[#D9B99A]">{line.category === 'Meat' ? 'Freezer' : 'ตู้พักละลาย'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => removeLine(line.id)}
                      className="flex items-center gap-1 rounded-lg border-2 border-rose-500/50 bg-rose-950/60 px-2.5 py-1 text-xs font-black text-rose-300 transition-all hover:border-rose-500 hover:bg-rose-600 hover:text-white disabled:opacity-50"
                      title="ลบรายการ"
                    >
                      <span>✕</span>
                      <span>ลบ</span>
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs font-bold text-[#E8D8CA]">
                    <div className="rounded-lg bg-black/20 p-2">
                      <span className="text-[10px] text-[#D9B99A]">จำนวน</span>
                      <strong className="mt-0.5 block text-sm text-white">{line.quantity} {line.unit}</strong>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <span className="text-[10px] text-[#D9B99A]">ต้นทุน</span>
                      <strong className="mt-0.5 block text-sm text-white">฿{Number(line.unitCost).toFixed(2)}<span className="text-[10px] font-normal">/{line.unit === 'plates' ? 'จาน' : 'kg'}</span></strong>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <span className="text-[10px] text-[#D9B99A]">หมดอายุ</span>
                      <strong className="mt-0.5 block text-sm text-white">{line.expireDate}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex-shrink-0 border-t-2 border-white/10 bg-[#3A2620] px-7 py-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#D9B99A]">ยอดรวมมูลค่า LOT</p>
                  <p className="mt-1.5 text-sm font-bold text-white/80">{lines.length ? `พร้อมยืนยัน ${lines.length} รายการ` : 'รอเพิ่มรายการ'}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black tracking-tight text-[#E8D8CA]">
                    <span className="text-xl opacity-80 mr-1">฿</span>
                    {totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer className="anim-up d-5 mt-8 flex flex-col gap-5 rounded-[32px] border-2 border-[#2D1B17] bg-[#F1E2CF] px-8 py-6 shadow-[8px_8px_0_#2D1B17] sm:flex-row sm:items-center sm:justify-between transition-all hover:shadow-[10px_10px_0_#2D1B17]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2D1B17] bg-white text-base font-black text-[#8B5746] shadow-sm">i</div>
            <p className="max-w-md text-sm font-bold text-[#76564A]">ตรวจสอบรายการในโซนสถานะให้ครบถ้วน แล้วกดยืนยันเพื่อเพิ่มสต็อกทั้งหมดใน LOT เดียว</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !lines.length}
            className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-[#2D1B17] bg-[#2D1B17] px-8 py-4 text-base font-black text-white shadow-[6px_6px_0_#B97861] transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0_#B97861] active:translate-y-1 active:shadow-[2px_2px_0_#B97861] disabled:cursor-not-allowed disabled:bg-gray-600 disabled:shadow-none disabled:transform-none"
          >
            {submitting ? (
              <>
                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังบันทึกข้อมูล...
              </>
            ) : (
              <>
                <span className="relative z-10">ยืนยันเพิ่มสต็อกทั้ง LOT</span>
                <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 font-bold">→</span>
                <div className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-0"></div>
              </>
            )}
          </button>
        </footer>
      </form>

      {/* Global styles for custom components */}
      <style>{`
        /* Custom scrollbar for webkit */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #513931;
          border-radius: 20px;
        }
        /* Date input: hide native UI but keep it clickable */
        .date-invisible {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          z-index: 10;
        }
        .date-invisible::-webkit-calendar-picker-indicator {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

function StatusStep({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`group flex items-center gap-4 rounded-[20px] border-2 border-[#2D1B17] px-5 py-4 transition-all duration-300 hover:-translate-y-1 ${done ? 'bg-[#E8D8CA] shadow-[4px_4px_0_#2D1B17]' : active ? 'bg-[#B97861] shadow-[6px_6px_0_#2D1B17] scale-[1.02]' : 'bg-white shadow-[4px_4px_0_#2D1B17] opacity-80 hover:opacity-100'}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] text-sm font-black transition-colors ${active && !done ? 'text-[#B97861]' : 'text-[#2D1B17]'}`}>
        {done ? '✓' : number}
      </span>
      <div className="flex flex-col min-w-0">
        <span className={`text-sm font-black truncate ${active && !done ? 'text-white' : 'text-[#2D1B17]'}`}>{label}</span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-xs font-black uppercase tracking-wider text-[#513931]">
      <span className="mb-1.5">{label}</span>
      {children}
    </label>
  )
}

// ─── Custom Ingredient Combobox ─────────────────────────────────────────────

type IngredientComboboxProps = {
  ingredients: IngredientPreset[]
  value: string
  selectedId: string
  loading: boolean
  onChange: (value: string) => void
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const lower = text.toLocaleLowerCase('th-TH')
  const queryLower = query.trim().toLocaleLowerCase('th-TH')
  const idx = lower.indexOf(queryLower)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#E7C7B8] text-[#2D1B17] rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function IngredientCombobox({ ingredients, value, selectedId, loading, onChange }: IngredientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useCallback(() => {
    const q = value.trim().toLocaleLowerCase('th-TH')
    if (!q) return ingredients
    return ingredients.filter((ing) => ing.name.toLocaleLowerCase('th-TH').includes(q))
  }, [value, ingredients])

  const results = filtered()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      setHoveredIdx(0)
      return
    }
    if (e.key === 'ArrowDown') {
      setHoveredIdx((i) => Math.min(i + 1, results.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setHoveredIdx((i) => Math.max(i - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter' && hoveredIdx >= 0 && results[hoveredIdx]) {
      onChange(results[hoveredIdx].name)
      setOpen(false)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const fieldClass = 'mt-1.5 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-4 py-3 text-sm font-semibold text-[#2D1B17] outline-none transition-all duration-300 placeholder:text-[#A99188] hover:bg-white focus:-translate-y-1 focus:shadow-[4px_4px_0_#B97861] disabled:cursor-not-allowed disabled:bg-[#F1E2CF] disabled:opacity-70'

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {/* Search icon */}
        <svg className="absolute left-3.5 top-1/2 mt-0.5 -translate-y-1/2 h-4 w-4 text-[#A99188] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHoveredIdx(-1) }}
          onFocus={() => { setOpen(true); setHoveredIdx(-1) }}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className={`${fieldClass} pl-10 pr-10`}
          placeholder={loading ? 'กำลังโหลดทะเบียน…' : 'พิมพ์เพื่อค้นหาและเลือก'}
          autoComplete="off"
        />
        {/* Right indicator */}
        <div className="absolute right-3.5 top-1/2 mt-0.5 -translate-y-1/2 pointer-events-none">
          {selectedId ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black">✓</span>
          ) : (
            <svg className={`h-4 w-4 text-[#A99188] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          )}
        </div>
      </div>

      {/* Status hint */}
      <div className="h-5 mt-1">
        <span className={`block text-[11px] font-bold normal-case tracking-normal transition-all duration-300 ${selectedId ? 'text-emerald-600 opacity-100' : 'text-[#8B5746] opacity-80'}`}>
          {selectedId ? `✓ เลือกจากทะเบียนแล้ว · ID ${selectedId}` : 'ต้องเลือกชื่อที่มีในรายการ เพื่อป้องกันสต็อกชื่อซ้ำ'}
        </span>
      </div>

      {/* Dropdown */}
      <div
        className={`absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border-2 border-[#2D1B17] bg-white shadow-[6px_6px_0_#2D1B17] transition-all duration-200 origin-top ${
          open && results.length > 0
            ? 'scale-y-100 opacity-100 translate-y-0'
            : 'scale-y-95 opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#2D1B17]/10 bg-[#F5EDE4] px-4 py-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8B5746]">
            {results.length} รายการ
          </span>
          <span className="text-[10px] font-bold text-[#A99188]">↑↓ เลือก · Enter ยืนยัน</span>
        </div>
        <ul ref={listRef} className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
          {results.map((ing, idx) => (
            <li
              key={ing.id}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(ing.name)
                setOpen(false)
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors ${
                idx === hoveredIdx ? 'bg-[#E7C7B8]' : 'hover:bg-[#FFF8EF]'
              }`}
            >
              <span className="text-sm font-semibold text-[#2D1B17]">
                <HighlightMatch text={ing.name} query={value} />
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                ing.category === 'meat'
                  ? 'border-[#B97861] bg-[#F5EDE4] text-[#B97861]'
                  : 'border-emerald-600 bg-emerald-50 text-emerald-700'
              }`}>
                {ing.category === 'meat' ? 'เนื้อสัตว์' : 'ผัก'}
              </span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm font-bold text-[#A99188]">
            ไม่พบวัตถุดิบที่ตรงกัน
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Custom Styled Date Picker ───────────────────────────────────────────────

function StyledDatePicker({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const [focused, setFocused] = useState(false)

  const displayDate = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="relative mt-1.5">
      {/* Visual display layer (pointer-events-none so the real input sits on top) */}
      <div
        className={`pointer-events-none flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-300 ${
          focused
            ? 'border-[#2D1B17] -translate-y-1 shadow-[4px_4px_0_#B97861] bg-white'
            : 'border-[#2D1B17] bg-[#FFFDF9]'
        }`}
      >
        {/* Calendar icon */}
        <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#2D1B17] transition-all duration-300 ${
          focused ? 'bg-[#B97861]' : 'bg-[#E7C7B8]'
        }`}>
          {focused && <span className="absolute inset-0 rounded-lg animate-ping bg-[#B97861] opacity-40" />}
          <svg className={`relative h-4 w-4 transition-colors duration-300 ${focused ? 'text-white' : 'text-[#73552E]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {value ? (
            <>
              <p className="text-sm font-black text-[#2D1B17] leading-tight">{displayDate}</p>
              <p className="text-[10px] font-bold text-[#A99188] mt-0.5">{value}</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-[#A99188]">คลิกเพื่อเลือกวันที่</p>
          )}
        </div>
        <svg className="h-4 w-4 shrink-0 text-[#A99188]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      </div>

      {/* Real date input — transparent, sits exactly on top, receives all click/focus events */}
      <input
        type="date"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="date-invisible"
      />
    </div>
  )
}
