import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../../lib/api'

type BuffetPrices = {
  adult: number
  child: number
  senior: number
  disabled: number
}

export default function QrSettings() {
  const [prices, setPrices] = useState<BuffetPrices>({ adult: 0, child: 0, senior: 0, disabled: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiFetch<BuffetPrices>('/owner/settings/buffet-prices')
      .then(setPrices)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดราคาบุฟเฟ่ต์ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const updateField = (field: keyof BuffetPrices, value: string) => {
    setSaved(false)
    setPrices((current) => ({ ...current, [field]: Number(value) }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await apiFetch<BuffetPrices>('/owner/settings/buffet-prices', {
        method: 'PUT',
        body: JSON.stringify(prices),
      })
      setPrices(updated)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกราคาบุฟเฟ่ต์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-[720px]">
      <header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#B97861] px-7 py-8 text-[#2D1B17] shadow-[8px_8px_0_#2D1B17] sm:px-9">
        <h1 className="text-4xl font-black tracking-[-.035em]">ราคาบุฟเฟ่ต์</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#563128]">
          ร้านนี้เป็นบุฟเฟ่ต์ ราคาคิดต่อหัวตามประเภทลูกค้า ไม่มีราคาต่อจาน — ราคาที่ตั้งไว้จะถูก snapshot ใส่โต๊ะทุกครั้งที่เช็คอิน
          ไม่กระทบโต๊ะที่เปิดไปแล้วก่อนหน้า
        </p>
      </header>

      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
      {saved && <div className="mb-5 rounded-2xl border-2 border-green-700 bg-green-50 px-5 py-4 text-sm font-bold text-green-700">บันทึกราคาสำเร็จ</div>}

      {loading ? (
        <p className="text-sm font-bold text-[#7B726B]">กำลังโหลด…</p>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-[22px] border-2 border-[#2D1B17] bg-white p-6 shadow-[6px_6px_0_#2D1B17]">
          <div className="grid gap-4 sm:grid-cols-2">
            <PriceField label="ผู้ใหญ่" value={prices.adult} onChange={(v) => updateField('adult', v)} />
            <PriceField label="เด็ก" value={prices.child} onChange={(v) => updateField('child', v)} />
            <PriceField label="ผู้สูงอายุ" value={prices.senior} onChange={(v) => updateField('senior', v)} />
            <PriceField label="ผู้พิการ (ปกติ = 0, ฟรี)" value={prices.disabled} onChange={(v) => updateField('disabled', v)} />
          </div>
          <button disabled={saving} className="mt-6 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'กำลังบันทึก…' : 'บันทึกราคา'}
          </button>
        </form>
      )}
    </div>
  )
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-black uppercase tracking-wide text-[#8A7067]">
      {label}
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] px-3 py-2 text-sm font-bold"
      />
    </label>
  )
}
