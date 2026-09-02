import { useNavigate } from 'react-router-dom'
import { PackagePlus, Refrigerator, ShoppingBasket, Warehouse } from 'lucide-react'
import { useInventory } from '../../contexts/InventoryContext'

export default function StaffDashboardPage() {
  const { batches, fifoQueue } = useInventory()
  const navigate = useNavigate()

  const usable    = batches.filter((b) => b.status !== 'Expired')
  const expiring  = batches.filter((b) => b.status === 'Expiring Soon')
  const expired   = batches.filter((b) => b.status === 'Expired')

  const categoryCount = (['Meat', 'Vegetable', 'Others'] as const).map((cat) => ({
    cat,
    label: cat === 'Meat' ? 'เนื้อสัตว์' : cat === 'Vegetable' ? 'ผัก' : 'อื่นๆ',
    count: usable.filter((b) => b.category === cat).length,
  }))

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <div className="w-full max-w-[1300px] pb-12">

      {/* ── Hero banner (Brown Theme) ───────────────────────────────── */}
      <header className="anim-down d-1 relative mb-8 overflow-hidden rounded-[32px] border-2 border-[#2D1B17] bg-gradient-to-br from-[#B97861] via-[#C4845F] to-[#D9A882] px-8 py-10 shadow-[8px_8px_0_#2D1B17] transition-all hover:shadow-[12px_12px_0_#2D1B17] sm:px-10 group">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full border-[36px] border-white/10 transition-transform duration-700 group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-8 right-32 h-40 w-40 rounded-full border-[20px] border-white/10" />

        <span className="absolute bottom-6 right-8 hidden rotate-3 rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-4 py-2 text-[10px] font-black shadow-[3px_3px_0_#2D1B17] lg:inline-flex">
          FIFO FIRST! ✦
        </span>

        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex rotate-[-2deg] items-center gap-2 rounded-full border-2 border-[#2D1B17] bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B97861] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B97861]" />
            </span>
            {greeting}
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-[#2D1B17] sm:text-5xl">
            คลังพร้อม ครัวพร้อม<br />
            <span className="text-[#FFF8EF] drop-shadow-[2px_2px_0_#2D1B17]">ทุกกะก็พร้อมลุย.</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm font-semibold leading-6 text-[#563128]/90">
            เช็กล็อตคงเหลือ จัด FIFO และเคลียร์วัตถุดิบเสี่ยงก่อนเริ่มรอบ
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/staff/receive-lot')}
              className="group/btn relative flex items-center gap-2 overflow-hidden rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-3 text-sm font-black text-white shadow-[4px_4px_0_#D9B99A] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#D9B99A] active:translate-y-0.5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-xs font-black transition-transform group-hover/btn:rotate-90">
                +
              </span>
              <span>รับของเข้าคลัง</span>
            </button>

            <button
              onClick={() => navigate('/staff/transfer-to-thaw-prep')}
              className="group/btn flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-3 text-sm font-black text-[#2D1B17] shadow-[4px_4px_0_#2D1B17] transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[6px_6px_0_#2D1B17] active:translate-y-0.5"
            >
              <span>โอนย้ายสต็อก</span>
              <span className="transition-transform group-hover/btn:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Stat cards (Specific Status Colors for Usable/Expiring/Expired) ──── */}
      <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Usable - GREEN Status Indicator */}
        <StatCard
          label="พร้อมใช้"
          value={usable.length}
          detail="ล็อตที่เบิกใช้ได้ปกติ"
          icon="✓"
          accent="#F1E2CF"
          accentDark="#5C4033"
          badgeColor="bg-emerald-100 text-emerald-800 border-emerald-600"
          statusBadge="ปกติ"
          delay="d-2"
        />

        {/* 2. FIFO - Brown theme */}
        <StatCard
          label="คิว FIFO"
          value={fifoQueue.length}
          detail="รอหยิบตามลำดับ"
          icon="↳"
          accent="#DBC8B8"
          accentDark="#5C4033"
          badgeColor="bg-[#E8D8CA] text-[#2D1B17] border-[#2D1B17]/20"
          statusBadge="IN QUEUE"
          delay="d-3"
        />

        {/* 3. Expiring Soon - ORANGE Status Indicator */}
        <StatCard
          label="ใกล้หมดอายุ"
          value={expiring.length}
          detail="ต้องใช้ภายใน 3 วัน"
          icon="!"
          accent="#FEF3C7"
          accentDark="#B45309"
          badgeColor="bg-amber-100 text-amber-900 border-amber-500"
          statusBadge="ใกล้หมดอายุ"
          isWarning={expiring.length > 0}
          delay="d-4"
        />

        {/* 4. Expired - RED Status Indicator */}
        <StatCard
          label="หมดอายุ"
          value={expired.length}
          detail="ห้ามนำไปใช้เด็ดขาด"
          icon="✕"
          accent="#FEE2E2"
          accentDark="#B91C1C"
          badgeColor="bg-rose-100 text-rose-900 border-rose-500"
          statusBadge="หมดอายุ"
          isDanger={expired.length > 0}
          delay="d-5"
        />
      </section>

      {/* ── Main content grid ────────────────────────────────────────── */}
      <section className="grid gap-7 xl:grid-cols-[1.5fr_.8fr]">

        {/* FIFO queue */}
        <div className="anim-up d-3 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-white shadow-[8px_8px_0_#2D1B17] transition-all hover:shadow-[10px_10px_0_#2D1B17]">
          <div className="flex items-center justify-between border-b-2 border-[#2D1B17] bg-[#F1E2CF] px-7 py-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#7A5544]">Pick list</p>
              <h2 className="mt-1.5 text-2xl font-black text-[#2D1B17]">คิวหยิบแบบ FIFO</h2>
              <p className="mt-1 text-xs font-semibold text-[#7A5544]">หยิบตามลำดับ ลดของเสียได้สูงสุด</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rotate-2 rounded-full border-2 border-[#2D1B17] bg-white px-4 py-1.5 text-xs font-black shadow-[2px_2px_0_#2D1B17]">
                {fifoQueue.length} LOT
              </span>
              {expiring.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-900 border border-amber-500 animate-pulse">
                  <span className="font-bold">!</span> {expiring.length} ล็อตใกล้หมดอายุ
                </span>
              )}
            </div>
          </div>

          <div className="divide-y-2 divide-[#2D1B17]/10">
            {fifoQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-2xl font-black mb-4">✓</div>
                <p className="font-black text-[#2D1B17] text-lg">คลังเรียบร้อยสมบูรณ์</p>
                <p className="mt-1 text-sm text-[#947870]">ไม่มีล็อตรอหยิบตกค้าง</p>
              </div>
            ) : fifoQueue.slice(0, 6).map((batch, index) => {
              const isExpired = batch.status === 'Expired'
              const isExpiring = batch.status === 'Expiring Soon'
              return (
                <div
                  key={batch.id}
                  className={`group flex flex-col gap-4 px-7 py-5 transition-all sm:flex-row sm:items-center ${
                    isExpired
                      ? 'bg-rose-50/70 hover:bg-rose-100/70'
                      : isExpiring
                        ? 'bg-amber-50/70 hover:bg-amber-100/70'
                        : 'hover:bg-[#FFF8EF]'
                  }`}
                  style={{ animationDelay: `${200 + index * 60}ms` }}
                >
                  {/* Rank badge (Brown theme) */}
                  <div className="relative shrink-0">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#2D1B17] text-sm font-black shadow-[3px_3px_0_#2D1B17] transition-transform group-hover:rotate-0 ${
                      index === 0
                        ? 'bg-[#B97861] text-white rotate-[-3deg]'
                        : index === 1
                          ? 'bg-[#D9B99A] text-[#2D1B17] rotate-[-2deg]'
                          : 'bg-[#FFF8EF] text-[#2D1B17] rotate-[-1deg]'
                    }`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {index === 0 && (
                      <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2D1B17] text-[9px] text-white font-black border-2 border-white shadow">
                        1st
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-[#2D1B17] truncate">{batch.item}</p>
                      <span className="shrink-0 rounded-md border border-[#2D1B17]/20 bg-[#F1E2CF] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#947870]">
                        #{batch.batch}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[#80665D]">
                      <span>รับ {batch.receiveDate}</span>
                      <span className="text-[#2D1B17]/20">·</span>
                      <span>เหลือ <strong className="text-[#2D1B17]">{batch.qty}</strong></span>
                    </div>
                  </div>

                  {/* Operational Status Badges (Red / Orange / Green) */}
                  <div className="shrink-0 sm:text-right">
                    <p className={`text-xs font-black ${isExpired ? 'text-rose-700' : isExpiring ? 'text-amber-800' : 'text-[#563D35]'}`}>
                      EXP {batch.expireDate}
                    </p>
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full border-2 px-3 py-0.5 text-[10px] font-black ${
                      isExpired
                        ? 'border-rose-600 bg-rose-100 text-rose-900'
                        : isExpiring
                          ? 'border-amber-500 bg-amber-100 text-amber-900'
                          : 'border-emerald-600 bg-emerald-100 text-emerald-900'
                    }`}>
                      {isExpired ? 'หมดอายุ' : isExpiring ? 'ใกล้หมดอายุ' : 'ปกติ'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => navigate('/staff/freezer-stock')}
            className="group flex w-full items-center justify-center gap-2 border-t-2 border-[#2D1B17] bg-[#2D1B17] px-6 py-4 text-sm font-black text-white transition-all hover:bg-[#3D2821] active:bg-[#1a0f0d]"
          >
            <span>เปิดคลังทั้งหมด</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-7">

          {/* Stock mix (Brown theme) */}
          <article className="anim-up d-4 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#DBC8B8] shadow-[6px_6px_0_#2D1B17] transition-all hover:shadow-[8px_8px_0_#2D1B17]">
            <div className="flex items-center justify-between border-b-2 border-[#2D1B17]/20 bg-[#CDB9A8] px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#6F554D]">Breakdown</p>
                <h2 className="mt-1 text-lg font-black text-[#2D1B17]">Stock mix</h2>
              </div>
              <span className="text-2xl">◒</span>
            </div>

            <div className="space-y-5 p-6">
              {categoryCount.map(({ cat, label, count }, i) => {
                const pct = usable.length ? Math.max(8, (count / usable.length) * 100) : 0
                const barColors = ['#B97861', '#CFAE91', '#E8D8CA']
                return (
                  <div key={cat}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-black text-[#2D1B17]">{label}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-lg font-black text-[#2D1B17]">{count}</span>
                        <span className="text-[10px] font-bold text-[#6F554D]">LOT</span>
                      </span>
                    </div>
                    <div className="relative h-4 overflow-hidden rounded-full border-2 border-[#2D1B17] bg-white/60">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: barColors[i] }}
                      />
                      <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,.12)]" />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>

          {/* Operational Status Checklist (Red for expired, Orange for expiring) */}
          <article className="anim-up d-5 relative overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#E7C7B8] shadow-[6px_6px_0_#2D1B17] transition-all hover:shadow-[8px_8px_0_#2D1B17]">
            <span className="absolute -top-px right-6 rounded-b-xl border-x-2 border-b-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-1.5 text-[9px] font-black text-white tracking-widest">
              CHECKLIST
            </span>

            <div className="border-b-2 border-[#2D1B17]/20 px-6 py-5">
              <h2 className="text-lg font-black text-[#2D1B17]">ก่อนเปิดรอบ ✦</h2>
              <p className="mt-0.5 text-xs font-semibold text-[#8C6655]">ตรวจสอบสถานะวัตถุดิบสำคัญ</p>
            </div>

            <div className="space-y-3 p-6">
              {/* RED: Expired */}
              <TodoItem
                count={expired.length}
                label="ล็อตหมดอายุ"
                sublabel="ห้ามใช้เด็ดขาด ต้องแยกออก"
                icon="✕"
                priority="danger"
                onClick={() => navigate('/staff/freezer-stock')}
              />

              {/* ORANGE: Expiring soon */}
              <TodoItem
                count={expiring.length}
                label="ล็อตใกล้หมดอายุ"
                sublabel="ต้องหยิบใช้ก่อนภายใน 3 วัน"
                icon="!"
                priority="warning"
                onClick={() => navigate('/staff/freezer-stock')}
              />

              {/* GREEN: Usable / Normal */}
              <TodoItem
                count={usable.length}
                label="ล็อตพร้อมใช้งาน"
                sublabel="สภาพปกติ เบิกใช้ได้ตามปกติ"
                icon="✓"
                priority="normal"
                onClick={() => navigate('/staff/freezer-stock')}
              />
            </div>
          </article>

          {/* Quick Actions (Cohesive Brown Theme) */}
          <article className="anim-up d-5 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-white shadow-[6px_6px_0_#2D1B17]">
            <div className="border-b-2 border-[#2D1B17]/10 bg-[#FFF8EF] px-6 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#7A5544]">Quick Actions</p>
            </div>
            <div className="grid grid-cols-2 divide-x-2 divide-y-2 divide-[#2D1B17]/10">
              <QuickAction
                icon={PackagePlus}
                label="รับของ"
                sub="เข้าคลัง"
                onClick={() => navigate('/staff/receive-lot')}
              />
              <QuickAction
                icon={ShoppingBasket}
                label="โอนย้าย"
                sub="สต็อก"
                onClick={() => navigate('/staff/transfer-to-thaw-prep')}
              />
              <QuickAction
                icon={Warehouse}
                label="Freezer"
                sub="คลังแช่แข็ง"
                onClick={() => navigate('/staff/freezer-stock')}
              />
              <QuickAction
                icon={Refrigerator}
                label="Prep"
                sub="ตู้พักละลาย"
                onClick={() => navigate('/staff/prep-fridge')}
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, detail, icon, accent, accentDark, badgeColor, statusBadge, isWarning, isDanger, delay,
}: {
  label: string; value: number; detail: string; icon: string
  accent: string; accentDark: string; badgeColor?: string; statusBadge?: string; isWarning?: boolean; isDanger?: boolean; delay: string
}) {
  return (
    <article
      className={`anim-up ${delay} group relative overflow-hidden rounded-[24px] border-2 border-[#2D1B17] p-6 shadow-[6px_6px_0_#2D1B17] transition-all hover:-translate-y-1.5 hover:shadow-[8px_8px_0_#2D1B17] cursor-default`}
      style={{ background: accent }}
    >

      {(isWarning || isDanger) && value > 0 && (
        <span className="absolute right-4 top-4 flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isDanger ? 'bg-red-600' : 'bg-amber-500'}`} />
          <span className={`relative inline-flex h-3 w-3 rounded-full ${isDanger ? 'bg-red-600' : 'bg-amber-500'}`} />
        </span>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentDark }}>{label}</p>
        <div className="flex items-center gap-2">
          {statusBadge && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${badgeColor}`}>
              {statusBadge}
            </span>
          )}
          <span aria-hidden="true" className="text-lg font-black" style={{ color: accentDark }}>{icon}</span>
        </div>
      </div>

      <p className="count-anim mt-3 text-5xl font-black tracking-tight text-[#2D1B17]">
        {String(value).padStart(2, '0')}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#2D1B17]/20 bg-black/10">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, Math.max(10, value * 15))}%`, background: accentDark }}
          />
        </div>
        <p className="text-[10px] font-bold" style={{ color: accentDark }}>{detail}</p>
      </div>
    </article>
  )
}

function TodoItem({
  count, label, sublabel, icon, priority, onClick,
}: {
  count: number; label: string; sublabel: string; icon: string
  priority: 'danger' | 'warning' | 'normal'; onClick: () => void
}) {
  const isDanger = priority === 'danger'
  const isWarning = priority === 'warning'

  const borderClass = isDanger && count > 0
    ? 'border-2 border-rose-600 bg-rose-50 shadow-[3px_3px_0_#E11D48]'
    : isWarning && count > 0
      ? 'border-2 border-amber-600 bg-amber-50 shadow-[3px_3px_0_#D97706]'
      : 'border-2 border-emerald-600 bg-emerald-50/70 shadow-[3px_3px_0_#059669]'

  const countColor = isDanger && count > 0
    ? 'text-rose-700'
    : isWarning && count > 0
      ? 'text-amber-700'
      : 'text-emerald-800'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${borderClass}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#2D1B17] bg-white text-sm font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-black leading-none ${countColor}`}>
            {count}
          </span>
          <span className="text-sm font-black text-[#2D1B17]">{label}</span>
        </div>
        <p className="text-[11px] font-bold text-[#8C6655] mt-1">{sublabel}</p>
      </div>
      <span className="text-sm font-black text-[#2D1B17]/50">→</span>
    </button>
  )
}

function QuickAction({
  icon: Icon, label, sub, onClick,
}: {
  icon: typeof PackagePlus; label: string; sub: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 p-5 transition-all duration-200 hover:bg-[#FFF8EF]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#FFF8EF] text-[#2D1B17] transition-transform group-hover:-translate-y-1 shadow-[2px_2px_0_#2D1B17]">
        <Icon size={18} strokeWidth={2.5} />
      </span>
      <div className="text-center">
        <p className="text-xs font-black text-[#2D1B17]">{label}</p>
        <p className="text-[10px] font-semibold text-[#947870]">{sub}</p>
      </div>
    </button>
  )
}
