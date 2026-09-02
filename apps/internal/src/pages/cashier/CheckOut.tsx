import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import generatePayload from 'promptpay-qr'
import { QRCodeCanvas } from 'qrcode.react'

type OrderItem = {
  name: string
  quantity: number
  status: 'pending' | 'confirmed' | 'cancelled'
}

type BillData = {
  session: {
    diningTableId: string
    tableNumber: string
    adultCount: number
    childCount: number
    seniorCount: number
    disabledCount: number
    pricePerAdult: string
    pricePerChild: string
    pricePerSenior: string
    pricePerDisabled: string
    startedAt: string
    expiresAt: string
  }
  total: number
  items: OrderItem[]
}

type CheckoutResult = {
  success: true
  receiptNumber: string
  payment: {
    paymentMethod: 'cash' | 'promptpay' | 'card'
    subtotal: number
    cashReceived: number | null
    changeAmount: number
    paymentReference: string | null
    status: 'manually_confirmed'
  }
}

export default function CheckOut() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay' | 'card'>('cash')
  const [bill, setBill] = useState<BillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkedOut, setCheckedOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  
  // Payment specific states
  const [cashReceived, setCashReceived] = useState<number | ''>('')
  const [qrPayload, setQrPayload] = useState<string>('')
  const [paymentReference, setPaymentReference] = useState('')
  const promptpayId = import.meta.env.VITE_PROMPTPAY_ID?.trim()

  useEffect(() => {
    if (!sessionId) {
      setError('ไม่พบ Session ID กรุณาเลือกโต๊ะจากหน้ารายการโต๊ะ')
      setLoading(false)
      return
    }

    apiFetch<BillData>(`/cashier/table-sessions/${sessionId}/bill`)
      .then((data) => {
        setBill(data)
        if (promptpayId) setQrPayload(generatePayload(promptpayId, { amount: data.total }))
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลบิลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [sessionId, promptpayId])

  const handleCheckout = async () => {
    if (!sessionId || submitting) return
    if (!bill) return
    if (paymentMethod === 'promptpay' && !promptpayId) {
      setError('ยังไม่ได้ตั้งค่า VITE_PROMPTPAY_ID')
      return
    }
    if (paymentMethod !== 'cash' && !paymentReference.trim()) {
      setError('กรอกเลขอ้างอิงหลังตรวจสอบการชำระเงินแล้ว')
      return
    }
    const confirmation = paymentMethod === 'cash'
      ? `ยืนยันรับเงินสด ฿${Number(cashReceived).toLocaleString()} และปิดโต๊ะ? ออเดอร์ที่ยังรออยู่จะถูกยกเลิก`
      : `ยืนยันว่า${paymentMethod === 'promptpay' ? 'ตรวจสอบ PromptPay' : 'รูดบัตร'}สำเร็จ และปิดโต๊ะ? ออเดอร์ที่ยังรออยู่จะถูกยกเลิก`
    if (!window.confirm(confirmation)) return
    setSubmitting(true)
    setError('')
    try {
      const result = await apiFetch<CheckoutResult>(`/cashier/table-sessions/${sessionId}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
          paymentReference: paymentMethod === 'cash' ? undefined : paymentReference.trim(),
        }),
      })
      setCheckoutResult(result)
      setCheckedOut(true)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'ชำระเงินไม่สำเร็จ'
      if (msg.includes('already closed')) {
        alert('โต๊ะนี้ถูกเช็คเอาท์ไปแล้ว')
        navigate('/cashier/tables')
      } else {
        setError(msg)
      }
      setSubmitting(false)
    }
  }

  const printReceipt = () => {
    window.print()
  }

  if (checkedOut && bill && checkoutResult) {
    return (
      <div className="w-full max-w-[800px] bg-[#FDFBF7] pb-20 print:bg-white print:p-0">
        <header className="flex items-center gap-4 border-b border-[#EAE5DF] py-6 print:hidden">
          <button onClick={() => navigate('/cashier/tables')} className="rounded-full p-2 text-[#302221] hover:bg-[#F4EFEA]">
            ←
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#302221]">เช็คเอาท์สำเร็จ</h1>
            <p className="mt-1 text-sm text-[#7B726B]">ขอบคุณที่ใช้บริการ</p>
          </div>
        </header>

        <div className="mt-8 mx-auto max-w-sm rounded-xl border border-[#EAE5DF] bg-white p-8 shadow-sm print:max-w-full print:border-none print:shadow-none">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#302221]">RIMS Restaurant</h2>
            <p className="mt-1 text-[#7B726B]">ใบเสร็จรับเงิน (Receipt)</p>
            <p className="mt-4 font-bold">โต๊ะ {bill.session.tableNumber}</p>
            <p className="text-sm text-[#7B726B]">วันที่: {new Date().toLocaleDateString('th-TH')}</p>
            <p className="text-sm text-[#7B726B]">เลขที่ใบเสร็จ: {checkoutResult.receiptNumber}</p>
          </div>

          <div className="mt-6 border-t-2 border-dashed border-[#EAE5DF] pt-6">
            <div className="space-y-2 text-sm">
              {bill.session.adultCount > 0 && <div className="flex justify-between"><span>ผู้ใหญ่ x{bill.session.adultCount}</span><span>฿{(bill.session.adultCount * Number(bill.session.pricePerAdult)).toLocaleString()}</span></div>}
              {bill.session.childCount > 0 && <div className="flex justify-between"><span>เด็ก x{bill.session.childCount}</span><span>฿{(bill.session.childCount * Number(bill.session.pricePerChild)).toLocaleString()}</span></div>}
              {bill.session.seniorCount > 0 && <div className="flex justify-between"><span>ผู้สูงอายุ x{bill.session.seniorCount}</span><span>฿{(bill.session.seniorCount * Number(bill.session.pricePerSenior)).toLocaleString()}</span></div>}
              {bill.session.disabledCount > 0 && <div className="flex justify-between"><span>ผู้พิการ x{bill.session.disabledCount}</span><span>฿0</span></div>}
            </div>
          </div>
          
          <div className="mt-6 border-t-2 border-dashed border-[#EAE5DF] pt-6">
            <div className="flex justify-between text-lg font-bold">
              <span>ยอดรวมสุทธิ</span>
              <span>฿{bill.total.toLocaleString()}</span>
            </div>
            <div className="mt-2 text-right text-sm text-[#7B726B]">
              ชำระโดย: {paymentMethod === 'cash' ? 'เงินสด' : paymentMethod === 'promptpay' ? 'พร้อมเพย์' : 'บัตรเครดิต'}
            </div>
            {checkoutResult.payment.cashReceived !== null && (
              <div className="mt-1 text-right text-sm text-[#7B726B]">
                รับเงิน: ฿{checkoutResult.payment.cashReceived.toLocaleString()} / เงินทอน: ฿{checkoutResult.payment.changeAmount.toLocaleString()}
              </div>
            )}
            {checkoutResult.payment.paymentReference && (
              <div className="mt-1 text-right text-sm text-[#7B726B]">อ้างอิง: {checkoutResult.payment.paymentReference}</div>
            )}
          </div>

          <div className="mt-10 text-center text-sm text-[#7B726B]">
            ขอบคุณที่ใช้บริการ
          </div>
        </div>
        
        <div className="mt-8 mx-auto max-w-sm flex gap-4 print:hidden">
          <button onClick={printReceipt} className="flex-1 rounded-lg bg-[#5A403E] py-3 text-sm font-bold text-white hover:bg-[#4A3432]">
            พิมพ์ใบเสร็จ
          </button>
          <button onClick={() => navigate('/cashier/tables')} className="flex-1 rounded-lg border border-[#EAE5DF] bg-white py-3 text-sm font-bold text-[#302221] hover:bg-[#F4EFEA]">
            กลับหน้ารายการโต๊ะ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[1000px] bg-[#FDFBF7] pb-20">
      <header className="flex items-center gap-4 border-b border-[#EAE5DF] py-6">
        <button onClick={() => navigate('/cashier/tables')} className="rounded-full p-2 text-[#302221] hover:bg-[#F4EFEA]">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#302221]">เช็คบิล / ชำระเงิน {bill?.session?.tableNumber ? `(โต๊ะ ${bill.session.tableNumber})` : ''}</h1>
          <p className="mt-1 text-sm text-[#7B726B]">สรุปยอดและรับชำระเงิน</p>
        </div>
      </header>
      
      {error && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
          <h2 className="font-bold text-[#302221]">สรุปรายการ</h2>
          
          {loading ? (
            <div className="mt-6 p-12 text-center text-[#7B726B]">กำลังโหลดข้อมูล...</div>
          ) : !bill ? (
            <div className="mt-6 rounded-xl border-2 border-dashed border-[#EAE5DF] p-12 text-center">
              <p className="font-bold text-[#302221]">ไม่พบข้อมูลบิล</p>
            </div>
          ) : (
            <div className="mt-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EAE5DF] text-[#7B726B]">
                    <th className="pb-3 font-normal">รายการบุฟเฟต์</th>
                    <th className="pb-3 text-center font-normal">จำนวน</th>
                    <th className="pb-3 text-right font-normal">ราคา/ท่าน</th>
                    <th className="pb-3 text-right font-normal">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EFEA]">
                  {bill.session.adultCount > 0 && (
                    <tr>
                      <td className="py-3 font-medium">ผู้ใหญ่</td>
                      <td className="py-3 text-center">{bill.session.adultCount}</td>
                      <td className="py-3 text-right">฿{Number(bill.session.pricePerAdult).toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">฿{(bill.session.adultCount * Number(bill.session.pricePerAdult)).toLocaleString()}</td>
                    </tr>
                  )}
                  {bill.session.childCount > 0 && (
                    <tr>
                      <td className="py-3 font-medium">เด็ก</td>
                      <td className="py-3 text-center">{bill.session.childCount}</td>
                      <td className="py-3 text-right">฿{Number(bill.session.pricePerChild).toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">฿{(bill.session.childCount * Number(bill.session.pricePerChild)).toLocaleString()}</td>
                    </tr>
                  )}
                  {bill.session.seniorCount > 0 && (
                    <tr>
                      <td className="py-3 font-medium">ผู้สูงอายุ</td>
                      <td className="py-3 text-center">{bill.session.seniorCount}</td>
                      <td className="py-3 text-right">฿{Number(bill.session.pricePerSenior).toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">฿{(bill.session.seniorCount * Number(bill.session.pricePerSenior)).toLocaleString()}</td>
                    </tr>
                  )}
                  {bill.session.disabledCount > 0 && (
                    <tr>
                      <td className="py-3 font-medium">ผู้พิการ</td>
                      <td className="py-3 text-center">{bill.session.disabledCount}</td>
                      <td className="py-3 text-right">฿{Number(bill.session.pricePerDisabled).toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">฿{(bill.session.disabledCount * Number(bill.session.pricePerDisabled)).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#EAE5DF]">
                    <td colSpan={3} className="py-4 text-right font-bold text-[#302221]">ยอดสุทธิ (Total)</td>
                    <td className="py-4 text-right text-lg font-bold text-[#D65D5D]">฿{bill.total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              {bill.items.length > 0 && (
                <div className="mt-8 border-t border-[#EAE5DF] pt-6">
                  <h3 className="mb-4 text-sm font-bold text-[#302221]">รายการอาหารที่สั่ง (สำหรับตรวจสอบ)</h3>
                  
                  {['pending', 'confirmed', 'cancelled'].map(status => {
                    const statusItems = bill.items.filter(i => i.status === status)
                    if (statusItems.length === 0) return null
                    
                    return (
                      <div key={status} className="mb-4">
                        <h4 className={`text-xs font-bold uppercase ${status === 'pending' ? 'text-amber-600' : status === 'confirmed' ? 'text-green-600' : 'text-red-600'}`}>
                          {status === 'pending' ? 'รอเสิร์ฟ / กำลังทำ' : status === 'confirmed' ? 'เสิร์ฟแล้ว / ยืนยันแล้ว' : 'ยกเลิก'}
                        </h4>
                        <ul className="mt-2 space-y-2 text-sm text-[#7B726B]">
                          {statusItems.map((item, i) => (
                            <li key={i} className={`flex justify-between ${status === 'cancelled' ? 'line-through opacity-70' : ''}`}>
                              <span>{item.name}</span>
                              <span>x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
          <h2 className="font-bold text-[#302221]">Payment method</h2>
          <div className="mt-5 space-y-3">
            {(['cash', 'promptpay', 'card'] as const).map((method) => (
              <label key={method} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm font-bold transition-colors ${paymentMethod === method ? 'border-[#5A403E] bg-[#FDFBF7] text-[#5A403E]' : 'border-[#EAE5DF] text-[#7B726B] hover:bg-gray-50'}`}>
                <input type="radio" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} className="text-[#5A403E] focus:ring-[#5A403E]" />
                {method === 'promptpay' ? 'PromptPay' : method === 'cash' ? 'เงินสด' : 'บัตรเครดิต'}
              </label>
            ))}
          </div>
          
          {/* Payment Specific UI */}
          {bill && (
            <div className="mt-6 border-t border-[#EAE5DF] pt-6">
              {paymentMethod === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#7B726B] uppercase">รับเงินมา (บาท)</label>
                    <input 
                      type="number" 
                      min={bill.total}
                      value={cashReceived} 
                      onChange={e => setCashReceived(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 w-full rounded-lg border border-[#EAE5DF] px-4 py-2.5 font-bold text-lg focus:border-[#5A403E] focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  {typeof cashReceived === 'number' && cashReceived >= bill.total && (
                    <div className="rounded-lg bg-green-50 p-4 border border-green-200 flex justify-between items-center">
                      <span className="font-bold text-green-800">เงินทอน</span>
                      <span className="text-xl font-bold text-green-700">฿{(cashReceived - bill.total).toLocaleString()}</span>
                    </div>
                  )}
                  {typeof cashReceived === 'number' && cashReceived > 0 && cashReceived < bill.total && (
                    <div className="text-xs font-bold text-red-500 text-right">ยอดเงินไม่พอชำระ</div>
                  )}
                </div>
              )}
              
              {paymentMethod === 'promptpay' && (
                <div className="flex flex-col items-center justify-center p-4 bg-[#FDFBF7] rounded-xl border border-[#EAE5DF]">
                  <p className="text-sm font-bold text-[#1a5b8c] mb-4 flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4H10V10H4V4ZM20 4H14V10H20V4ZM14 14H20V20H14V14ZM4 14H10V20H4V14Z" fill="#1a5b8c"/>
                    </svg>
                    สแกนเพื่อชำระเงิน
                  </p>
                  {qrPayload ? <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                    <QRCodeCanvas value={qrPayload} size={180} />
                  </div> : <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">ยังไม่ได้ตั้งค่า VITE_PROMPTPAY_ID</p>}
                  <p className="mt-4 text-lg font-bold text-[#302221]">฿{bill.total.toLocaleString()}</p>
                  <label className="mt-4 w-full text-left text-xs font-bold text-[#7B726B]">
                    เลขอ้างอิง/สลิปหลังตรวจสอบแล้ว
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-[#EAE5DF] px-3 py-2 text-sm font-medium text-[#302221]"
                      placeholder="เช่น เวลาโอน หรือเลขท้ายรายการ"
                    />
                  </label>
                  <p className="mt-2 text-xs text-[#7B726B]">ระบบสร้าง QR ให้ แต่แคชเชียร์ต้องตรวจสอบการโอนก่อนยืนยัน</p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="flex flex-col items-center justify-center p-6 bg-[#FDFBF7] rounded-xl border border-[#EAE5DF] text-center">
                  <svg className="w-12 h-12 text-[#7B726B] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                  <p className="font-bold text-[#302221]">เครื่องรูดบัตร (EDC)</p>
                  <p className="text-sm text-[#7B726B] mt-1">ยอดชำระ: ฿{bill.total.toLocaleString()}</p>
                  <p className="text-xs text-[#7B726B] mt-4 p-2 bg-white rounded border border-[#EAE5DF]">กรุณาดำเนินการบนเครื่อง EDC และกดยืนยันเมื่อสำเร็จ</p>
                  <label className="mt-4 w-full text-left text-xs font-bold text-[#7B726B]">
                    เลขอ้างอิง EDC
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-[#EAE5DF] px-3 py-2 text-sm font-medium text-[#302221]"
                      placeholder="เลขอ้างอิงจากเครื่อง EDC"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          <button 
            disabled={!bill || submitting || (paymentMethod === 'cash' && (typeof cashReceived !== 'number' || cashReceived < bill.total)) || (paymentMethod === 'promptpay' && !promptpayId)}
            onClick={handleCheckout}
            className="mt-6 w-full rounded-lg bg-[#5A403E] py-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#4A3432] active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
          >
            {submitting ? 'กำลังทำรายการ...' : 'ยืนยันการชำระเงิน'}
          </button>
        </aside>
      </div>
    </div>
  )
}
