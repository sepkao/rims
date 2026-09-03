import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ChefHat, Eye, EyeOff, PackageCheck, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { API_BASE_URL, apiFetch } from '../../lib/api'
import type { IngredientPreset } from '../../types/ingredient'

type MenuIngredient = { id: string; name: string; quantityRequiredPlates: number; removable: boolean; availablePlates: number }
type MenuItem = { id: string; name: string; description: string | null; category: string; imagePath: string | null; isActive: boolean; availableServings: number; ingredients: MenuIngredient[] }
type DraftLine = { key: number; ingredientId: string; quantityRequiredPlates: number; removable: boolean }
type EditLine = { ingredientId: string; quantityRequiredPlates: number; removable: boolean }
type MenuCategory = { id: string; name: string }

export default function MenuItemsTab({ ingredients, onError }: { ingredients: IngredientPreset[]; onError: (message: string) => void }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('เนื้อสัตว์')
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([{ key: 1, ingredientId: '', quantityRequiredPlates: 1, removable: false }])
  const [nextKey, setNextKey] = useState(2)
  const [creating, setCreating] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('เนื้อสัตว์')
  const [editLines, setEditLines] = useState<EditLine[]>([])

  const loadMenuItems = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = await apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      setMenuItems(data.menuItems)
      onError('')
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'โหลดข้อมูลเมนูไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [onError])

  const loadCategories = useCallback(async () => {
    const data = await apiFetch<{ categories: MenuCategory[] }>('/owner/menu-categories')
    setCategories(data.categories)
    setCategory((current) => data.categories.some((item) => item.name === current) ? current : data.categories[0]?.name ?? '')
  }, [])

  useEffect(() => {
    void loadMenuItems(true)
    void loadCategories().catch((caught) => onError(caught instanceof Error ? caught.message : 'โหลดหมวดหมู่ไม่สำเร็จ'))
    const polling = window.setInterval(() => void loadMenuItems(), 10_000)
    return () => window.clearInterval(polling)
  }, [loadCategories, loadMenuItems, onError])

  const selectedLines = lines.filter((line) => line.ingredientId)
  const previewServings = selectedLines.length === 0 ? 0 : Math.min(...selectedLines.map((line) => {
    const ingredient = ingredients.find((item) => item.id === line.ingredientId)
    return Math.floor((ingredient?.prepAvailablePlates ?? 0) / line.quantityRequiredPlates)
  }))

  const updateLine = (key: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))

  const createMenuItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !category || selectedLines.length === 0 || selectedLines.length !== lines.length) return
    setCreating(true)
    onError('')
    try {
      const created = await apiFetch<{ menuItem: { id: string } }>('/owner/menu-items', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description || undefined,
          category,
          ingredients: selectedLines.map(({ ingredientId, quantityRequiredPlates, removable }) => ({ ingredientId, quantityRequiredPlates, removable })),
        }),
      })
      if (image) {
        const form = new FormData()
        form.append('image', image)
        form.append('altText', name.trim())
        await apiFetch(`/owner/menu-items/${created.menuItem.id}/image`, { method: 'PUT', body: form })
      }
      setName('')
      setDescription('')
      setCategory('เนื้อสัตว์')
      setImage(null)
      setLines([{ key: nextKey, ingredientId: '', quantityRequiredPlates: 1, removable: false }])
      setNextKey((value) => value + 1)
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'สร้างเมนูไม่สำเร็จ')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (item: MenuItem) => {
    setProcessingId(item.id)
    try {
      await apiFetch(`/owner/menu-items/${item.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) })
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'เปลี่ยนสถานะเมนูไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  const deleteMenuItem = async (item: MenuItem) => {
    if (!confirm(`ลบเมนู “${item.name}”?`)) return
    setProcessingId(item.id)
    try {
      await apiFetch(`/owner/menu-items/${item.id}`, { method: 'DELETE' })
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ลบเมนูไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditDescription(item.description ?? '')
    setEditCategory(item.category)
    setEditLines(item.ingredients.map((ingredient) => ({ ingredientId: ingredient.id, quantityRequiredPlates: ingredient.quantityRequiredPlates, removable: ingredient.removable })))
  }

  const saveEdit = async (item: MenuItem) => {
    if (!editName.trim() || editLines.length === 0 || editLines.some((line) => !line.ingredientId || !Number.isSafeInteger(line.quantityRequiredPlates) || line.quantityRequiredPlates < 1)) return
    setProcessingId(item.id)
    try {
      await apiFetch(`/owner/menu-items/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: editName.trim(), description: editDescription.trim(), category: editCategory }) })
      const original = new Set(item.ingredients.map((ingredient) => ingredient.id))
      const next = new Set(editLines.map((line) => line.ingredientId))
      await Promise.all(editLines.map((line) => apiFetch(`/owner/menu-items/${item.id}/ingredients`, { method: 'POST', body: JSON.stringify(line) })))
      await Promise.all([...original].filter((ingredientId) => !next.has(ingredientId)).map((ingredientId) => apiFetch(`/owner/menu-items/${item.id}/ingredients/${ingredientId}`, { method: 'DELETE' })))
      setEditingId(null)
      await loadMenuItems()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'แก้ไขเมนูไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    setCategoryBusy(true); onError('')
    try {
      const data = await apiFetch<{ category: MenuCategory }>('/owner/menu-categories', { method: 'POST', body: JSON.stringify({ name: newCategoryName }) })
      await loadCategories(); setCategory(data.category.name); setNewCategoryName('')
    } catch (caught) { onError(caught instanceof Error ? caught.message : 'เพิ่มหมวดหมู่ไม่สำเร็จ') } finally { setCategoryBusy(false) }
  }

  const renameCategory = async (item: MenuCategory) => {
    if (!editingCategoryName.trim()) return
    setCategoryBusy(true); onError('')
    try {
      const data = await apiFetch<{ category: MenuCategory }>(`/owner/menu-categories/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: editingCategoryName }) })
      if (category === item.name) setCategory(data.category.name)
      if (editCategory === item.name) setEditCategory(data.category.name)
      setEditingCategoryId(null); await loadCategories(); await loadMenuItems()
    } catch (caught) { onError(caught instanceof Error ? caught.message : 'แก้ไขหมวดหมู่ไม่สำเร็จ') } finally { setCategoryBusy(false) }
  }

  const removeCategory = async (item: MenuCategory) => {
    if (!confirm(`ลบหมวดหมู่ “${item.name}”?`)) return
    setCategoryBusy(true); onError('')
    try { await apiFetch(`/owner/menu-categories/${item.id}`, { method: 'DELETE' }); await loadCategories() }
    catch (caught) { onError(caught instanceof Error ? caught.message : 'ลบหมวดหมู่ไม่สำเร็จ') }
    finally { setCategoryBusy(false) }
  }

  const visibleItems = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? menuItems.filter((item) => `${item.name} ${item.description ?? ''} ${item.ingredients.map((ingredient) => ingredient.name).join(' ')}`.toLowerCase().includes(value)) : menuItems
  }, [menuItems, query])

  return (
    <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
      <form onSubmit={createMenuItem} className="min-w-0 overflow-hidden rounded-[24px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17] xl:sticky xl:top-5">
        <div className="border-b-2 border-[#2D1B17] bg-[#E8D8CA] px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[#2D1B17] bg-[#B97861] text-white"><ChefHat size={20} /></span><div><h2 className="text-lg font-black">Create Menu</h2><p className="text-[11px] font-semibold text-[#6D5147]">สร้างเมนูพร้อมกำหนดถาดจาก Prep ในครั้งเดียว</p></div></div>
        </div>
        <div className="space-y-5 p-4 sm:p-6">
          <label className="block text-xs font-black">ชื่อเมนู <span className="text-red-700">*</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น ชุดหมูนุ่ม" className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#B97861]/40" /></label>
          <label className="block text-xs font-black">คำอธิบาย<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="รายละเอียดที่ลูกค้าจะเห็น" rows={2} className="mt-2 w-full resize-none rounded-xl border-2 border-[#2D1B17] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#B97861]/40" /></label>
          <div><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-black">หมวดหมู่ <span className="text-red-700">*</span><select required value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-3 py-2.5 text-sm"><option value="">เลือกหมวดหมู่…</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><button type="button" onClick={() => setShowCategoryManager((value) => !value)} className="rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-2.5 text-xs font-black">{showCategoryManager ? 'ปิด' : 'จัดการหมวด'}</button></div>{showCategoryManager && <div className="mt-3 rounded-xl border-2 border-[#B97861] bg-[#FFF8EF] p-3"><div className="flex gap-2"><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="ชื่อหมวดหมู่ใหม่" maxLength={80} className="min-w-0 flex-1 rounded-lg border-2 border-[#2D1B17] bg-white px-3 py-2 text-xs" /><button type="button" disabled={categoryBusy || !newCategoryName.trim()} onClick={() => void addCategory()} className="rounded-lg bg-[#2D1B17] px-3 py-2 text-xs font-black text-white disabled:opacity-40">+ เพิ่ม</button></div><div className="mt-3 space-y-2">{categories.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-white p-2">{editingCategoryId === item.id ? <><input autoFocus value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" /><button type="button" disabled={categoryBusy} onClick={() => void renameCategory(item)} className="text-xs font-black text-green-800">บันทึก</button><button type="button" onClick={() => setEditingCategoryId(null)} className="text-xs font-bold">ยกเลิก</button></> : <><span className="min-w-0 flex-1 truncate text-xs font-bold">{item.name}</span><button type="button" onClick={() => { setEditingCategoryId(item.id); setEditingCategoryName(item.name) }} title="แก้ชื่อหมวด" className="text-[#6D5147]"><Pencil size={14} /></button><button type="button" disabled={categoryBusy} onClick={() => void removeCategory(item)} title="ลบหมวด" className="text-red-700"><Trash2 size={14} /></button></>}</div>)}</div><p className="mt-2 text-[10px] font-semibold text-[#876E65]">หมวดที่มีเมนูอยู่จะลบไม่ได้ ต้องย้ายหรือลบเมนูก่อน</p></div>}</div>
          <label className="block text-xs font-black">รูปเมนู <span className="font-semibold text-[#7B726B]">(ไม่บังคับ · JPG/PNG/WebP ไม่เกิน 5 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border-2 border-dashed border-[#B97861] bg-[#FFF8EF] px-3 py-2 text-xs font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-[#2D1B17] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white" />{image && <img src={URL.createObjectURL(image)} alt="ตัวอย่างรูปเมนู" className="mt-3 h-24 w-24 rounded-xl border-2 border-[#2D1B17] object-cover" />}</label>

          <section>
            <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black">วัตถุดิบจาก Prep (BOM) <span className="text-red-700">*</span></p><p className="mt-0.5 text-[10px] font-semibold text-[#876E65]">จำนวนถาดที่ใช้ต่อเมนู 1 ชุด</p></div><button type="button" onClick={() => { setLines((current) => [...current, { key: nextKey, ingredientId: '', quantityRequiredPlates: 1, removable: false }]); setNextKey((value) => value + 1) }} className="flex items-center gap-1 rounded-lg border-2 border-[#2D1B17] bg-[#FFF8EF] px-2.5 py-1.5 text-[11px] font-black"><Plus size={12} /> เพิ่มวัตถุดิบ</button></div>
            <div className="space-y-3">
              {lines.map((line, index) => {
                const selectedIds = new Set(lines.filter((candidate) => candidate.key !== line.key).map((candidate) => candidate.ingredientId))
                const selected = ingredients.find((ingredient) => ingredient.id === line.ingredientId)
                return <div key={line.key} className="rounded-xl border-2 border-[#EAE5DF] bg-[#FAF8F5] p-3">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black text-[#876E65]">รายการ {index + 1}</span>{lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))} className="text-red-700" title="ลบรายการ"><X size={14} /></button>}</div>
                  <select required value={line.ingredientId} onChange={(event) => updateLine(line.key, { ingredientId: event.target.value })} className="mt-2 w-full rounded-lg border-2 border-[#2D1B17] bg-white px-2.5 py-2 text-xs font-bold"><option value="">เลือกวัตถุดิบใน Prep…</option>{ingredients.filter((ingredient) => !selectedIds.has(ingredient.id)).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} — มี {Math.floor(ingredient.prepAvailablePlates ?? 0)} ถาด</option>)}</select>
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3"><label className="text-[10px] font-black text-[#6D5147]">ใช้กี่ถาด / 1 เมนู<input type="number" min="1" step="1" required value={line.quantityRequiredPlates} onChange={(event) => updateLine(line.key, { quantityRequiredPlates: Number(event.target.value) })} className="mt-1 w-full rounded-lg border-2 border-[#2D1B17] bg-white px-2.5 py-2 text-xs font-black" /></label><label className="mt-4 flex items-center gap-2 text-[10px] font-black"><input type="checkbox" checked={line.removable} onChange={(event) => updateLine(line.key, { removable: event.target.checked })} /> ลูกค้าเลือกไม่ใส่ได้</label></div>
                  {selected && <p className="mt-2 text-[10px] font-bold text-[#7B726B]">สต็อก Prep ปัจจุบัน {Math.floor(selected.prepAvailablePlates ?? 0)} ถาด · ทำเมนูนี้ได้ {Math.floor((selected.prepAvailablePlates ?? 0) / line.quantityRequiredPlates)} ชุดจากวัตถุดิบนี้</p>}
                </div>
              })}
            </div>
          </section>

          <div className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${previewServings > 0 ? 'border-green-800 bg-green-50' : 'border-amber-700 bg-amber-50'}`}><div><p className="text-[10px] font-black uppercase tracking-wider">ขายได้อัตโนมัติตอนนี้</p><p className="mt-0.5 text-[10px] font-semibold text-[#7B726B]">อิงจากวัตถุดิบที่มีน้อยที่สุดใน Prep</p></div><strong className="text-2xl font-black">{previewServings} ชุด</strong></div>
          <button disabled={creating || !name.trim() || !category || selectedLines.length === 0 || selectedLines.length !== lines.length} className="w-full rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-3 text-sm font-black text-white shadow-[4px_4px_0_#B97861] disabled:cursor-not-allowed disabled:opacity-40">{creating ? 'กำลังสร้างเมนู…' : 'สร้างและแสดงในหน้าสั่งอาหาร →'}</button>
        </div>
      </form>

      <section>
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black">เมนูทั้งหมด</h2><p className="text-xs font-semibold text-[#7B726B]">จำนวนพร้อมขายจะเปลี่ยนตาม Prep stock โดยอัตโนมัติ</p></div><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B726B]" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเมนู..." className="rounded-xl border-2 border-[#2D1B17] bg-white py-2 pl-8 pr-3 text-xs outline-none" /></label></div>
        {loading ? <p className="rounded-2xl border-2 border-dashed border-[#D6D0C4] bg-white p-12 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดเมนู…</p> : <div className="space-y-4">
          {visibleItems.map((item) => <article key={item.id} className="overflow-hidden rounded-[22px] border-2 border-[#2D1B17] bg-white shadow-[5px_5px_0_#2D1B17]">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-5 py-4"><div className="flex gap-3">{item.imagePath && <img src={`${API_BASE_URL}${item.imagePath}`} alt={item.name} className="h-14 w-14 rounded-xl border-2 border-[#2D1B17] object-cover" />}<div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{item.name}</h3><span className="rounded-full border border-[#B97861] bg-[#E8D8CA] px-2 py-0.5 text-[9px] font-black">{item.category}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${item.isActive ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-400 bg-gray-100 text-gray-600'}`}>{item.isActive ? 'ลูกค้ามองเห็น' : 'ซ่อนอยู่'}</span></div>{item.description && <p className="mt-1 text-xs font-semibold text-[#6F625D]">{item.description}</p>}</div></div><div className="flex gap-2"><button type="button" disabled={processingId === item.id} onClick={() => startEdit(item)} className="flex items-center gap-1 rounded-lg border-2 border-[#2D1B17] bg-white px-2.5 py-1.5 text-[10px] font-black"><Pencil size={12} />แก้ไข</button><button type="button" disabled={processingId === item.id} onClick={() => void toggleActive(item)} className="flex items-center gap-1 rounded-lg border-2 border-[#2D1B17] bg-white px-2.5 py-1.5 text-[10px] font-black">{item.isActive ? <EyeOff size={12} /> : <Eye size={12} />}{item.isActive ? 'ซ่อน' : 'แสดง'}</button><button type="button" disabled={processingId === item.id} onClick={() => void deleteMenuItem(item)} className="rounded-lg border-2 border-red-700 bg-white p-1.5 text-red-700" title="ลบเมนู"><Trash2 size={13} /></button></div></header>
            <div className="p-5">{editingId === item.id ? <div className="mb-5 rounded-xl border-2 border-[#B97861] bg-[#FFF8EF] p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black">ชื่อเมนู<input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-lg border-2 border-[#2D1B17] bg-white px-2 py-2 text-xs" /></label><label className="text-[10px] font-black">หมวดหมู่<select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} className="mt-1 w-full rounded-lg border-2 border-[#2D1B17] bg-white px-2 py-2 text-xs"><option>เนื้อ</option><option>ผัก</option><option>เซ็ตคอมโบ</option><option>อื่นๆ</option></select></label></div><label className="mt-3 block text-[10px] font-black">คำอธิบาย<textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border-2 border-[#2D1B17] bg-white px-2 py-2 text-xs" /></label><p className="mt-3 text-[10px] font-black">แก้ไขวัตถุดิบและจำนวนถาด</p><div className="mt-2 space-y-2">{editLines.map((line, index) => <div key={`${line.ingredientId}-${index}`} className="flex items-center gap-2"><select value={line.ingredientId} onChange={(event) => setEditLines((current) => current.map((value, at) => at === index ? { ...value, ingredientId: event.target.value } : value))} className="min-w-0 flex-1 rounded-lg border-2 border-[#2D1B17] bg-white px-2 py-1.5 text-xs">{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select><input type="number" min="1" step="1" value={line.quantityRequiredPlates} onChange={(event) => setEditLines((current) => current.map((value, at) => at === index ? { ...value, quantityRequiredPlates: Number(event.target.value) } : value))} className="w-16 rounded-lg border-2 border-[#2D1B17] px-2 py-1.5 text-xs" /><label className="flex items-center gap-1 text-[9px] font-bold"><input type="checkbox" checked={line.removable} onChange={(event) => setEditLines((current) => current.map((value, at) => at === index ? { ...value, removable: event.target.checked } : value))} /> ตัดได้</label>{editLines.length > 1 && <button type="button" onClick={() => setEditLines((current) => current.filter((_, at) => at !== index))} className="text-red-700"><X size={14} /></button>}</div>)}</div><div className="mt-3 flex flex-wrap justify-between gap-2"><button type="button" onClick={() => setEditLines((current) => [...current, { ingredientId: ingredients.find((ingredient) => !current.some((line) => line.ingredientId === ingredient.id))?.id ?? '', quantityRequiredPlates: 1, removable: false }])} className="text-[10px] font-black underline">+ เพิ่มวัตถุดิบ</button><div className="flex gap-2"><button type="button" onClick={() => setEditingId(null)} className="rounded-lg border-2 border-[#2D1B17] bg-white px-3 py-1.5 text-[10px] font-black">ยกเลิก</button><button type="button" onClick={() => void saveEdit(item)} className="rounded-lg border-2 border-[#2D1B17] bg-[#2D1B17] px-3 py-1.5 text-[10px] font-black text-white">บันทึกการแก้ไข</button></div></div></div> : <><div className="mb-4 flex items-center justify-between rounded-xl border-2 border-[#2D1B17] bg-[#E8D8CA] px-4 py-3"><div className="flex items-center gap-2"><PackageCheck size={17} /><span className="text-xs font-black">พร้อมขายจาก Prep</span></div><strong className={`text-xl font-black ${item.availableServings < 1 ? 'text-red-700' : 'text-green-800'}`}>{item.availableServings} ชุด</strong></div><div className="grid gap-2 sm:grid-cols-2">{item.ingredients.map((ingredient) => <div key={ingredient.id} className="rounded-xl border border-[#EAE5DF] bg-[#FAF8F5] px-3 py-2.5"><div className="flex justify-between gap-2 text-xs font-black"><span>{ingredient.name}</span><span>{ingredient.quantityRequiredPlates} ถาด/ชุด</span></div><p className="mt-1 text-[10px] font-semibold text-[#7B726B]">Prep มี {Math.floor(ingredient.availablePlates)} ถาด · ทำได้ {Math.floor(ingredient.availablePlates / ingredient.quantityRequiredPlates)} ชุด{ingredient.removable ? ' · ลูกค้าตัดออกได้' : ''}</p></div>)}</div>{item.ingredients.length === 0 && <p className="text-xs font-bold text-red-700">เมนูนี้ยังไม่มี BOM จึงขายไม่ได้</p>}</>} </div>
          </article>)}
          {visibleItems.length === 0 && <p className="rounded-2xl border-2 border-dashed border-[#D6D0C4] bg-white p-12 text-center text-sm font-bold text-[#7B726B]">ไม่พบเมนู</p>}
        </div>}
      </section>
    </div>
  )
}
