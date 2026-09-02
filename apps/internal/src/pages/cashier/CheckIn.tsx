import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { QRCodeCanvas } from 'qrcode.react'

type DiningTable = {
  id: string
  tableNumber: string
  status: string
}

type SessionInfo = {
  id: string
  diningTableId: string
  qrCode: string
  startedAt: string
  expiresAt: string
  tableNumber?: string
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultTableId = searchParams.get('tableId') || ''
  const existingSessionId = searchParams.get('sessionId')

  const [tables, setTables] = useState<DiningTable[]>([])
  const [tableId, setTableId] = useState(defaultTableId)
  const [adultCount, setAdultCount] = useState('0')
  const [childCount, setChildCount] = useState('0')
  const [seniorCount, setSeniorCount] = useState('0')
  const [disabledCount, setDisabledCount] = useState('0')
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  
  const qrRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    apiFetch<{ diningTables: DiningTable[] }>('/cashier/dining-tables')
      .then((data) => setTables(data.diningTables.filter((t) => t.status === 'empty')))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดรายการโต๊ะไม่สำเร็จ'))
      .finally(() => setLoading(false))
    if (existingSessionId) {
      apiFetch<{ tableSession: SessionInfo }>(`/cashier/table-sessions/${existingSessionId}`)
        .then((data) => setSessionInfo(data.tableSession))
        .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลด QR Code ไม่สำเร็จ'))
    }
  }, [existingSessionId])

  const totalGuests = [adultCount, childCount, seniorCount, disabledCount]
    .map((v) => parseInt(v, 10) || 0)
    .reduce((sum, n) => sum + n, 0)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    
    if (!tableId) {
      setError('กรุณาเลือกโต๊ะ')
      return
    }
    
    // Validate inputs
    const isInvalid = [adultCount, childCount, seniorCount, disabledCount].some(v => !/^\d+$/.test(v) || parseInt(v, 10) < 0)
    if (isInvalid) {
      setError('กรุณากรอกจำนวนลูกค้าให้ถูกต้อง (เฉพาะตัวเลขจำนวนเต็มบวก)')
      return
    }

    if (totalGuests <= 0) {
      setError('ต้องมีลูกค้าอย่างน้อย 1 คน')
      return
    }
    
    setSubmitting(true)
    try {
      const res = await apiFetch<{ tableSession: SessionInfo }>('/cashier/table-sessions', {
        method: 'POST',
        body: JSON.stringify({
          diningTableId: tableId,
          adultCount: parseInt(adultCount, 10) || 0,
          childCount: parseInt(childCount, 10) || 0,
          seniorCount: parseInt(seniorCount, 10) || 0,
          disabledCount: parseInt(disabledCount, 10) || 0,
        }),
      })
      setSessionInfo({
        ...res.tableSession,
        tableNumber: tables.find((table) => table.id === tableId)?.tableNumber,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'เปิดโต๊ะไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegenerateQR = async () => {
    if (!sessionInfo || !confirm('การสร้าง QR Code ใหม่ จะทำให้ QR Code เก่าใช้งานไม่ได้ ยืนยันหรือไม่?')) return
    
    try {
      const res = await apiFetch<{ qrCode: string }>(`/cashier/table-sessions/${sessionInfo.id}/regenerate-qr`, { method: 'POST' })
      setSessionInfo({ ...sessionInfo, qrCode: res.qrCode })
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'ไม่สามารถสร้าง QR Code ใหม่ได้')
    }
  }

  const downloadQR = () => {
    if (!qrRef.current) return
    const url = qrRef.current.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = url
    link.download = `table-${tableId}-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const printQR = () => {
    window.print()
  }

  if (sessionInfo) {
    const tableNum = sessionInfo.tableNumber || tables.find(t => t.id === sessionInfo.diningTableId)?.tableNumber || 'Unknown'
    const expiresAt = new Date(sessionInfo.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    
    const configuredCustomerAppUrl = import.meta.env.VITE_CUSTOMER_APP_URL?.replace(/\/$/, '')
    const customerAppUrl = configuredCustomerAppUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5173` : '')
    const qrContent = customerAppUrl ? `${customerAppUrl}/landing?qr=${encodeURIComponent(sessionInfo.qrCode)}` : ''

    return (
      <div className="w-full max-w-[800px] bg-[#FDFBF7] pb-20 print:bg-white print:p-0">
        <header className="flex items-center gap-4 border-b border-[#EAE5DF] py-6 print:hidden">
          <button onClick={() => navigate('/cashier/tables')} className="rounded-full p-2 text-[#302221] hover:bg-[#F4EFEA]">
            ←
          </button>
          <div>
            <h1 className="text-[28px] font-bold text-[#302221]">เปิดโต๊ะสำเร็จ</h1>
            <p className="mt-1 text-sm text-[#7B726B]">แสกน QR Code เพื่อสั่งอาหาร</p>
          </div>
        </header>

        <div className="mt-8 flex flex-col items-center rounded-xl border border-[#EAE5DF] bg-white p-10 shadow-sm print:border-none print:shadow-none">
          <h2 className="text-3xl font-bold text-[#302221]">โต๊ะ {tableNum}</h2>
          <p className="mt-2 text-[#7B726B]">จำนวนลูกค้า: {totalGuests} ท่าน</p>
          <p className="mt-1 text-[#7B726B]">หมดเวลา: <span className="font-bold text-red-600">{expiresAt}</span> น.</p>
          
          {qrContent ? (
            <div className="mt-8 rounded-2xl border-4 border-[#302221] p-4">
              <QRCodeCanvas ref={qrRef} value={qrContent} size={250} level="H" />
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-red-300 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
              ยังไม่ได้ตั้งค่า <code>VITE_CUSTOMER_APP_URL</code> จึงยังสร้าง QR ที่ใช้กับเครื่องลูกค้าไม่ได้
            </div>
          )}
          
          {qrContent && <div className="mt-4 print:hidden">
            <a 
              href={qrContent} 
              target="_blank" 
              rel="noreferrer" 
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              [สำหรับทดสอบ] คลิกที่นี่เพื่อเปิดหน้าลูกค้าในแท็บใหม่
            </a>
          </div>}
          
          <div className="mt-10 flex w-full gap-4 print:hidden">
            <button disabled={!qrContent} onClick={downloadQR} className="flex-1 rounded-lg border border-[#EAE5DF] py-3 text-sm font-bold text-[#302221] hover:bg-[#F4EFEA] disabled:cursor-not-allowed disabled:opacity-50">
              ดาวน์โหลด QR
            </button>
            <button disabled={!qrContent} onClick={printQR} className="flex-1 rounded-lg bg-[#5A403E] py-3 text-sm font-bold text-white hover:bg-[#4A3432] disabled:cursor-not-allowed disabled:opacity-50">
              พิมพ์ QR Code
            </button>
          </div>
          
          <button onClick={handleRegenerateQR} className="mt-6 text-sm font-bold text-red-600 hover:underline print:hidden">
            รีเซ็ต / สร้าง QR Code ใหม่
          </button>
        </div>
        
        <button onClick={() => navigate('/cashier/tables')} className="mt-8 w-full rounded-lg bg-[#EAE5DF] py-4 font-bold text-[#302221] hover:bg-[#d6d0c4] print:hidden">
          กลับสู่หน้ารายการโต๊ะ
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[800px] bg-[#FDFBF7] pb-20">
      <header className="flex items-center gap-4 border-b border-[#EAE5DF] py-6">
        <button onClick={() => navigate('/cashier/tables')} className="rounded-full p-2 text-[#302221] hover:bg-[#F4EFEA]">
          ←
        </button>
        <div>
          <h1 className="text-[28px] font-bold text-[#302221]">เปิดโต๊ะ / ออก QR Code</h1>
          <p className="mt-1 text-sm text-[#7B726B]">หน้าจอสำหรับสร้าง session ใหม่ให้ลูกค้า</p>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#302221]">เลือกโต๊ะเพื่อ Check In</h2>

        {loading ? (
          <p className="mt-6 text-sm text-[#7B726B]">กำลังโหลดรายการโต๊ะ…</p>
        ) : tables.length === 0 ? (
          <p className="mt-6 text-sm text-[#7B726B]">ไม่มีโต๊ะว่างในระบบ (หรือยังไม่มีโต๊ะเลย — ต้องให้ Owner เพิ่มโต๊ะก่อน)</p>
        ) : (
          <select
            required
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className="mt-4 w-full rounded-lg border border-[#EAE5DF] px-4 py-3 text-sm font-bold text-[#302221]"
          >
            <option value="">เลือกโต๊ะ…</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>โต๊ะ {table.tableNumber}</option>
            ))}
          </select>
        )}

        <h2 className="mt-8 text-xl font-bold text-[#302221]">จำนวนลูกค้า</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <HeadcountField label="ผู้ใหญ่" value={adultCount} onChange={setAdultCount} />
          <HeadcountField label="เด็ก" value={childCount} onChange={setChildCount} />
          <HeadcountField label="ผู้สูงอายุ" value={seniorCount} onChange={setSeniorCount} />
          <HeadcountField label="ผู้พิการ (ฟรี)" value={disabledCount} onChange={setDisabledCount} />
        </div>
        <p className="mt-3 text-sm font-bold text-[#7B726B]">รวมทั้งหมด: {totalGuests} คน</p>

        <button
          type="submit"
          disabled={submitting || tables.length === 0}
          className="mt-8 rounded-lg bg-[#5A403E] px-8 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? 'กำลังเปิดโต๊ะ…' : 'ยืนยันการเปิดโต๊ะและสร้าง QR'}
        </button>
      </form>
    </div>
  )
}

function HeadcountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wide text-[#7B726B]">
      {label}
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-[#EAE5DF] px-4 py-2.5 text-sm font-bold text-[#302221]"
      />
    </label>
  )
}
