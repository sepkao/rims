import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type MenuItem = {
  id: string
  name: string
  price: number
  description: string | null
  ingredients: Array<{ id: string; name: string; quantityRequiredPlates: number; removable: boolean }>
}

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      .then((data) => setItems(data.menuItems))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load menu'))
      .finally(() => setLoading(false))
  }, [])

  const visible = items.filter((item) => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="admin-page w-full max-w-[1200px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="mb-1 text-3xl font-bold">Menu Management</h1><p className="text-sm text-[#777]">รายการเมนูและ BOM จากฐานข้อมูล</p></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเมนู..." className="admin-control rounded-lg border bg-white px-4 py-2.5 text-sm" />
      </div>
      {error && <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {loading && <div className="admin-surface rounded-xl bg-white p-6 text-sm font-bold text-[#777]">Loading menu…</div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {visible.map((item) => (
          <article key={item.id} className="admin-menu-card overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-[#F4EFEA] px-5 py-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8B5746]">MENU-{item.id}</p><h2 className="mt-1 text-xl font-black text-[#302221]">{item.name}</h2></div><span className="rounded-full border-2 border-[#302221] bg-white px-3 py-1 text-sm font-black">฿{item.price.toLocaleString()}</span></div><p className="mt-2 text-sm text-[#6f625d]">{item.description || 'ไม่มีคำอธิบาย'}</p></div>
            <div className="p-5"><p className="mb-3 text-xs font-black uppercase tracking-wide text-[#7B726B]">Ingredients / BOM</p><div className="flex flex-wrap gap-2">{item.ingredients.map((ingredient) => <span key={ingredient.id} className="rounded-full border bg-[#FFF8EF] px-3 py-1.5 text-xs font-bold">{ingredient.name} × {ingredient.quantityRequiredPlates}{ingredient.removable ? ' · removable' : ''}</span>)}{item.ingredients.length === 0 && <span className="text-sm text-[#999]">ยังไม่มี BOM</span>}</div></div>
          </article>
        ))}
      </div>
      {!loading && visible.length === 0 && <div className="admin-surface rounded-xl bg-white p-8 text-center text-sm text-[#777]">ไม่พบรายการเมนู</div>}
    </div>
  )
}
