import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type MenuItem = {
  id: string
  name: string
  price: number
  description: string | null
  ingredients: Array<{ id: string; name: string; removable: boolean }>
}

export default function CustomerMenuPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ menuItems: MenuItem[] }>('/menu-items')
      .then((data) => setItems(data.menuItems))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดเมนูไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => items.filter((item) =>
    `${item.name} ${item.description ?? ''} ${item.ingredients.map((ingredient) => ingredient.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  ), [items, query])
  const totalItems = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)

  return (
    <div className="flex min-h-screen justify-center bg-gray-200 font-sans">
      <div className="relative flex h-screen w-full max-w-[430px] flex-col overflow-hidden bg-[#FDFBF7] shadow-2xl">
        <header className="shrink-0 border-b border-[#EAE5DF] bg-white px-5 py-4">
          <h1 className="text-xl font-black tracking-wide text-[#5A403E]">SHABU RIMS</h1>
          <p className="text-xs font-bold text-[#7B726B]">เมนูจากฐานข้อมูลร้าน</p>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเมนูหรือวัตถุดิบ..." className="mt-4 w-full rounded-xl bg-[#F4EFEA] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#5A403E]" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-28">
          {loading && <div className="py-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดเมนู…</div>}
          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            {visible.map((item) => (
              <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#EAE5DF] bg-white shadow-sm">
                <div className="h-24 bg-gradient-to-br from-[#e8d8ca] to-[#b97861] p-3"><span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-[#5A403E]">฿{item.price.toLocaleString()}</span></div>
                <div className="flex flex-1 flex-col p-3"><h2 className="text-[13px] font-black leading-tight text-[#302221]">{item.name}</h2><p className="mt-1 line-clamp-2 text-[10px] text-[#7B726B]">{item.ingredients.map((ingredient) => ingredient.name).join(', ') || item.description || '—'}</p><div className="mt-auto pt-3">{cart[item.id] ? <div className="flex items-center justify-between rounded-lg bg-[#F4EFEA] p-1"><button onClick={() => setCart((current) => { const next = { ...current }; if (next[item.id] > 1) next[item.id] -= 1; else delete next[item.id]; return next })} className="h-7 w-7 rounded-md bg-white font-bold">−</button><span className="font-bold">{cart[item.id]}</span><button onClick={() => setCart((current) => ({ ...current, [item.id]: current[item.id] + 1 }))} className="h-7 w-7 rounded-md bg-[#5A403E] font-bold text-white">+</button></div> : <button onClick={() => setCart((current) => ({ ...current, [item.id]: 1 }))} className="w-full rounded-lg border border-[#5A403E] py-1.5 text-xs font-bold text-[#5A403E]">+ เพิ่ม</button>}</div></div>
              </article>
            ))}
          </div>
          {!loading && !error && visible.length === 0 && <div className="py-10 text-center text-sm text-[#7B726B]">ไม่พบเมนู</div>}
        </main>

        <div className="absolute bottom-0 left-0 w-full border-t bg-white p-4 shadow-[0_-4px_15px_rgba(0,0,0,.06)]">
          <button disabled={totalItems === 0} onClick={() => navigate('/order/cart')} className="flex w-full items-center justify-between rounded-xl bg-[#5A403E] px-5 py-3.5 font-bold text-white disabled:bg-[#EAE5DF] disabled:text-[#999]"><span>ดูรายการที่เลือก</span><span>{totalItems} รายการ</span></button>
        </div>
      </div>
    </div>
  )
}
