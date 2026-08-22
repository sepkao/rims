import { useState } from 'react'
import { useInventory } from '../../contexts/InventoryContext'
import type { InventoryBatch } from '../../mocks/inventory'

const field = 'mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-[#FFFDF9] px-3.5 py-3 font-semibold text-[#2D1B17] outline-none transition placeholder:text-[#A99188] focus:-translate-y-0.5 focus:shadow-[3px_3px_0_#B97861]'

export default function AddLotPage() {
  const { receiveBatch } = useInventory()
  const [category, setCategory] = useState<Extract<InventoryBatch['category'], 'Meat' | 'Vegetable'>>('Meat')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="max-w-4xl">
      <header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#D9B99A] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
        <span className="inline-flex rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA] px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]">DATABASE INTAKE ✦</span>
        <h1 className="mt-4 text-4xl font-black tracking-[-.035em]">รับของเข้าคลัง</h1>
        <p className="mt-2 text-sm font-bold text-[#73552E]">บันทึกล็อตจริงและสร้างรายการ stock movement อัตโนมัติ</p>
      </header>

      {saved && <div className="mb-5 rounded-2xl border-2 border-[#2D1B17] bg-[#E8D8CA] px-5 py-4 text-sm font-black shadow-[4px_4px_0_#2D1B17]">✓ บันทึกล็อตลงฐานข้อมูลแล้ว</div>}
      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      <form
        className="overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          setSubmitting(true)
          setSaved(false)
          setError('')
          try {
            await receiveBatch({
              item: String(data.get('item')),
              category,
              batch: String(data.get('batch')),
              qty: `${data.get('qty')} ${data.get('unit')}`,
              receiveDate: String(data.get('receiveDate')),
              expireDate: String(data.get('expireDate')),
              unitCost: Number(data.get('unitCost')),
            })
            form.reset()
            setSaved(true)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'บันทึกลล็อตไม่สำเร็จ')
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <div className="border-b-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8B5746]">Goods receiving</p>
          <h2 className="mt-1 text-xl font-black">รายละเอียดล็อตวัตถุดิบ</h2>
        </div>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="ชื่อวัตถุดิบ"><input name="item" required className={field} placeholder="เช่น หมูสามชั้นสไลด์" /></Field>
          <Field label="เลขอ้างอิงจากใบส่งของ"><input name="batch" required className={field} placeholder="เช่น B-0817" /></Field>
          <Field label="หมวดวัตถุดิบ">
            <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className={field}>
              <option value="Meat">🥩 เนื้อสัตว์</option>
              <option value="Vegetable">🥬 ผัก</option>
            </select>
          </Field>
          <Field label="พื้นที่จัดเก็บ"><input disabled value={category === 'Meat' ? 'Freezer (kg)' : 'ตู้พักละลาย (plate)'} className={field} /></Field>
          <Field label="จำนวน"><input name="qty" required type="number" min="0.001" step="0.001" className={field} /></Field>
          <Field label="หน่วย">
            <select name="unit" className={field}>
              <option value="kg">kg</option>
              {category === 'Vegetable' && <option value="plates">plates</option>}
            </select>
          </Field>
          <Field label="ต้นทุนต่อหน่วยที่จัดเก็บ (บาท)"><input name="unitCost" required type="number" min="0" step="0.01" className={field} /></Field>
          <Field label="วันที่รับเข้า"><input name="receiveDate" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={field} /></Field>
          <Field label="วันหมดอายุ"><input name="expireDate" required type="date" className={field} /></Field>
        </div>
        <footer className="flex justify-end border-t-2 border-[#2D1B17] bg-[#F1E2CF] px-6 py-5">
          <button disabled={submitting} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] disabled:opacity-60">
            {submitting ? 'กำลังบันทึก…' : 'ยืนยันรับเข้า →'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-black uppercase tracking-[.06em] text-[#513931]">{label}{children}</label>
}
