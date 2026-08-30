import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'
import MenuItemsTab from './MenuItemsTab'
import PortionPresetsTab from './PortionPresetsTab'

export default function MenuManagement() {
  const [tab, setTab] = useState<'items' | 'presets'>('items')
  const [ingredients, setIngredients] = useState<IngredientPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ ingredients: IngredientPreset[] }>('/inventory/ingredients')
      .then((data) => setIngredients(data.ingredients))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load ingredients'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full max-w-[1240px]">
      <header className="relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#B97861] px-7 py-8 text-[#2D1B17] shadow-[8px_8px_0_#2D1B17] sm:px-9">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-[#FFF8EF]/30" />
        <div className="relative max-w-3xl">
          <span className="inline-flex rotate-[-2deg] rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] shadow-[2px_2px_0_#2D1B17]">Owner settings ✦</span>
          <h1 className="mt-5 text-4xl font-black tracking-[-.035em] sm:text-5xl">จัดการเมนู</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#563128]">สร้าง/แก้ไขเมนูอาหาร กำหนดวัตถุดิบที่ใช้ (BOM) และตั้งค่า preset ปริมาณต่อถาดของวัตถุดิบแต่ละชนิด</p>
        </div>
      </header>

      <div className="mb-6 inline-flex rounded-2xl border-2 border-[#2D1B17] bg-white p-1 shadow-[4px_4px_0_#2D1B17]">
        <button type="button" onClick={() => setTab('items')} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${tab === 'items' ? 'bg-[#2D1B17] text-white' : 'text-[#2D1B17]'}`}>
          เมนูอาหาร + BOM
        </button>
        <button type="button" onClick={() => setTab('presets')} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${tab === 'presets' ? 'bg-[#2D1B17] text-white' : 'text-[#2D1B17]'}`}>
          Preset ปริมาณต่อถาด
        </button>
      </div>

      {error && <div className="mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

      {tab === 'items' ? (
        <MenuItemsTab ingredients={ingredients} onError={setError} />
      ) : (
        <PortionPresetsTab ingredients={ingredients} loading={loading} setIngredients={setIngredients} onError={setError} />
      )}
    </div>
  )
}
