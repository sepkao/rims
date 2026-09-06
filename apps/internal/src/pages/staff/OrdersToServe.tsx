import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { Bell, BellOff, Check, CheckCheck, Clock, Eye, LayoutGrid, RotateCcw, Search, UtensilsCrossed } from 'lucide-react'

type KitchenOrderItem = {
  id: string
  name: string
  quantity: number
  removedIngredients: string[]
}

type KitchenOrder = {
  id: string
  tableNumber: string
  createdAt: string
  confirmedAt: string
  acknowledgedAt: string | null
  items: KitchenOrderItem[]
}

function elapsedLabel(confirmedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 60_000))
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  return `${hours} ชม. ${minutes % 60} น.`
}

function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // First bright bell ping
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.7)

    // Second bell chime
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.15) // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.3) // D6
    gain2.gain.setValueAtTime(0.25, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 1.1)
  } catch {
    // Autoplay may be restricted until user interaction
  }
}

export default function StaffServingQueuePage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [, setClock] = useState(0)

  // Filter & Layout States
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'serving'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid')
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('rims.staff.order_sound') !== 'false'
  })

  const prevOrderIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('rims.staff.order_sound', String(next))
    if (next) playKitchenChime()
  }

  const loadOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = await apiFetch<{ orders: KitchenOrder[] }>('/staff/orders')
      const currentOrders = data.orders || []
      setOrders(currentOrders)
      setError('')

      // Check for new incoming orders to trigger alert chime
      const currentIds = new Set(currentOrders.map((o) => o.id))
      if (!isFirstLoadRef.current) {
        const hasNewOrder = currentOrders.some((o) => !prevOrderIdsRef.current.has(o.id) && !o.acknowledgedAt)
        if (hasNewOrder && soundEnabled) {
          playKitchenChime()
        }
      }
      prevOrderIdsRef.current = currentIds
      isFirstLoadRef.current = false
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดคิวครัวไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [soundEnabled])

  useEffect(() => {
    loadOrders(true)
    const polling = setInterval(() => loadOrders(false), 3000)
    const clock = setInterval(() => setClock((val) => val + 1), 30_000)
    return () => {
      clearInterval(polling)
      clearInterval(clock)
    }
  }, [loadOrders])

  // Count unread vs serving
  const unreadCount = useMemo(() => orders.filter((o) => !o.acknowledgedAt).length, [orders])
  const servingCount = useMemo(() => orders.filter((o) => !!o.acknowledgedAt).length, [orders])

  // Filtered orders based on query and tab
  const filteredOrders = useMemo(() => {
    let result = orders
    if (filterTab === 'unread') {
      result = result.filter((o) => !o.acknowledgedAt)
    } else if (filterTab === 'serving') {
      result = result.filter((o) => !!o.acknowledgedAt)
    }

    const q = query.trim().toLowerCase()
    if (!q) return result
    return result.filter((order) =>
      `${order.tableNumber} ${order.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q),
    )
  }, [orders, filterTab, query])

  // Acknowledge order -> transition to "กำลังจัดเสิร์ฟ"
  const markAcknowledged = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      await apiFetch(`/staff/orders/${orderId}/acknowledge`, { method: 'PUT' })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, acknowledgedAt: new Date().toISOString() } : o)),
      )
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'รับออเดอร์ไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  // Revert acknowledge -> back to "ยังไม่อ่าน"
  const markUnacknowledged = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      await apiFetch(`/staff/orders/${orderId}/unacknowledge`, { method: 'PUT' })
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, acknowledgedAt: null } : o)),
      )
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ยกเลิกการรับออเดอร์ไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  // Acknowledge all unread at once
  const markAllAcknowledged = async () => {
    setProcessingId('all')
    try {
      await apiFetch('/staff/orders/acknowledge-all', { method: 'PUT' })
      setOrders((prev) =>
        prev.map((o) => (!o.acknowledgedAt ? { ...o, acknowledgedAt: new Date().toISOString() } : o)),
      )
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'รับออเดอร์ทั้งหมดไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  // Mark served -> completed
  const markServed = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      await apiFetch(`/staff/orders/${orderId}/serve`, { method: 'PUT' })
      setOrders((current) => current.filter((order) => order.id !== orderId))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'อัปเดตสถานะเสิร์ฟไม่สำเร็จ')
    } finally {
      setProcessingId(null)
    }
  }

  // Render a single compact ticket card
  const renderTicketCard = (order: KitchenOrder) => {
    const isUnread = !order.acknowledgedAt
    const isBusy = processingId === order.id

    return (
      <article
        key={order.id}
        className={`flex flex-col rounded-xl border-2 transition-all duration-150 overflow-hidden bg-white ${
          isUnread
            ? 'border-[#E04F34] shadow-[4px_4px_0_#E04F34] ring-2 ring-[#E04F34]/20'
            : 'border-[#302221] shadow-[3px_3px_0_#302221]'
        }`}
      >
        {/* Compact Card Header */}
        <header
          className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
            isUnread
              ? 'bg-gradient-to-r from-[#D84328] to-[#B8321B] text-white'
              : 'bg-[#2D1B17] text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black tracking-tight">โต๊ะ {order.tableNumber}</h3>
            <span className="text-[10px] font-bold text-white/70">#{order.id}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isUnread ? (
              <span className="relative flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#B8321B] shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
                ยังไม่อ่าน
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-200 border border-amber-400/40">
                <Clock size={10} />
                กำลังจัดเสิร์ฟ
              </span>
            )}
            <span className="text-[10px] text-white/80 font-semibold">{elapsedLabel(order.confirmedAt)}</span>
          </div>
        </header>

        {/* Compact Items List */}
        <ul className="flex-1 divide-y divide-[#F4EFEA] px-3 py-1.5 text-xs">
          {order.items.map((item) => (
            <li key={item.id} className="py-2 flex items-start gap-2">
              <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#F4EFEA] text-[11px] font-black text-[#5A403E] border border-[#EAE5DF]">
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <p className="font-bold text-[#302221] text-xs">{item.name}</p>
                {item.removedIngredients.length > 0 && (
                  <span className="inline-block mt-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200/60 px-1.5 py-0.2 rounded">
                    ไม่ใส่: {item.removedIngredients.join(', ')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Compact Card Action Footer */}
        <footer className="p-2.5 pt-1.5 bg-[#FAF8F5] border-t border-[#EAE5DF]/70">
          {isUnread ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => markAcknowledged(order.id)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#E04F34] hover:bg-[#C93B22] active:translate-y-0.5 py-2 px-3 text-xs font-black text-white shadow-sm transition-all disabled:opacity-50"
            >
              <Eye size={13} strokeWidth={2.5} />
              <span>{isBusy ? 'กำลังรับ…' : 'รับออเดอร์ (กำลังจัดเสิร์ฟ)'}</span>
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => markServed(order.id)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#2F855A] hover:bg-[#256C48] active:translate-y-0.5 py-2 px-3 text-xs font-black text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Check size={14} strokeWidth={3} />
                <span>{isBusy ? 'กำลังบันทึก…' : 'เสิร์ฟแล้ว'}</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => markUnacknowledged(order.id)}
                className="flex items-center justify-center gap-1 text-[10px] font-semibold text-[#7B726B] hover:text-[#302221] py-0.5"
                title="ย้อนกลับไปสถานะยังไม่อ่าน"
              >
                <RotateCcw size={10} />
                <span>ย้อนกลับเป็นยังไม่อ่าน</span>
              </button>
            </div>
          )}
        </footer>
      </article>
    )
  }

  return (
    <div className="w-full max-w-[1600px] bg-[#FDFBF7] p-4 sm:p-6 pb-20">
      {/* ── Top Header & Global Controls ─────────────────────────────── */}
      <div className="anim-down d-1 mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border-2 border-[#2D1B17] bg-[#B97861] text-white shadow-[2px_2px_0_#2D1B17]">
            <UtensilsCrossed size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#302221]">Serving Queue</h1>
              <span className="rounded-full bg-[#EAE5DF] px-2 py-0.5 text-[10px] font-bold text-[#7B726B]">
                Live 3s
              </span>
            </div>
            <p className="text-xs text-[#7B726B]">รับออเดอร์ลูกค้า จัดคิว และยืนยันเมื่อเสิร์ฟแล้ว</p>
          </div>
        </div>

        {/* Search, Sound & Refresh Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] sm:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B726B]" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาโต๊ะหรือเมนู..."
              className="w-full rounded-xl bg-[#F4EFEA] pl-8 pr-3 py-1.5 text-xs text-[#302221] outline-none border border-transparent focus:border-[#B97861] transition-all"
            />
          </div>

          <button
            type="button"
            onClick={toggleSound}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              soundEnabled
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                : 'bg-white border-[#d6d0c4] text-[#7B726B]'
            }`}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือนครัว' : 'เปิดเสียงแจ้งเตือนครัว'}
          >
            {soundEnabled ? <Bell size={13} className="text-amber-600 animate-bounce" /> : <BellOff size={13} />}
            <span className="hidden md:inline">{soundEnabled ? 'เสียงเปิด' : 'เสียงปิด'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadOrders(true)}
            className="rounded-xl border border-[#d6d0c4] bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-bold text-[#302221] shadow-xs active:translate-y-0.5"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => loadOrders(true)} className="underline ml-2">ลองใหม่</button>
        </div>
      )}

      {/* ── Unread Orders Alert Banner ───────────────────────────────── */}
      {unreadCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border-2 border-[#E04F34] bg-[#FFF5F2] p-3 shadow-[3px_3px_0_#E04F34] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E04F34] text-white">
              <Bell size={14} className="animate-bounce" />
            </span>
            <div>
              <p className="text-xs font-black text-[#B8321B]">
                มี {unreadCount} ออเดอร์ใหม่ที่ยังไม่ได้เปิดอ่าน!
              </p>
              <p className="text-[11px] text-[#7B726B]">
                กดรับออเดอร์เพื่อเปลี่ยนสถานะเป็น "กำลังจัดเสิร์ฟ" ให้ลูกค้าและครัวทราบ
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={processingId === 'all'}
            onClick={markAllAcknowledged}
            className="flex items-center gap-1.5 rounded-lg bg-[#E04F34] hover:bg-[#C93B22] px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition-all active:translate-y-0.5 disabled:opacity-50"
          >
            <CheckCheck size={14} strokeWidth={2.5} />
            <span>{processingId === 'all' ? 'กำลังบันทึก…' : 'รับทั้งหมด (กำลังจัดเสิร์ฟ)'}</span>
          </button>
        </div>
      )}

      {/* ── Controls & Filter Bar ────────────────────────────────────── */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE5DF] pb-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filterTab === 'all'
                ? 'bg-[#302221] text-white shadow-xs'
                : 'bg-white text-[#7B726B] border border-[#EAE5DF] hover:bg-gray-50'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              filterTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#F4EFEA] text-[#302221]'
            }`}>
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('unread')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filterTab === 'unread'
                ? 'bg-[#E04F34] text-white shadow-xs'
                : 'bg-white text-[#E04F34] border border-[#EAE5DF] hover:bg-red-50'
            }`}
          >
            <span>🔴 ยังไม่อ่าน</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              filterTab === 'unread' ? 'bg-white text-[#E04F34]' : 'bg-red-100 text-[#E04F34]'
            }`}>
              {unreadCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('serving')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filterTab === 'serving'
                ? 'bg-[#D97706] text-white shadow-xs'
                : 'bg-white text-[#7B726B] border border-[#EAE5DF] hover:bg-amber-50'
            }`}
          >
            <span>🟡 กำลังจัดเสิร์ฟ</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              filterTab === 'serving' ? 'bg-white text-[#D97706]' : 'bg-amber-100 text-[#92400E]'
            }`}>
              {servingCount}
            </span>
          </button>
        </div>

        {/* View Mode Toggle: Compact Grid vs Kanban Board */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-[#7B726B] hidden sm:inline">มุมมอง:</span>
          <div className="flex items-center bg-white border border-[#EAE5DF] rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === 'grid' ? 'bg-[#302221] text-white' : 'text-[#7B726B] hover:text-[#302221]'
              }`}
              title="แสดงแบบตารางกะทัดรัด (Compact Grid)"
            >
              <LayoutGrid size={13} />
              <span>การ์ดแน่น</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-[#302221] text-white' : 'text-[#7B726B] hover:text-[#302221]'
              }`}
              title="แยกคอลัมน์ ยังไม่อ่าน ⟷ กำลังจัดเสิร์ฟ (Kanban)"
            >
              <CheckCheck size={13} />
              <span>แยกคอลัมน์</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-[#EAE5DF] bg-white py-16 text-center font-bold text-xs text-[#7B726B]">
          กำลังโหลดคิวครัว…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#EAE5DF] bg-white py-16 text-center">
          <h3 className="text-base font-bold text-[#302221]">No active tickets</h3>
          <p className="mt-1 text-xs text-[#7B726B]">ยังไม่มีออเดอร์ที่ยืนยันแล้วรอเสิร์ฟในระบบ</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#EAE5DF] bg-white py-14 text-center">
          <p className="text-xs font-bold text-[#7B726B]">
            ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา "{query}"
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* --- COMPACT HIGH-DENSITY GRID (3 to 5 columns) --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5">
          {filteredOrders.map(renderTicketCard)}
        </div>
      ) : (
        /* --- KANBAN SPLIT VIEW (ยังไม่อ่าน ⟷ กำลังจัดเสิร์ฟ) --- */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Column 1: ยังไม่เคยถูกอ่าน */}
          <div className="rounded-2xl border-2 border-[#E04F34]/40 bg-[#FFFDFB] p-3 shadow-sm flex flex-col">
            <div className="mb-3 flex items-center justify-between border-b border-[#E04F34]/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                </span>
                <h2 className="text-sm font-black text-[#B8321B]">ยังไม่เคยถูกอ่าน (ออเดอร์ใหม่)</h2>
              </div>
              <span className="rounded-full bg-[#E04F34] px-2 py-0.5 text-[10px] font-black text-white">
                {orders.filter((o) => !o.acknowledgedAt).length} คิว
              </span>
            </div>

            <div className="space-y-3">
              {filteredOrders.filter((o) => !o.acknowledgedAt).length === 0 ? (
                <div className="py-12 text-center text-xs text-[#7B726B] font-bold">
                  ไม่มีออเดอร์ใหม่ค้างอยู่ยอดเยี่ยมมาก! ✨
                </div>
              ) : (
                filteredOrders.filter((o) => !o.acknowledgedAt).map(renderTicketCard)
              )}
            </div>
          </div>

          {/* Column 2: กำลังจัดเสิร์ฟ */}
          <div className="rounded-2xl border-2 border-[#2D1B17]/20 bg-[#FAF9F7] p-3 shadow-sm flex flex-col">
            <div className="mb-3 flex items-center justify-between border-b border-[#EAE5DF] pb-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#D97706]" />
                <h2 className="text-sm font-black text-[#302221]">รับทราบแล้ว / กำลังจัดเสิร์ฟ</h2>
              </div>
              <span className="rounded-full bg-[#302221] px-2 py-0.5 text-[10px] font-black text-white">
                {orders.filter((o) => !!o.acknowledgedAt).length} คิว
              </span>
            </div>

            <div className="space-y-3">
              {filteredOrders.filter((o) => !!o.acknowledgedAt).length === 0 ? (
                <div className="py-12 text-center text-xs text-[#7B726B] font-bold">
                  ยังไม่มีออเดอร์ที่อยู่ในสถานะกำลังจัดเสิร์ฟ
                </div>
              ) : (
                filteredOrders.filter((o) => !!o.acknowledgedAt).map(renderTicketCard)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
