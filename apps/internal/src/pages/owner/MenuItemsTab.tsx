import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'

type MenuItemIngredient = {
  id: string
  name: string
  quantityRequiredPlates: number
  removable: boolean
}

type MenuItem = {
  id: string
  name: string
  description: string | null
  ingredients: MenuItemIngredient[]
}

// วัตถุดิบไม่มีรูปในระบบจริง เลยสุ่มไอคอนตามหมวดวัตถุดิบที่ผูกไว้ (ให้พอแยกเมนูออกจากกันด้วยตา)
const AVATAR_EMOJIS = ['🍲', '🥩', '🍜', '🧊', '🥢']
function avatarFor(id: string) {
  const code = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return AVATAR_EMOJIS[code % AVATAR_EMOJIS.length]
}

// state ต่อ 1 วัตถุดิบในฟอร์มฝั่งขวา — เก็บแยกจาก MenuItemIngredient เพราะฟอร์มต้องคุมค่าที่ "ยังไม่ได้บันทึก" ได้เอง
type IngredientSelection = {
  selected: boolean
  quantity: string
  removable: boolean
}

function emptySelections(ingredients: IngredientPreset[]): Record<string, IngredientSelection> {
  const map: Record<string, IngredientSelection> = {}
  for (const ing of ingredients) map[ing.id] = { selected: false, quantity: '1', removable: false }
  return map
}

export default function MenuItemsTab({ ingredients, onError }: { ingredients: IngredientPreset[]; onError: (message: string) => void }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [listFilter, setListFilter] = useState('')

  // selectedId === null หมายถึงกำลังกรอกฟอร์ม "เพิ่มเมนูใหม่" ไม่ใช่แก้ของเดิม
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selections, setSelections] = useState<Record<string, IngredientSelection>>(() => emptySelections(ingredients))
  const [ingredientFilter, setIngredientFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadMenuItems = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      setMenuItems(data.menuItems)
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'โหลดข้อมูลเมนูไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMenuItems() }, [])

  // เติมฟอร์มฝั่งขวาจาก item ที่เลือก (หรือฟอร์มเปล่าถ้า item เป็น null = โหมดสร้างใหม่)
  const loadIntoForm = (item: MenuItem | null) => {
    setSelectedId(item?.id ?? null)
    setName(item?.name ?? '')
    setDescription(item?.description ?? '')
    const base = emptySelections(ingredients)
    if (item) {
      for (const bom of item.ingredients) {
        if (base[bom.id]) base[bom.id] = { selected: true, quantity: String(bom.quantityRequiredPlates), removable: bom.removable }
      }
    }
    setSelections(base)
    setIngredientFilter('')
    onError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) { onError('กรุณากรอกชื่อเมนู'); return }

    setSaving(true)
    onError('')
    try {
      let menuItemId = selectedId
      if (menuItemId) {
        await apiFetch(`/owner/menu-items/${menuItemId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: trimmedName, description: description.trim() || null }),
        })
      } else {
        const created = await apiFetch<{ menuItem: MenuItem }>('/owner/menu-items', {
          method: 'POST',
          body: JSON.stringify({ name: trimmedName, description: description.trim() || undefined }),
        })
        menuItemId = created.menuItem.id
      }

      // sync วัตถุดิบทีละตัว: ที่ติ๊กไว้ → upsert, ที่เคยมีแต่ถูกยกเลิกติ๊ก → ลบ
      const existingItem = menuItems.find((m) => m.id === selectedId)
      const existingIds = new Set(existingItem?.ingredients.map((i) => i.id) ?? [])
      for (const ing of ingredients) {
        const selection = selections[ing.id]
        if (selection?.selected) {
          const quantity = Number(selection.quantity)
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`จำนวนจานของ "${ing.name}" ต้องเป็นตัวเลขมากกว่า 0`)
          }
          await apiFetch(`/owner/menu-items/${menuItemId}/ingredients`, {
            method: 'POST',
            body: JSON.stringify({ ingredientId: ing.id, quantityRequiredPlates: quantity, removable: selection.removable }),
          })
        } else if (existingIds.has(ing.id)) {
          await apiFetch(`/owner/menu-items/${menuItemId}/ingredients/${ing.id}`, { method: 'DELETE' })
        }
      }

      const data = await apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      setMenuItems(data.menuItems)
      const saved = data.menuItems.find((m) => m.id === menuItemId)
      loadIntoForm(saved ?? null)
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'บันทึกเมนูไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ลบเมนูนี้?')) return
    onError('')
    setDeletingId(id)
    try {
      await apiFetch(`/owner/menu-items/${id}`, { method: 'DELETE' })
      if (selectedId === id) loadIntoForm(null)
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ลบเมนูไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleIngredient = (id: string, selected: boolean) => {
    setSelections((current) => ({ ...current, [id]: { ...current[id], selected } }))
  }
  const setIngredientQuantity = (id: string, quantity: string) => {
    setSelections((current) => ({ ...current, [id]: { ...current[id], quantity } }))
  }
  const toggleRemovable = (id: string, removable: boolean) => {
    setSelections((current) => ({ ...current, [id]: { ...current[id], removable } }))
  }

  const filteredMenuItems = menuItems.filter((item) => item.name.toLowerCase().includes(listFilter.trim().toLowerCase()))
  const filteredIngredients = ingredients.filter((ing) => ing.name.toLowerCase().includes(ingredientFilter.trim().toLowerCase()))
  const meatIngredients = useMemo(() => filteredIngredients.filter((ing) => ing.category === 'meat'), [filteredIngredients])
  const vegIngredients = useMemo(() => filteredIngredients.filter((ing) => ing.category === 'vegetable'), [filteredIngredients])
  const selectedCount = Object.values(selections).filter((s) => s.selected).length
  const isEditing = selectedId !== null

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* ===== ฝั่งซ้าย: รายการเมนูชาบู ===== */}
      <section className="rounded-[22px] border-2 border-[#2D1B17] bg-white p-5 shadow-[6px_6px_0_#2D1B17]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black text-[#2D1B17]">เมนูชาบูทั้งหมด</h2>
          <span className="rounded-full bg-[#FFF1EA] px-2.5 py-1 text-xs font-black text-[#C2410C]">{menuItems.length} เมนู</span>
        </div>

        <input
          value={listFilter}
          onChange={(e) => setListFilter(e.target.value)}
          placeholder="ค้นหาเมนู…"
          className="mt-3 w-full rounded-xl border-2 border-[#2D1B17]/20 px-3 py-2 text-sm outline-none focus:border-[#C2410C]"
        />

        <button
          type="button"
          onClick={() => loadIntoForm(null)}
          className={`mt-3 w-full rounded-xl border-2 border-[#2D1B17] px-4 py-2.5 text-sm font-black transition ${
            !isEditing ? 'bg-[#C2410C] text-white' : 'bg-white text-[#2D1B17] hover:bg-[#FFF1EA]'
          }`}
        >
          + เพิ่มเมนูใหม่
        </button>

        {loading ? (
          <p className="mt-5 text-sm font-bold text-[#7B726B]">กำลังโหลด…</p>
        ) : (
          <ul className="mt-4 max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {filteredMenuItems.map((item) => {
              const removableCount = item.ingredients.filter((i) => i.removable).length
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => loadIntoForm(item)}
                    className={`w-full rounded-2xl border-2 px-3 py-3 text-left transition ${
                      selectedId === item.id ? 'border-[#C2410C] bg-[#FFF1EA]' : 'border-[#2D1B17]/15 bg-white hover:border-[#2D1B17]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFE4D6] text-xl">{avatarFor(item.id)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-[#2D1B17]">{item.name}</p>
                        <p className="truncate text-xs text-[#7B726B]">{item.description || 'ไม่มีคำอธิบาย'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#2D1B17]/5 px-2 py-0.5 text-[10px] font-black text-[#2D1B17]">
                            วัตถุดิบ {item.ingredients.length} ชนิด
                          </span>
                          {removableCount > 0 && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                              เอาออกได้ {removableCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2 border-t border-[#2D1B17]/10 pt-2">
                      <span className="text-xs font-black text-[#8B5746]">แก้ไข</span>
                      <span className="text-xs text-[#2D1B17]/20">|</span>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                        className={`text-xs font-black text-red-700 ${deletingId === item.id ? 'opacity-40' : ''}`}
                      >
                        {deletingId === item.id ? 'กำลังลบ…' : 'ลบ'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
            {filteredMenuItems.length === 0 && <p className="text-sm font-bold text-[#7B726B]">ไม่พบเมนูที่ค้นหา</p>}
          </ul>
        )}
      </section>

      {/* ===== ฝั่งขวา: รายละเอียดเมนู ===== */}
      <section className="rounded-[22px] border-2 border-[#2D1B17] bg-white p-6 shadow-[6px_6px_0_#2D1B17]">
        <h2 className="text-lg font-black text-[#2D1B17]">{isEditing ? `แก้ไขเมนู: ${name || '—'}` : 'เพิ่มเมนูชาบูใหม่'}</h2>
        <p className="mt-1 text-sm text-[#7B726B]">
          ร้านนี้เป็นบุฟเฟ่ต์ต่อหัว เมนูจึงไม่มีราคาต่อจาน — กำหนดแค่ชื่อ คำอธิบาย และวัตถุดิบที่ใช้ตัดสต็อก
        </p>

        <form onSubmit={handleSave}>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-black uppercase tracking-wide text-[#8A7067] sm:col-span-2">
              ชื่อเมนู
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น หมูสไลด์พรีเมียม"
                className="mt-1.5 w-full rounded-xl border-2 border-[#2D1B17] px-3 py-2 text-sm font-bold text-[#2D1B17]"
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-wide text-[#8A7067] sm:col-span-2">
              คำอธิบายเมนู (ไม่บังคับ)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น หมูหมักนุ่ม สไลด์บาง เสิร์ฟพร้อมงาขาวคั่ว"
                rows={2}
                className="mt-1.5 w-full resize-none rounded-xl border-2 border-[#2D1B17] px-3 py-2 text-sm text-[#2D1B17]"
              />
            </label>
          </div>

          {/* --- ส่วนที่ 1: เชื่อมโยงวัตถุดิบจากคลังตู้รอเตรียม --- */}
          <div className="mt-6 border-t-2 border-[#2D1B17]/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-[#2D1B17]">วัตถุดิบจากคลังตู้รอเตรียม (BOM)</p>
              <span className="rounded-full bg-[#2D1B17]/5 px-2.5 py-1 text-xs font-black text-[#2D1B17]">เลือกแล้ว {selectedCount}</span>
            </div>
            <input
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              placeholder="ค้นหาวัตถุดิบในคลัง…"
              className="mt-3 w-full rounded-xl border-2 border-[#2D1B17]/20 px-3 py-2 text-sm outline-none focus:border-[#C2410C]"
            />

            <div className="mt-3 max-h-[360px] space-y-4 overflow-y-auto rounded-2xl border-2 border-[#2D1B17]/10 bg-[#FFFDF9] p-3">
              <IngredientGroup label="🥩 เนื้อสัตว์" items={meatIngredients} selections={selections} onToggle={toggleIngredient} onQuantity={setIngredientQuantity} onRemovable={toggleRemovable} />
              <IngredientGroup label="🥬 ผักและอื่นๆ" items={vegIngredients} selections={selections} onToggle={toggleIngredient} onQuantity={setIngredientQuantity} onRemovable={toggleRemovable} />
              {filteredIngredients.length === 0 && <p className="py-4 text-center text-sm font-bold text-[#7B726B]">ไม่พบวัตถุดิบที่ค้นหา</p>}
            </div>

            <p className="mt-2 text-xs leading-5 text-[#7B726B]">
              ติ๊กวัตถุดิบที่เมนูนี้ใช้ ระบบจะตัดสต็อกจากคลังตู้รอเตรียมตามจำนวนจานทุกครั้งที่มีออเดอร์ — เปิดสวิตช์
              <span className="font-black text-emerald-700"> "ลูกค้าเลือกไม่ใส่ได้" </span>
              เฉพาะวัตถุดิบที่ยอมให้ลูกค้ากดเอาออกตอนสั่ง (เช่น งาขาว ซอสหมัก) ส่วนวัตถุดิบหลักของเมนูที่ไม่ควรถอดออกได้ ให้ปิดสวิตช์นี้ไว้
            </p>
          </div>

          {/* --- Footer --- */}
          <div className="mt-6 flex justify-end gap-3 border-t-2 border-[#2D1B17]/10 pt-5">
            <button type="button" onClick={() => loadIntoForm(isEditing ? menuItems.find((m) => m.id === selectedId) ?? null : null)} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black text-[#2D1B17]">
              ยกเลิก
            </button>
            <button disabled={saving} className="rounded-xl border-2 border-[#2D1B17] bg-[#C2410C] px-6 py-2.5 text-sm font-black text-white shadow-[3px_3px_0_#2D1B17] disabled:opacity-50">
              {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูลเมนู'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function IngredientGroup({ label, items, selections, onToggle, onQuantity, onRemovable }: {
  label: string
  items: IngredientPreset[]
  selections: Record<string, IngredientSelection>
  onToggle: (id: string, selected: boolean) => void
  onQuantity: (id: string, quantity: string) => void
  onRemovable: (id: string, removable: boolean) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-[#8A7067]">{label}</p>
      <div className="space-y-1.5">
        {items.map((ing) => {
          const selection = selections[ing.id] ?? { selected: false, quantity: '1', removable: false }
          return (
            <div key={ing.id} className={`flex flex-wrap items-center gap-3 rounded-xl border-2 px-3 py-2 transition ${selection.selected ? 'border-[#C2410C]/40 bg-white' : 'border-transparent bg-white/60'}`}>
              <label className="flex flex-1 items-center gap-2 text-sm font-bold text-[#2D1B17]">
                <input type="checkbox" checked={selection.selected} onChange={(e) => onToggle(ing.id, e.target.checked)} className="h-4 w-4 accent-[#C2410C]" />
                {ing.name}
              </label>

              {selection.selected && (
                <>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#7B726B]">
                    จำนวนจาน
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={selection.quantity}
                      onChange={(e) => onQuantity(ing.id, e.target.value)}
                      className="w-16 rounded-lg border-2 border-[#2D1B17]/20 px-2 py-1 text-sm"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => onRemovable(ing.id, !selection.removable)}
                    className={`flex items-center gap-2 rounded-full border-2 px-2.5 py-1 text-xs font-black transition ${
                      selection.removable ? 'border-emerald-600 bg-emerald-500 text-white' : 'border-[#2D1B17]/20 bg-white text-[#7B726B]'
                    }`}
                    title="อนุญาตให้ลูกค้าเลือกไม่ใส่วัตถุดิบนี้ตอนสั่งอาหาร"
                  >
                    <span className={`h-3.5 w-3.5 rounded-full transition ${selection.removable ? 'bg-white' : 'bg-[#2D1B17]/20'}`} />
                    ลูกค้าเลือกไม่ใส่ได้
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
