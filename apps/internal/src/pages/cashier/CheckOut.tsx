import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Banknote, CheckCircle2, Landmark, Printer, ReceiptText, RefreshCw, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, apiFetch } from '../../lib/api'

type PaymentMethod = 'cash' | 'promptpay'
type OrderItem = {
  name: string
  quantity: number
  servedQuantity: number
  returnedQuantity: number
  remainingQuantity: number
  status: 'pending' | 'confirmed' | 'cancelled'
  servedAt: string | null
}
type BillData = {
  session: {
    diningTableId: string; tableNumber: string
    adultCount: number; childCount: number; seniorCount: number; disabledCount: number
    pricePerAdult: string; pricePerChild: string; pricePerSenior: string; pricePerDisabled: string
    startedAt: string; expiresAt: string
  }
  total: number
  items: OrderItem[]
}
type CheckoutResult = {
  success: true
  receiptNumber: string
  payment: { paymentMethod: PaymentMethod; subtotal: number; cashReceived: number | null; changeAmount: number; paymentReference: string | null; status: 'manually_confirmed' }
}

const paymentOptions: Array<{ value: PaymentMethod; label: string; note: string; icon: typeof Banknote }> = [
  { value: 'cash', label: 'เงินสด', note: 'รับเงินและคำนวณเงินทอน', icon: Banknote },
  { value: 'promptpay', label: 'PromptPay', note: 'สแกนป้าย QR ภายนอกระบบ', icon: Landmark },
]

export default function CheckOut() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [bill, setBill] = useState<BillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [cashReceived, setCashReceived] = useState<number | ''>('')
  const [paymentReference, setPaymentReference] = useState('')
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false)
  const [unservedOrderCount, setUnservedOrderCount] = useState<number | null>(null)
  const [unservedItemCount, setUnservedItemCount] = useState(0)

  useEffect(() => {
    if (!sessionId) { setError('ไม่พบ Session ID กรุณาเลือกโต๊ะจากหน้ารายการโต๊ะ'); setLoading(false); return }
    apiFetch<BillData>(`/cashier/table-sessions/${sessionId}/bill`)
      .then(setBill)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลบิลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    if (!showCheckoutConfirm) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setShowCheckoutConfirm(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCheckoutConfirm, submitting])

  const requestCheckout = () => {
    if (!bill || submitting) return
    if (paymentMethod !== 'cash' && !paymentReference.trim()) {
      setError('กรอกเลขอ้างอิงหลังตรวจสอบการชำระเงินแล้ว')
      return
    }
    setError('')
    setShowCheckoutConfirm(true)
  }

  const handleCheckout = async () => {
    if (!sessionId || !bill || submitting) return
    if (paymentMethod !== 'cash' && !paymentReference.trim()) return setError('กรอกเลขอ้างอิงหลังตรวจสอบการชำระเงินแล้ว')
    setShowCheckoutConfirm(false)
    setSubmitting(true); setError('')
    try {
      const result = await apiFetch<CheckoutResult>(`/cashier/table-sessions/${sessionId}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, cashReceived: paymentMethod === 'cash' ? cashReceived : undefined, paymentReference: paymentMethod === 'cash' ? undefined : paymentReference.trim() }),
      })
      setCheckoutResult(result)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'UNSERVED_ORDERS') {
        setUnservedOrderCount(Number(caught.details.unservedOrderCount) || 0)
        setUnservedItemCount(Number(caught.details.unservedItemCount) || 0)
        setSubmitting(false)
        return
      }
      const message = caught instanceof Error ? caught.message : 'ชำระเงินไม่สำเร็จ'
      if (message.includes('already closed')) { alert('โต๊ะนี้ถูกเช็คเอาท์ไปแล้ว'); navigate('/cashier/tables') } else setError(message)
      setSubmitting(false)
    }
  }

  if (checkoutResult && bill) return <Receipt bill={bill} result={checkoutResult} onPrint={() => window.print()} onBack={() => navigate('/cashier/tables')} />

  const cashIsEnough = typeof cashReceived === 'number' && cashReceived >= (bill?.total || 0)
  const needsReference = paymentMethod !== 'cash'
  const submitDisabled = !bill || submitting || (paymentMethod === 'cash' && !cashIsEnough) || (needsReference && !paymentReference.trim())

  return <div className="w-full max-w-[1180px] pb-20 text-[#2D1B17]">
    <header className="anim-down d-1 relative mb-7 overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#DBC8B8] px-7 py-7 shadow-[8px_8px_0_#2D1B17]">
      <span className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-2 border-[#2D1B17]/20 bg-[#E7C7B8]" />
      <div className="relative flex items-start gap-4"><button onClick={() => navigate('/cashier/tables')} aria-label="กลับหน้ารายการโต๊ะ" className="mt-1 rounded-full border-2 border-[#2D1B17] bg-white p-2.5 shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5"><ArrowLeft size={18} /></button><div><span className="inline-flex rotate-[-2deg] items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-[10px] font-black tracking-[.14em] shadow-[2px_2px_0_#2D1B17]"><Sparkles size={12} /> CASHIER PAYMENT</span><h1 className="mt-4 text-4xl font-black tracking-[-.035em]">ชำระเงิน {bill?.session.tableNumber ? `· โต๊ะ ${bill.session.tableNumber}` : ''}</h1><p className="mt-2 text-sm font-bold text-[#6D5147]">ตรวจสอบยอด รับชำระ และปิดโต๊ะ</p></div></div>
    </header>

    {error && <div className="anim-down d-2 mb-5 rounded-2xl border-2 border-red-700 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

    {loading ? <div className="anim-up rounded-[26px] border-2 border-[#2D1B17] bg-white px-6 py-20 text-center font-bold shadow-[7px_7px_0_#2D1B17]"><RefreshCw className="mx-auto mb-3 animate-spin" />กำลังโหลดข้อมูลบิล…</div>
      : !bill ? <div className="rounded-[26px] border-2 border-dashed border-[#2D1B17] bg-white px-6 py-20 text-center shadow-[7px_7px_0_#2D1B17]"><ReceiptText className="mx-auto mb-3" size={38} /><p className="text-xl font-black">ไม่พบข้อมูลบิล</p></div>
      : <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <BillSummary bill={bill} />
        <aside className="anim-up d-4 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
          <div className="border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5"><h2 className="text-xl font-black">วิธีชำระเงิน</h2><p className="mt-1 text-xs font-semibold text-[#8A7067]">เลือกและตรวจสอบก่อนยืนยันปิดโต๊ะ</p></div>
          <div className="space-y-3 p-5">{paymentOptions.map(({ value, label, note, icon: Icon }) => <button key={value} type="button" onClick={() => { setPaymentMethod(value); setError('') }} className={`flex w-full items-center gap-3 rounded-2xl border-2 border-[#2D1B17] p-3.5 text-left transition-all hover:-translate-y-0.5 ${paymentMethod === value ? 'bg-[#D9B99A] shadow-[4px_4px_0_#2D1B17]' : 'bg-white'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] ${paymentMethod === value ? 'bg-[#2D1B17] text-white' : 'bg-[#F1E2CF]'}`}><Icon size={19} /></span><span><strong className="block text-sm font-black">{label}</strong><span className="text-[11px] font-semibold text-[#765F56]">{note}</span></span></button>)}</div>

          <div className="border-t-2 border-[#2D1B17] bg-[#FFFDF9] p-5">
            {paymentMethod === 'cash' && <CashPanel total={bill.total} value={cashReceived} onChange={setCashReceived} />}
            {paymentMethod === 'promptpay' && <ExternalPaymentPanel total={bill.total} reference={paymentReference} onReferenceChange={setPaymentReference} />}
            <button disabled={submitDisabled} onClick={requestCheckout} className="mt-5 w-full rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] py-3.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#B97861] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">{submitting ? 'กำลังทำรายการ…' : 'ยืนยันการชำระเงินและปิดโต๊ะ'}</button>
          </div>
        </aside>
      </div>}

    {showCheckoutConfirm && bill && (
      <CheckoutConfirmDialog
        bill={bill}
        paymentMethod={paymentMethod}
        cashReceived={cashReceived}
        paymentReference={paymentReference}
        submitting={submitting}
        onClose={() => setShowCheckoutConfirm(false)}
        onConfirm={() => void handleCheckout()}
      />
    )}
    {unservedOrderCount !== null && createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2D1B17]/75 px-4 py-6 backdrop-blur-[3px]">
        <section role="alertdialog" aria-modal="true" aria-labelledby="unserved-title" className="w-full max-w-md overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[9px_9px_0_#2D1B17]">
          <header className="border-b-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5"><span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black"><TriangleAlert size={13} /> ORDER CHECK</span><h2 id="unserved-title" className="mt-3 text-2xl font-black">ยังปิดโต๊ะไม่ได้</h2></header>
          <div className="p-6"><p className="text-sm font-bold text-[#573D35]">ยังมี <strong className="text-xl text-red-700">{unservedItemCount}</strong> จาน จาก {unservedOrderCount} ออเดอร์ที่ยังดำเนินการไม่ครบ</p><p className="mt-2 text-xs font-semibold text-[#80675F]">กรุณาให้พนักงานเสิร์ฟ หรือคืนจำนวนที่เหลือก่อนทำรายการชำระเงิน</p></div>
          <footer className="flex justify-end gap-3 border-t-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5"><button type="button" onClick={() => setUnservedOrderCount(null)} className="rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-2.5 text-sm font-black">ปิด</button><button type="button" onClick={() => navigate('/cashier/tables')} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2.5 text-sm font-black text-white shadow-[3px_3px_0_#B97861]">กลับหน้ารายการโต๊ะ</button></footer>
        </section>
      </div>, document.body,
    )}
  </div>
}

function CheckoutConfirmDialog({ bill, paymentMethod, cashReceived, paymentReference, submitting, onClose, onConfirm }: {
  bill: BillData
  paymentMethod: PaymentMethod
  cashReceived: number | ''
  paymentReference: string
  submitting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const methodLabel = paymentMethod === 'cash' ? 'เงินสด' : 'PromptPay'
  const pendingCount = bill.items
    .filter((item) => item.status === 'pending')
    .reduce((sum, item) => sum + item.quantity, 0)

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#2D1B17]/75 px-4 py-6 backdrop-blur-[3px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="checkout-confirm-title" className="anim-up w-full max-w-lg overflow-hidden rounded-[28px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[9px_9px_0_#2D1B17]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-[#FFF8EF] px-3 py-1 text-[10px] font-black tracking-[.14em] shadow-[2px_2px_0_#2D1B17]">
              <ReceiptText size={12} /> CONFIRM PAYMENT
            </span>
            <h2 id="checkout-confirm-title" className="mt-3 text-2xl font-black">ยืนยันการชำระเงิน</h2>
            <p className="mt-1 text-xs font-bold text-[#6D5147]">ตรวจสอบข้อมูลอีกครั้งก่อนปิดโต๊ะ {bill.session.tableNumber}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="ปิด" className="rounded-full border-2 border-[#2D1B17] bg-white p-2.5 shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5 disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 border-[#2D1B17] bg-[#FFF8EF] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#80675F]">ยอดที่ต้องชำระ</p>
              <p className="mt-1 text-3xl font-black text-[#2D1B17]">฿{bill.total.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#80675F]">วิธีชำระ</p>
              <p className="mt-1 text-lg font-black text-[#2D1B17]">{methodLabel}</p>
            </div>
          </div>

          {paymentMethod === 'cash' ? (
            <div className="flex items-center justify-between rounded-2xl border-2 border-[#2D1B17] bg-white px-4 py-3.5 text-sm">
              <div><span className="block text-xs font-bold text-[#80675F]">รับเงินมา</span><strong className="text-lg">฿{Number(cashReceived).toLocaleString()}</strong></div>
              <div className="text-right"><span className="block text-xs font-bold text-[#80675F]">เงินทอน</span><strong className="text-lg text-green-800">฿{Math.max(0, Number(cashReceived) - bill.total).toLocaleString()}</strong></div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-[#2D1B17] bg-white px-4 py-3.5">
              <span className="block text-xs font-bold text-[#80675F]">เลขอ้างอิง</span>
              <strong className="mt-1 block break-all text-sm text-[#2D1B17]">{paymentReference}</strong>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="flex gap-3 rounded-2xl border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
              <TriangleAlert size={20} className="mt-0.5 shrink-0" />
              <div><p className="text-sm font-black">มีอาหารรอดำเนินการ {pendingCount} รายการ</p><p className="mt-0.5 text-xs font-semibold">เมื่อปิดโต๊ะ ออเดอร์ที่ยังรอยืนยันจะถูกยกเลิก</p></div>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-50">ตรวจสอบอีกครั้ง</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className="rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50">
            {submitting ? 'กำลังปิดโต๊ะ…' : 'ยืนยันและปิดโต๊ะ'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function BillSummary({ bill }: { bill: BillData }) {
  const lines = [
    ['ผู้ใหญ่', bill.session.adultCount, Number(bill.session.pricePerAdult)],
    ['เด็ก', bill.session.childCount, Number(bill.session.pricePerChild)],
    ['ผู้สูงอายุ', bill.session.seniorCount, Number(bill.session.pricePerSenior)],
    ['ผู้พิการ', bill.session.disabledCount, Number(bill.session.pricePerDisabled)],
  ] as const
  return <section className="anim-up d-3 overflow-hidden rounded-[26px] border-2 border-[#2D1B17] bg-white shadow-[7px_7px_0_#2D1B17]">
    <div className="flex items-center justify-between border-b-2 border-[#2D1B17] bg-[#FFF8EF] px-6 py-5"><div><h2 className="text-xl font-black">สรุปรายการ</h2><p className="mt-1 text-xs font-semibold text-[#8A7067]">ค่าบุฟเฟต์ตามจำนวนลูกค้า</p></div><span className="rounded-full border-2 border-[#2D1B17] bg-[#E8D8CA] px-3 py-1 text-xs font-black shadow-[2px_2px_0_#2D1B17]">โต๊ะ {bill.session.tableNumber}</span></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#2D1B17] text-[10px] font-black uppercase tracking-[.14em] text-white"><tr><th className="px-6 py-4">รายการบุฟเฟต์</th><th className="px-4 py-4 text-center">จำนวน</th><th className="px-4 py-4 text-right">ราคา/ท่าน</th><th className="px-6 py-4 text-right">รวม</th></tr></thead><tbody>{lines.filter(([, count]) => count > 0).map(([label, count, price]) => <tr key={label} className="border-b-2 border-[#2D1B17]/10 transition hover:bg-[#FFF8EF]"><td className="px-6 py-4 text-sm font-black">{label}</td><td className="px-4 py-4 text-center text-sm font-bold">{count}</td><td className="px-4 py-4 text-right text-sm font-bold">฿{price.toLocaleString()}</td><td className="px-6 py-4 text-right text-sm font-black">฿{(count * price).toLocaleString()}</td></tr>)}</tbody></table></div>
    {bill.items.length > 0 && <div className="border-t-2 border-[#2D1B17] px-6 py-5"><h3 className="text-sm font-black">รายการอาหารสำหรับตรวจสอบ</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['pending', 'confirmed_unserved', 'served', 'cancelled'] as const).map((status) => { const items = bill.items.filter((item) => status === 'confirmed_unserved' ? item.status === 'confirmed' && item.remainingQuantity > 0 : status === 'served' ? item.status === 'confirmed' && item.remainingQuantity === 0 : item.status === status); if (!items.length) return null; return <div key={status} className={`rounded-xl border-2 p-3 ${status === 'pending' ? 'border-amber-700/30 bg-amber-50' : status === 'confirmed_unserved' ? 'border-orange-800/30 bg-orange-50' : status === 'served' ? 'border-green-800/30 bg-green-50' : 'border-red-700/30 bg-red-50'}`}><p className="text-[10px] font-black uppercase tracking-wider">{status === 'pending' ? 'รอยืนยัน' : status === 'confirmed_unserved' ? 'ยืนยันแล้ว · รอเสิร์ฟ' : status === 'served' ? 'เสิร์ฟแล้ว' : 'ยกเลิก'}</p><ul className="mt-2 space-y-1.5 text-xs font-bold">{items.map((item, index) => <li key={`${item.name}-${index}`} className={`flex justify-between gap-3 ${status === 'cancelled' ? 'line-through opacity-60' : ''}`}><span>{item.name}</span><span className="shrink-0">{item.status === 'confirmed' ? `${item.servedQuantity}/${item.quantity - item.returnedQuantity} จาน` : `x${item.quantity}`}</span></li>)}</ul></div> })}</div></div>}
    <footer className="flex items-center justify-between border-t-2 border-[#2D1B17] bg-[#D9B99A] px-6 py-5"><span><span className="block text-[10px] font-black uppercase tracking-[.14em]">ยอดรวมสุทธิ</span><span className="text-xs font-bold text-[#6D5147]">Total payment</span></span><strong className="text-3xl font-black">฿{bill.total.toLocaleString()}</strong></footer>
  </section>
}

function CashPanel({ total, value, onChange }: { total: number; value: number | ''; onChange: (value: number | '') => void }) {
  const enough = typeof value === 'number' && value >= total
  return <div><label className="text-xs font-black uppercase tracking-wide text-[#73564C]">รับเงินมา (บาท)<input type="number" min={total} value={value} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : '')} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-xl font-black outline-none transition focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#B97861]" placeholder="0.00" /></label>{enough && <div className="mt-4 flex justify-between rounded-xl border-2 border-green-800 bg-green-50 px-4 py-3 text-green-800"><span className="font-black">เงินทอน</span><strong className="text-xl">฿{(Number(value) - total).toLocaleString()}</strong></div>}{typeof value === 'number' && value > 0 && !enough && <p className="mt-2 text-right text-xs font-black text-red-700">ยอดเงินไม่พอชำระ</p>}</div>
}

function ExternalPaymentPanel({ total, reference, onReferenceChange }: { total: number; reference: string; onReferenceChange: (value: string) => void }) {
  return <div><div className="rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] p-4 text-center shadow-[3px_3px_0_#2D1B17]"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-white"><Landmark size={21} /></span><p className="mt-3 text-sm font-black">ให้ลูกค้าสแกนป้าย PromptPay หน้าร้าน</p><p className="mt-1 text-xs font-semibold text-[#765F56]">ตรวจสอบชื่อบัญชี ยอดเงิน และสลิปก่อนยืนยัน</p><strong className="mt-3 block text-2xl font-black">฿{total.toLocaleString()}</strong></div><label className="mt-4 block text-xs font-black uppercase tracking-wide text-[#73564C]">เลขอ้างอิง / เวลาในสลิป<input value={reference} onChange={(event) => onReferenceChange(event.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-sm font-bold normal-case outline-none transition focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#B97861]" placeholder="เช่น เวลาโอน หรือเลขท้ายรายการ" /></label></div>
}

function Receipt({ bill, result, onPrint, onBack }: { bill: BillData; result: CheckoutResult; onPrint: () => void; onBack: () => void }) {
  const methodLabel = result.payment.paymentMethod === 'cash' ? 'เงินสด' : 'PromptPay'
  return <div className="w-full max-w-[800px] pb-20 text-[#2D1B17] print:bg-white print:p-0"><header className="anim-down rounded-[28px] border-2 border-[#2D1B17] bg-[#E8D8CA] px-7 py-7 shadow-[8px_8px_0_#2D1B17] print:hidden"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-green-900 bg-green-100 text-green-800 shadow-[3px_3px_0_#2D1B17]"><CheckCircle2 size={25} /></span><div><h1 className="text-3xl font-black">เช็คเอาท์สำเร็จ</h1><p className="mt-1 text-sm font-bold text-[#6D5147]">โต๊ะ {bill.session.tableNumber} พร้อมเข้าสู่ขั้นตอนเก็บโต๊ะ</p></div></div></header><section className="anim-up d-2 mx-auto mt-8 max-w-md rounded-[24px] border-2 border-[#2D1B17] bg-white p-8 shadow-[7px_7px_0_#2D1B17] print:mt-0 print:max-w-full print:border-none print:shadow-none"><div className="text-center"><h2 className="text-2xl font-black">RIMS Restaurant</h2><p className="mt-1 text-sm font-bold text-[#7B726B]">ใบเสร็จรับเงิน</p><p className="mt-4 font-black">โต๊ะ {bill.session.tableNumber}</p><p className="text-xs font-semibold text-[#7B726B]">{new Date().toLocaleDateString('th-TH')} · {result.receiptNumber}</p></div><div className="mt-6 space-y-2 border-y-2 border-dashed border-[#D9B99A] py-5 text-sm">{bill.session.adultCount > 0 && <ReceiptLine label={`ผู้ใหญ่ x${bill.session.adultCount}`} value={bill.session.adultCount * Number(bill.session.pricePerAdult)} />}{bill.session.childCount > 0 && <ReceiptLine label={`เด็ก x${bill.session.childCount}`} value={bill.session.childCount * Number(bill.session.pricePerChild)} />}{bill.session.seniorCount > 0 && <ReceiptLine label={`ผู้สูงอายุ x${bill.session.seniorCount}`} value={bill.session.seniorCount * Number(bill.session.pricePerSenior)} />}{bill.session.disabledCount > 0 && <ReceiptLine label={`ผู้พิการ x${bill.session.disabledCount}`} value={bill.session.disabledCount * Number(bill.session.pricePerDisabled)} />}</div><div className="mt-5 flex justify-between text-xl font-black"><span>ยอดสุทธิ</span><span>฿{bill.total.toLocaleString()}</span></div><div className="mt-3 rounded-xl bg-[#F1E2CF] p-3 text-right text-xs font-bold"><p>ชำระโดย: {methodLabel}</p>{result.payment.cashReceived !== null && <p>รับ ฿{result.payment.cashReceived.toLocaleString()} · ทอน ฿{result.payment.changeAmount.toLocaleString()}</p>}{result.payment.paymentReference && <p>อ้างอิง: {result.payment.paymentReference}</p>}</div><p className="mt-8 text-center text-xs font-bold text-[#7B726B]">ขอบคุณที่ใช้บริการ</p></section><div className="mx-auto mt-7 flex max-w-md gap-3 print:hidden"><button onClick={onPrint} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] py-3 text-sm font-black text-white shadow-[3px_3px_0_#B97861]"><Printer size={16} />พิมพ์ใบเสร็จ</button><button onClick={onBack} className="flex-1 rounded-xl border-2 border-[#2D1B17] bg-white py-3 text-sm font-black">กลับหน้ารายการโต๊ะ</button></div></div>
}

function ReceiptLine({ label, value }: { label: string; value: number }) { return <div className="flex justify-between"><span>{label}</span><strong>฿{value.toLocaleString()}</strong></div> }
