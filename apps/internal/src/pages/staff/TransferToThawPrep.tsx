import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useInventory } from '../../contexts/InventoryContext'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'
import type { InventoryBatch } from '../../types/inventory'

const field = 'mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-3.5 py-3 font-semibold text-[#2D1B17] outline-none transition focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#DBC8B8]'

type FreezerIngredient = {
  id: string
  name: string
  lots: InventoryBatch[]
  totalMilliKg: number
}

type FifoTransferResponse = {
  transfer: {
    quantityKg: number
    totalPlateCount: number
    allocations: Array<{ prepLotId: string }>
  }
}

function quantityMilliKg(batch: InventoryBatch) {
  return Math.round(Number.parseFloat(batch.qty) * 1000)
}

export default function TransferStocksPage() {
  const { batches, loading: inventoryLoading, error: inventoryError, refresh } = useInventory()
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [presetLoading, setPresetLoading] = useState(true)
  const [presetError, setPresetError] = useState('')
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [trayQuantity, setTrayQuantity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    apiFetch<{ ingredients: IngredientPreset[] }>('/inventory/ingredients')
      .then((data) => setIngredients(data.ingredients))
      .catch((caught) => setPresetError(caught instanceof Error ? caught.message : 'Unable to load portion presets'))
      .finally(() => setPresetLoading(false))
  }, [])

  const freezerIngredients = useMemo(() => {
    const grouped = new Map<string, FreezerIngredient>()
    for (const batch of batches) {
      if (batch.category !== 'Meat' || batch.status === 'Expired' || !batch.location?.toLowerCase().includes('freezer')) continue
      const milliKg = quantityMilliKg(batch)
      if (!batch.ingredientId || !Number.isFinite(milliKg) || milliKg <= 0) continue
      const current = grouped.get(batch.ingredientId)
      if (current) {
        current.lots.push(batch)
        current.totalMilliKg += milliKg
      } else {
        grouped.set(batch.ingredientId, { id: batch.ingredientId, name: batch.item, lots: [batch], totalMilliKg: milliKg })
      }
    }

    return [...grouped.values()]
      .map((ingredient) => ({
        ...ingredient,
        lots: ingredient.lots.sort((a, b) => (
          (a.expiryAt ?? a.expireDate).localeCompare(b.expiryAt ?? b.expireDate)
          || (a.receivedAt ?? a.receiveDate).localeCompare(b.receivedAt ?? b.receiveDate)
          || Number.parseInt(a.id.replace(/\D/g, ''), 10) - Number.parseInt(b.id.replace(/\D/g, ''), 10)
        )),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [batches])

  const selectedIngredient = freezerIngredients.find((ingredient) => ingredient.id === selectedIngredientId)
  const selectedPreset = ingredients.find((ingredient) => ingredient.id === selectedIngredientId)
  const portionMilliKg = Math.round((selectedPreset?.defaultPortionSizeKg ?? 0) * 1000)
  const transferKg = Number(quantity)
  const scaledTransferKg = transferKg * 1000
  const transferMilliKg = Math.round(scaledTransferKg)
  const validPrecision = Math.abs(scaledTransferKg - transferMilliKg) <= 1e-7
  const requestedPlateCount = Number(trayQuantity)
  const validPlateCount = Number.isSafeInteger(requestedPlateCount) && requestedPlateCount > 0
  const maxPlateCount = selectedIngredient && portionMilliKg > 0
    ? selectedIngredient.lots.reduce((total, lot) => total + Math.floor(quantityMilliKg(lot) / portionMilliKg), 0)
    : 0
  const exactPortionWeight = validPrecision && transferMilliKg > 0 && portionMilliKg > 0 && transferMilliKg % portionMilliKg === 0
  const kgNotDivisible = Boolean(quantity && Number.isFinite(transferKg) && transferKg > 0 && validPrecision && portionMilliKg > 0 && !exactPortionWeight)

  const allocationPlan = useMemo(() => {
    if (!selectedIngredient || !validPlateCount || portionMilliKg <= 0) {
      return { allocations: [], unallocatedPlateCount: 0 }
    }

    const planned = selectedIngredient.lots.map((lot) => ({
      lot,
      sourceRemainingMilliKg: quantityMilliKg(lot),
      quantityMilliKg: 0,
      plateCount: 0,
    }))
    let unallocatedPlateCount = requestedPlateCount
    for (const allocation of planned) {
      if (unallocatedPlateCount <= 0) break
      allocation.plateCount = Math.min(
        Math.floor(allocation.sourceRemainingMilliKg / portionMilliKg),
        unallocatedPlateCount,
      )
      allocation.quantityMilliKg = allocation.plateCount * portionMilliKg
      unallocatedPlateCount -= allocation.plateCount
    }

    return {
      allocations: planned.filter((allocation) => allocation.quantityMilliKg > 0),
      unallocatedPlateCount,
    }
  }, [portionMilliKg, requestedPlateCount, selectedIngredient, validPlateCount])

  const allocationPreview = allocationPlan.allocations
  const plateCount = allocationPreview.reduce((total, allocation) => total + allocation.plateCount, 0)
  const exactTransferMilliKg = validPlateCount ? requestedPlateCount * portionMilliKg : 0
  const exceedsAvailable = selectedIngredient ? exactTransferMilliKg > selectedIngredient.totalMilliKg : false
  const fullPortionShortfall = allocationPlan.unallocatedPlateCount > 0
  const validQuantity = Boolean(selectedIngredient && selectedPreset && validPlateCount && exactPortionWeight && requestedPlateCount === plateCount && !exceedsAvailable && !fullPortionShortfall)
  const nearbyPlateOptions = useMemo(() => {
    if (!kgNotDivisible || portionMilliKg <= 0 || maxPlateCount <= 0) return []
    const lower = Math.floor(transferMilliKg / portionMilliKg)
    const upper = Math.ceil(transferMilliKg / portionMilliKg)
    return [...new Set([lower, upper, maxPlateCount])]
      .filter((count) => count > 0 && count <= maxPlateCount)
      .sort((a, b) => Math.abs(a * portionMilliKg - transferMilliKg) - Math.abs(b * portionMilliKg - transferMilliKg))
      .slice(0, 2)
  }, [kgNotDivisible, maxPlateCount, portionMilliKg, transferMilliKg])

  const clearForm = () => {
    setSelectedIngredientId('')
    setQuantity('')
    setTrayQuantity('')
  }

  const handleKgChange = (value: string) => {
    setQuantity(value)
    const kg = Number(value)
    const scaled = kg * 1000
    const milliKg = Math.round(scaled)
    const exactPrecision = Math.abs(scaled - milliKg) <= 1e-7
    if (value && Number.isFinite(kg) && kg > 0 && exactPrecision && portionMilliKg > 0 && milliKg % portionMilliKg === 0) {
      setTrayQuantity(String(milliKg / portionMilliKg))
    } else {
      setTrayQuantity('')
    }
  }

  const handleTrayChange = (value: string) => {
    setTrayQuantity(value)
    const count = Number(value)
    if (value && Number.isSafeInteger(count) && count > 0 && portionMilliKg > 0) {
      setQuantity(((count * portionMilliKg) / 1000).toFixed(3))
    } else {
      setQuantity('')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedIngredient || !validQuantity || submitting) return
    setSubmitting(true)
    setSubmitError('')
    setSuccessMessage('')
    try {
      const response = await apiFetch<FifoTransferResponse>(`/inventory/ingredients/${encodeURIComponent(selectedIngredient.id)}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ plateCount: requestedPlateCount }),
      })
      await refresh()
      const prepLots = response.transfer.allocations.filter((allocation) => allocation.prepLotId).length
      setSuccessMessage(`โอนสำเร็จ ${response.transfer.quantityKg.toFixed(3)} kg เป็น ${response.transfer.totalPlateCount} ถาด จาก ${response.transfer.allocations.length} ล็อตต้นทาง และสร้าง ${prepLots} Prep sub-lot`)
      clearForm()
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : 'ไม่สามารถโอนย้ายวัตถุดิบได้')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border-[22px] border-white/45" />
        <span className="relative inline-flex rotate-[2deg] rounded-full border-2 border-[#2D1B17] bg-[#DBC8B8] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">FIFO MULTI-LOT ↗</span>
        <h1 className="relative mt-4 text-4xl font-black tracking-[-.035em]">โอนย้ายวัตถุดิบ</h1>
        <p className="relative mt-2 text-sm font-bold text-[#6D5147]">ระบุยอดรวมที่ต้องเตรียม ระบบจะหยิบข้ามล็อตตามวันหมดอายุอัตโนมัติ</p>
      </header>

      {(inventoryError || presetError || submitError) && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{inventoryError || presetError || submitError}</div>}
      {successMessage && <div className="mb-5 rounded-2xl border-2 border-green-800 bg-green-50 px-5 py-4 text-sm font-bold text-green-800">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="anim-up d-2 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
        <div className="border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5">
          <div className="flex flex-wrap items-center gap-3"><span className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2 text-xs font-black text-white">FREEZER</span><span className="text-2xl font-black">→</span><span className="rounded-xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#2D1B17]">PREP FRIDGE</span></div>
          <p className="mt-3 text-xs font-bold text-[#72564D]">ระบบล็อกล็อตและหัก FIFO ใน transaction เดียว โดยไม่รวมประวัติของแต่ละล็อต</p>
        </div>

        <div className="space-y-5 p-6">
          <Field label="เลือกวัตถุดิบ">
            <select value={selectedIngredientId} onChange={(event) => { setSelectedIngredientId(event.target.value); setQuantity(''); setTrayQuantity('') }} className={field} disabled={inventoryLoading}>
              <option value="">{inventoryLoading ? 'กำลังโหลดสต็อก…' : 'เลือกเนื้อจาก Freezer'}</option>
              {freezerIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} — รวม {formatKg(ingredient.totalMilliKg / 1000)} kg — {ingredient.lots.length} ล็อต</option>)}
            </select>
          </Field>

          {selectedIngredient && <div className="grid gap-4 rounded-2xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-4 sm:grid-cols-3"><Info label="วัตถุดิบ" value={selectedIngredient.name} /><Info label="คงเหลือรวม" value={`${formatKg(selectedIngredient.totalMilliKg / 1000)} kg`} /><Info label="ล็อตที่พร้อมใช้" value={`${selectedIngredient.lots.length} ล็อต`} /></div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="จำนวนรวมที่ต้องหั่น (kg)"><input type="number" min="0.001" step="0.001" max={selectedIngredient ? selectedIngredient.totalMilliKg / 1000 : undefined} value={quantity} onChange={(event) => handleKgChange(event.target.value)} disabled={!selectedPreset} required className={field} placeholder="เช่น 49.800" /></Field>
            <Field label="จำนวนถาดรวม"><input type="number" min="1" step="1" max={maxPlateCount || undefined} value={trayQuantity} onChange={(event) => handleTrayChange(event.target.value)} disabled={!selectedPreset} required className={field} placeholder="เช่น 166" /></Field>
          </div>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#79594D]">Preset ของ Owner</p>{presetLoading ? <p className="mt-2 text-sm font-black">กำลังโหลด…</p> : selectedPreset ? <><p className="mt-2 text-3xl font-black">{formatKg(selectedPreset.defaultPortionSizeKg)} kg</p><p className="mt-1 text-xs font-bold text-[#765F56]">= {formatGrams(selectedPreset.defaultPortionSizeKg)} g / ถาด</p></> : <p className="mt-2 text-sm font-black text-[#8B5746]">เลือกวัตถุดิบเพื่อดู Preset</p>}</div>
            <div className="rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] p-5 text-[#2D1B17]"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#563128]">ผลลัพธ์รวม</p><p className="mt-2 text-4xl font-black">{validPlateCount ? `${requestedPlateCount} ถาด` : '—'}</p><p className="mt-1 text-xs font-bold text-[#563128]">หักจริง {validPlateCount ? (exactTransferMilliKg / 1000).toFixed(3) : '0.000'} kg · เศษทุกล็อตคงอยู่ใน Freezer</p></div>
          </section>

          {kgNotDivisible && <div className="rounded-xl border-2 border-amber-700 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">{formatKg(transferKg)} kg แบ่งไม่ลงตัวตาม Preset {formatKg(portionMilliKg / 1000)} kg/ถาด จึงยังยืนยันไม่ได้{nearbyPlateOptions.length > 0 ? ` · ค่าที่ทำได้ใกล้สุด: ${nearbyPlateOptions.map((count) => `${count} ถาด = ${formatKg(count * portionMilliKg / 1000)} kg`).join(' หรือ ')}` : ''}</div>}
          {exceedsAvailable && <div className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">จำนวนที่ระบุเกินสต็อกสดใน Freezer</div>}
          {fullPortionShortfall && !exceedsAvailable && <div className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">สต็อกกระจายเป็นเศษย่อยหลายล็อตจนจัดเป็นถาดเต็มโดยไม่ผสมล็อตไม่ได้</div>}
          {!validPrecision && quantity && <div className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">จำนวน kg รองรับทศนิยมไม่เกิน 3 ตำแหน่ง</div>}

          {allocationPreview.length > 0 && !exceedsAvailable && (
            <section className="overflow-hidden rounded-2xl border-2 border-[#2D1B17]">
              <div className="border-b-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-3 text-xs font-black text-white">แผนหยิบ FIFO ก่อนยืนยัน</div>
              <div className="divide-y-2 divide-[#2D1B17]">
                {allocationPreview.map((allocation, index) => <div key={allocation.lot.id} className="grid gap-2 bg-[#FFFDF9] px-4 py-3 text-xs font-bold sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#DBC8B8] font-black">{index + 1}</span><span>{allocation.lot.batch} · หมด {allocation.lot.expireDate}</span><span className="font-black">{(allocation.quantityMilliKg / 1000).toFixed(3)} kg → {allocation.plateCount} ถาด</span></div>)}
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5 sm:flex-row sm:justify-end"><button type="reset" onClick={clearForm} disabled={submitting} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">ล้างข้อมูล</button><button type="submit" disabled={!validQuantity || submitting} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#D9B99A] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'กำลังหัก FIFO และสร้าง Prep Lot…' : 'ยืนยันโอนตาม FIFO →'}</button></footer>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-black uppercase tracking-[.06em] text-[#513931]">{label}{children}</label> }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#8A7067]">{label}</p><p className="mt-1 text-sm font-black text-[#2D1B17]">{value}</p></div> }
function formatKg(value: number) { return Number.isFinite(value) ? value.toFixed(3) : '—' }
function formatGrams(value: number) { return Number.isFinite(value) ? Math.round(value * 1000).toLocaleString('th-TH') : '—' }
