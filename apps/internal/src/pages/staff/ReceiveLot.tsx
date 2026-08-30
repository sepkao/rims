import { useMemo, useState } from 'react'
import { useInventory } from '../../contexts/InventoryContext'
import type { InventoryBatch } from '../../types/inventory'

type Category = Extract<InventoryBatch['category'], 'Meat' | 'Vegetable'>
type Unit = 'kg' | 'plates'
type DraftLine = {
  id: string
  item: string
  category: Category
  quantity: string
  unit: Unit
  unitCost: string
  expireDate: string
}

const field = 'mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-3.5 py-3 font-semibold text-[#2D1B17] outline-none transition placeholder:text-[#A99188] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#B97861] disabled:cursor-not-allowed disabled:bg-[#F1E2CF]'
const today = new Date().toISOString().slice(0, 10)

function createDraftLine(category: Category = 'Meat'): DraftLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    item: '',
    category,
    quantity: '',
    unit: 'kg',
    unitCost: '',
    expireDate: '',
  }
}

const categoryLabel: Record<Category, string> = {
  Meat: '🥩 เนื้อสัตว์',
  Vegetable: '🥬 ผัก',
}

export default function AddLotPage() {
  const { receiveLot } = useInventory()
  const [entry, setEntry] = useState<DraftLine>(() => createDraftLine())
  const [lines, setLines] = useState<DraftLine[]>([])
  const [reference, setReference] = useState('')
  const [receiveDate, setReceiveDate] = useState(today)
  const [savedLot, setSavedLot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const totalValue = useMemo(
    () => lines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitCost || 0), 0),
    [lines],
  )

  function updateEntry<K extends keyof DraftLine>(key: K, value: DraftLine[K]) {
    setEntry((current) => ({ ...current, [key]: value }))
  }

  function handleCategoryChange(category: Category) {
    setEntry((current) => ({ ...current, category, unit: category === 'Meat' ? 'kg' : current.unit }))
  }

  function addLine() {
    setError('')
    setSavedLot(null)
    if (!entry.item.trim() || !entry.quantity || !entry.expireDate || entry.unitCost.trim() === '') {
      setError('กรอกข้อมูลวัตถุดิบ จำนวน ต้นทุน และวันหมดอายุให้ครบก่อนเพิ่มเข้ารายการ')
      return
    }
    if (!Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0) {
      setError('จำนวนต้องมากกว่า 0')
      return
    }
    if (!Number.isFinite(Number(entry.unitCost)) || Number(entry.unitCost) < 0) {
      setError('ต้นทุนต่อหน่วยต้องเป็น 0 หรือมากกว่า')
      return
    }

    setLines((current) => [...current, { ...entry, item: entry.item.trim(), id: `${Date.now()}-${current.length}` }])
    setEntry(createDraftLine(entry.category))
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  async function submitLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedLot(null)
    setError('')
    if (!reference.trim()) {
      setError('กรอกเลขอ้างอิงจากใบส่งของก่อนยืนยัน LOT')
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
          item: line.item,
          category: line.category,
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
    <div className="max-w-6xl">
      <header className="relative mb-6 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#D9B99A] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <span className="inline-flex rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">DATABASE INTAKE ✦</span>
        <h1 className="mt-4 text-4xl font-black tracking-[-.035em]">รับของเข้าคลัง</h1>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[#73552E]">หยิบวัตถุดิบหลายรายการใส่ LOT เดียว แล้วกดยืนยันเพื่อเพิ่มสต็อกพร้อมกัน</p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="สถานะการรับเข้า">
        <StatusStep number="01" label="กรอกข้อมูล" active={lines.length === 0} done={lines.length > 0} />
        <StatusStep number="02" label={`จัดรายการเข้าคิว ${lines.length ? `(${lines.length})` : ''}`} active={lines.length > 0} done={false} />
        <StatusStep number="03" label="ยืนยันเพิ่มสต็อก" active={false} done={false} />
      </section>

      {savedLot && <div className="mb-5 rounded-2xl border-2 border-[#2D1B17] bg-[#E8D8CA] px-5 py-4 text-sm font-black shadow-[4px_4px_0_#2D1B17]">✓ เพิ่มสต็อกสำเร็จใน LOT #{savedLot}</div>}
      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <form onSubmit={submitLot}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)]">
          <section className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
            <div className="border-b-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8B5746]">Goods receiving</p>
              <h2 className="mt-1 text-xl font-black">เพิ่มวัตถุดิบเข้าคิว LOT</h2>
              <p className="mt-1 text-xs font-bold text-[#76564A]">ข้อมูลวันที่และเลขอ้างอิงใช้ร่วมกันทั้ง LOT</p>
            </div>

            <div className="grid gap-5 border-b-2 border-[#2D1B17]/15 p-6 sm:grid-cols-2">
              <Field label="เลขอ้างอิงจากใบส่งของ">
                <input value={reference} onChange={(event) => setReference(event.target.value)} required className={field} placeholder="เช่น B-0817" />
              </Field>
              <Field label="วันที่รับเข้า">
                <input value={receiveDate} onChange={(event) => setReceiveDate(event.target.value)} required type="date" className={field} />
              </Field>
            </div>

            <div className="bg-[#FFF8EF] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B5746]">Pick ingredients</p>
                  <h3 className="mt-1 text-lg font-black">รายการใหม่ที่จะหยิบใส่ LOT</h3>
                </div>
                <span className="rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">เพิ่มทีละรายการ</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ชื่อวัตถุดิบ">
                  <input value={entry.item} onChange={(event) => updateEntry('item', event.target.value)} className={field} placeholder="เช่น หมูสามชั้นสไลด์" />
                </Field>
                <Field label="หมวดวัตถุดิบ">
                  <select value={entry.category} onChange={(event) => handleCategoryChange(event.target.value as Category)} className={field}>
                    <option value="Meat">{categoryLabel.Meat}</option>
                    <option value="Vegetable">{categoryLabel.Vegetable}</option>
                  </select>
                </Field>
                <Field label="พื้นที่จัดเก็บ">
                  <input disabled value={entry.category === 'Meat' ? 'Freezer (kg)' : 'ตู้พักละลาย (plate)'} className={field} />
                </Field>
                <Field label="จำนวน">
                  <input value={entry.quantity} onChange={(event) => updateEntry('quantity', event.target.value)} type="number" min="0.001" step="0.001" className={field} placeholder="0.000" />
                </Field>
                <Field label="หน่วย">
                  <select value={entry.unit} onChange={(event) => updateEntry('unit', event.target.value as Unit)} className={field}>
                    <option value="kg">kg</option>
                    {entry.category === 'Vegetable' && <option value="plates">plates</option>}
                  </select>
                </Field>
                <Field label="ต้นทุนต่อหน่วย (บาท)">
                  <input value={entry.unitCost} onChange={(event) => updateEntry('unitCost', event.target.value)} type="number" min="0" step="0.01" className={field} placeholder="0.00" />
                </Field>
                <Field label="วันหมดอายุ">
                  <input value={entry.expireDate} onChange={(event) => updateEntry('expireDate', event.target.value)} type="date" className={field} />
                </Field>
              </div>
              <button type="button" onClick={addLine} className="mt-5 w-full rounded-xl border-2 border-[#2D1B17] bg-[#E7C7B8] px-5 py-3 text-sm font-black text-[#2D1B17] shadow-[4px_4px_0_#2D1B17] transition hover:-translate-y-0.5">+ เพิ่มรายการนี้เข้า LOT</button>
            </div>
          </section>

          <aside className="h-fit overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-[#2D1B17] text-white shadow-[7px_7px_0_#B97861]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-white/15 px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#D9B99A]">LOT staging zone</p>
                <h2 className="mt-1 text-xl font-black">รายการที่รอยืนยัน</h2>
              </div>
              <span className={`rounded-full border-2 border-[#D9B99A] px-3 py-1 text-[10px] font-black ${lines.length ? 'bg-[#B97861]' : 'bg-white/10'}`}>{lines.length ? 'READY' : 'EMPTY'}</span>
            </div>

            <div className="max-h-[560px] space-y-3 overflow-y-auto p-5">
              {!lines.length ? (
                <div className="rounded-2xl border-2 border-dashed border-[#D9B99A]/60 px-5 py-12 text-center">
                  <p className="text-3xl">🧺</p>
                  <p className="mt-3 text-sm font-black">ยังไม่มีรายการใน LOT</p>
                  <p className="mt-1 text-xs font-bold text-[#D9B99A]">เพิ่มวัตถุดิบทางซ้าย แล้วรายการจะมาอยู่ที่โซนนี้</p>
                </div>
              ) : lines.map((line, index) => (
                <article key={line.id} className="rounded-2xl border-2 border-[#D9B99A] bg-[#513931] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#E7C7B8] text-xs font-black text-[#2D1B17]">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{line.item}</p>
                      <p className="mt-1 text-[10px] font-bold text-[#D9B99A]">{categoryLabel[line.category]} · {line.category === 'Meat' ? 'Freezer' : 'ตู้พักละลาย'}</p>
                    </div>
                    <button type="button" disabled={submitting} onClick={() => removeLine(line.id)} className="text-xs font-black text-[#F2C4B4] underline underline-offset-2 disabled:opacity-50">ลบ</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-[10px] font-bold text-[#E8D8CA]">
                    <span>จำนวน<strong className="mt-1 block text-sm text-white">{line.quantity} {line.unit}</strong></span>
                    <span>ต้นทุน<strong className="mt-1 block text-sm text-white">฿{Number(line.unitCost).toFixed(2)}</strong></span>
                    <span>หมดอายุ<strong className="mt-1 block text-sm text-white">{line.expireDate}</strong></span>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t-2 border-white/15 bg-[#513931] px-6 py-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#D9B99A]">สถานะ LOT</p>
                  <p className="mt-1 text-sm font-black">{lines.length ? `พร้อมยืนยัน ${lines.length} รายการ` : 'รอเพิ่มรายการ'}</p>
                </div>
                <p className="text-right text-xl font-black">฿{totalValue.toFixed(2)}<span className="block text-[10px] font-bold text-[#D9B99A]">มูลค่าที่กรอก</span></p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-6 flex flex-col gap-3 rounded-[22px] border-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-5 shadow-[5px_5px_0_#2D1B17] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-[#76564A]">ตรวจสอบรายการในโซนสถานะให้ครบ แล้วกดยืนยันเพื่อเพิ่มสต็อกทั้งหมดใน LOT เดียว</p>
          <button type="submit" disabled={submitting || !lines.length} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-3 text-sm font-black text-white shadow-[4px_4px_0_#B97861] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'กำลังเพิ่มสต็อก…' : 'ยืนยันเพิ่มสต็อกทั้ง LOT →'}</button>
        </footer>
      </form>
    </div>
  )
}

function StatusStep({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 border-[#2D1B17] px-4 py-3 shadow-[3px_3px_0_#2D1B17] ${done ? 'bg-[#E8D8CA]' : active ? 'bg-[#B97861]' : 'bg-white'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-[#FFF8EF] text-[10px] font-black text-[#2D1B17]">{done ? '✓' : number}</span>
      <span className="text-xs font-black text-[#2D1B17]">{label}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-black uppercase tracking-[.06em] text-[#513931]">{label}{children}</label>
}
