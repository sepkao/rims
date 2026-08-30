import { useEffect, useState } from 'react'
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

export default function MenuItemsTab({ ingredients, onError }: { ingredients: IngredientPreset[]; onError: (message: string) => void }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

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

  const createMenuItem = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    onError('')
    try {
      await apiFetch('/owner/menu-items', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      })
      setName('')
      setDescription('')
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'สร้างเมนูไม่สำเร็จ')
    } finally {
      setCreating(false)
    }
  }

  const deleteMenuItem = async (id: string) => {
    if (!confirm('ลบเมนูนี้?')) return
    onError('')
    try {
      await apiFetch(`/owner/menu-items/${id}`, { method: 'DELETE' })
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ลบเมนูไม่สำเร็จ')
    }
  }

  const addIngredient = async (menuItemId: string, ingredientId: string, quantity: number, removable: boolean) => {
    onError('')
    try {
      await apiFetch(`/owner/menu-items/${menuItemId}/ingredients`, {
        method: 'POST',
        body: JSON.stringify({ ingredientId, quantityRequiredPlates: quantity, removable }),
      })
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'เพิ่มวัตถุดิบไม่สำเร็จ')
    }
  }

  const removeIngredient = async (menuItemId: string, ingredientId: string) => {
    onError('')
    try {
      await apiFetch(`/owner/menu-items/${menuItemId}/ingredients/${ingredientId}`, { method: 'DELETE' })
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ลบวัตถุดิบไม่สำเร็จ')
    }
  }

  return (
    <>
      <form onSubmit={createMenuItem} className="mb-8 rounded-[22px] border-2 border-[#2D1B17] bg-white p-6 shadow-[6px_6px_0_#2D1B17]">
        <h2 className="mb-4 text-lg font-black">เพิ่มเมนูใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเมนู" className="rounded-xl border-2 border-[#2D1B17] px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบาย (ไม่บังคับ)" className="rounded-xl border-2 border-[#2D1B17] px-3 py-2 text-sm" />
        </div>
        <button disabled={creating} className="mt-4 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
          {creating ? 'กำลังสร้าง…' : 'สร้างเมนู'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm font-bold text-[#7B726B]">กำลังโหลด…</p>
      ) : (
        <div className="space-y-5">
          {menuItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              ingredients={ingredients}
              onDelete={() => deleteMenuItem(item.id)}
              onAddIngredient={(ingredientId, quantity, removable) => addIngredient(item.id, ingredientId, quantity, removable)}
              onRemoveIngredient={(ingredientId) => removeIngredient(item.id, ingredientId)}
            />
          ))}
          {menuItems.length === 0 && <p className="text-sm font-bold text-[#7B726B]">ยังไม่มีเมนูในระบบ</p>}
        </div>
      )}
    </>
  )
}

function MenuItemCard({ item, ingredients, onDelete, onAddIngredient, onRemoveIngredient }: {
  item: MenuItem
  ingredients: IngredientPreset[]
  onDelete: () => void
  onAddIngredient: (ingredientId: string, quantity: number, removable: boolean) => void
  onRemoveIngredient: (ingredientId: string) => void
}) {
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [removable, setRemovable] = useState(false)

  const availableIngredients = ingredients.filter((ing) => !item.ingredients.some((bom) => bom.id === ing.id))

  return (
    <article className="rounded-[22px] border-2 border-[#2D1B17] bg-white p-6 shadow-[6px_6px_0_#2D1B17]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black">{item.name}</h3>
          {item.description && <p className="mt-1 text-sm text-[#6f625d]">{item.description}</p>}
        </div>
        <button type="button" onClick={onDelete} className="rounded-xl border-2 border-[#2D1B17] bg-white px-3 py-1.5 text-xs font-black text-red-700">
          ลบเมนู
        </button>
      </div>

      <div className="mt-4 border-t-2 border-[#2D1B17]/10 pt-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#8A7067]">วัตถุดิบที่ใช้ (BOM)</p>
        {item.ingredients.length === 0 ? (
          <p className="text-sm text-[#7B726B]">ยังไม่มีวัตถุดิบผูกกับเมนูนี้</p>
        ) : (
          <ul className="space-y-1">
            {item.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-center justify-between rounded-lg bg-[#FFF8EF] px-3 py-2 text-sm">
                <span>
                  {ing.name} — {ing.quantityRequiredPlates} จาน
                  {ing.removable && <span className="ml-1 text-xs font-bold text-[#8B5746]">(ตัดออกได้)</span>}
                </span>
                <button type="button" onClick={() => onRemoveIngredient(ing.id)} className="text-xs font-black text-red-700">
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        )}

        {availableIngredients.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)} className="rounded-lg border-2 border-[#2D1B17] px-2 py-1.5 text-sm">
              <option value="">เลือกวัตถุดิบ…</option>
              {availableIngredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
            </select>
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-20 rounded-lg border-2 border-[#2D1B17] px-2 py-1.5 text-sm" />
            <label className="flex items-center gap-1 text-xs font-bold">
              <input type="checkbox" checked={removable} onChange={(e) => setRemovable(e.target.checked)} /> ตัดออกได้
            </label>
            <button
              type="button"
              disabled={!selectedIngredient}
              onClick={() => {
                onAddIngredient(selectedIngredient, Number(quantity), removable)
                setSelectedIngredient('')
                setQuantity('1')
                setRemovable(false)
              }}
              className="rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
            >
              เพิ่ม
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
