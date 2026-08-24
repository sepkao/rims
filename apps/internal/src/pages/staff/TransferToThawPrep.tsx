import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch } from '../../lib/api'
import { useInventory } from '../../contexts/InventoryContext'
import type { IngredientPreset } from '../../types/ingredient'

const field = 'mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-3.5 py-3 font-semibold text-[#2D1B17] outline-none transition focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#DBC8B8]'

export default function TransferStocksPage() {
  const { batches, loading: inventoryLoading, error: inventoryError } = useInventory()
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [presetLoading, setPresetLoading] = useState(true)
  const [presetError, setPresetError] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [trayQuantity, setTrayQuantity] = useState('')

  useEffect(() => {
    apiFetch<{ ingredients: IngredientPreset[] }>('/inventory/ingredients')
      .then((data) => setIngredients(data.ingredients))
      .catch((caught) => setPresetError(caught instanceof Error ? caught.message : 'Unable to load portion presets'))
      .finally(() => setPresetLoading(false))
  }, [])

  const usable = useMemo(() => batches.filter((batch) => (
    batch.status !== 'Expired' && batch.location?.toLowerCase().includes('freezer')
  )), [batches])
  const selectedBatch = usable.find((batch) => batch.id === selectedBatchId)
  const selectedIngredient = selectedBatch ? ingredients.find((ingredient) => ingredient.name.trim().toLowerCase() === selectedBatch.item.trim().toLowerCase()) : undefined
  const transferKg = Number(quantity)
  const presetKg = selectedIngredient?.defaultPortionSizeKg ?? 0
  const remainingKg = selectedBatch ? Number.parseFloat(selectedBatch.qty) : 0
  const maxTrays = presetKg > 0 && Number.isFinite(remainingKg) ? Math.floor(remainingKg / presetKg) : 0
  const requestedTrays = Number(trayQuantity)
  const plateCount = Number.isInteger(requestedTrays) && requestedTrays >= 0 ? requestedTrays : 0
  const validQuantity = Boolean(selectedIngredient) && Number.isFinite(transferKg) && transferKg > 0 && transferKg <= remainingKg && presetKg > 0 && plateCount > 0 && plateCount <= maxTrays
  const roundingLossKg = Number.isFinite(transferKg) && transferKg > 0 && presetKg > 0 ? Math.max(transferKg - plateCount * presetKg, 0) : 0
  const exceedsAvailable = Number.isFinite(transferKg) && transferKg > remainingKg
  const exceedsTrayCapacity = Number.isInteger(requestedTrays) && requestedTrays > maxTrays

  const handleQuantityChange = (value: string) => {
    setQuantity(value)
    const kg = Number(value)
    if (!value || !Number.isFinite(kg) || kg <= 0 || presetKg <= 0) {
      setTrayQuantity('')
      return
    }
    setTrayQuantity(String(Math.floor(kg / presetKg)))
  }

  const handleTrayChange = (value: string) => {
    setTrayQuantity(value)
    const trays = Number(value)
    if (!value || !Number.isInteger(trays) || trays < 0 || presetKg <= 0) {
      setQuantity('')
      return
    }
    setQuantity((trays * presetKg).toFixed(3))
  }

  const clearForm = () => {
    setSelectedBatchId('')
    setQuantity('')
    setTrayQuantity('')
  }

  return <div className="max-w-4xl"><header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17]"><div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[22px] border-white/45"/><span className="relative inline-flex rotate-[2deg] rounded-full border-2 border-[#2D1B17] bg-[#DBC8B8] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">MOVE IT! ↗</span><h1 className="relative mt-4 text-4xl font-black tracking-[-.035em]">โอนย้ายวัตถุดิบ</h1><p className="relative mt-2 text-sm font-bold text-[#6D5147]">ย้ายของจาก Freezer สู่ Prep พร้อมคำนวณจำนวนถาดจาก Preset ของ Owner</p></header>
    {(inventoryError || presetError) && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{inventoryError || presetError}</div>}
    <form onSubmit={(event) => event.preventDefault()} className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]"><div className="border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5"><div className="flex flex-wrap items-center gap-3"><span className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2 text-xs font-black text-white">❄ FREEZER</span><span className="text-2xl font-black">→</span><span className="rounded-xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17]">◫ PREP FRIDGE</span></div><p className="mt-3 text-xs font-bold text-[#72564D]">Preset ถูกกำหนดโดย Owner และ Staff แก้ไขไม่ได้</p></div>
      <div className="space-y-5 p-6"><Field label="เลือกลอตต้นทาง"><select value={selectedBatchId} onChange={(event) => { setSelectedBatchId(event.target.value); setQuantity(''); setTrayQuantity('') }} className={field} disabled={inventoryLoading}><option value="">{inventoryLoading ? 'กำลังโหลดล็อต…' : 'เลือกล็อตจาก Freezer'}</option>{usable.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch} — {batch.item} — เหลือ {batch.qty}</option>)}</select></Field>
        {selectedBatch && <div className="grid gap-4 rounded-2xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-4 sm:grid-cols-3"><Info label="วัตถุดิบ" value={selectedBatch.item} /><Info label="คงเหลือใน Freezer" value={selectedBatch.qty} /><Info label="Batch" value={`#${selectedBatch.batch}`} /></div>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="จำนวนที่ย้ายจาก Freezer (kg)"><input type="number" min="0.001" step="0.001" max={Number.isFinite(remainingKg) && remainingKg > 0 ? remainingKg : undefined} value={quantity} onChange={(event) => handleQuantityChange(event.target.value)} disabled={!selectedIngredient} required className={field} placeholder="กรอกจำนวน kg" /></Field><Field label="จำนวนถาดที่ได้รับ"><input type="number" min="1" step="1" max={maxTrays > 0 ? maxTrays : undefined} value={trayQuantity} onChange={(event) => handleTrayChange(event.target.value)} disabled={!selectedIngredient} required className={field} placeholder="กรอกจำนวนถาด" /></Field></div>
        <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#79594D]">Preset ของ Owner</p>{presetLoading ? <p className="mt-2 text-sm font-black">กำลังโหลด…</p> : selectedIngredient ? <><p className="mt-2 text-3xl font-black">{formatKg(presetKg)} kg</p><p className="mt-1 text-xs font-bold text-[#765F56]">= {formatGrams(presetKg)} g / ถาด · แก้ไขไม่ได้โดย Staff</p></> : <p className="mt-2 text-sm font-black text-[#8B5746]">{selectedBatch ? 'ไม่พบ Preset ของวัตถุดิบนี้' : 'เลือกลอตเพื่อดู Preset'}</p>}</div><div className="rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] p-5 text-[#2D1B17]"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#563128]">จำนวนถาดที่จะได้รับ</p><p className="mt-2 text-4xl font-black">{selectedIngredient && trayQuantity ? `${plateCount} ถาด` : '—'}</p><p className="mt-1 text-xs font-bold text-[#563128]">kg และถาดจะซิงค์ตาม Preset อัตโนมัติ</p></div></section>
        {selectedIngredient && (exceedsAvailable || exceedsTrayCapacity) && <div className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">จำนวนที่ระบุเกินวัตถุดิบคงเหลือ หรือเกิน {maxTrays} ถาดที่สามารถเตรียมได้จากล็อตนี้</div>}
        {selectedIngredient && Number.isFinite(transferKg) && transferKg > 0 && plateCount === 0 && <div className="rounded-xl border-2 border-[#2D1B17] bg-[#E7C7B8] px-4 py-3 text-xs font-bold text-[#60483F]">จำนวนที่ย้ายยังไม่พอสำหรับ 1 ถาดตาม Preset ของ Owner</div>}
        {selectedIngredient && validQuantity && <div className="rounded-xl border-2 border-[#2D1B17] bg-[#E8D8CA] px-4 py-3 text-xs font-bold text-[#60483F]">ระบบจะได้ {plateCount} ถาดเต็ม และปัดเศษทิ้ง {roundingLossKg.toFixed(3)} kg ตามกติกา RIMS</div>}
        {!presetLoading && selectedBatch && !selectedIngredient && <div className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">ยังไม่มี Preset สำหรับวัตถุดิบนี้ จึงยังคำนวณจำนวนถาดไม่ได้</div>}
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end"><button type="reset" onClick={clearForm} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black">ล้างข้อมูล</button><button type="submit" disabled={!validQuantity} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#D9B99A] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">ยืนยันการโอน (รอ Transfer API) →</button></footer>
    </form>
  </div>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-black uppercase tracking-[.06em] text-[#513931]">{label}{children}</label> }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#8A7067]">{label}</p><p className="mt-1 text-sm font-black text-[#2D1B17]">{value}</p></div> }
function formatKg(value: number) { return Number.isFinite(value) ? value.toFixed(3) : '—' }
function formatGrams(value: number) { return Number.isFinite(value) ? Math.round(value * 1000).toLocaleString('th-TH') : '—' }
