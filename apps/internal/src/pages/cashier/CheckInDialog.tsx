import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, ExternalLink, Printer, QrCode, RefreshCw, Sparkles, Users, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { apiFetch } from '../../lib/api'

type TableChoice = { id: string; tableNumber: string }

type SessionInfo = {
  id: string
  diningTableId: string
  qrCode: string
  startedAt: string
  expiresAt: string
  tableNumber?: string
  adultCount?: number
  childCount?: number
  seniorCount?: number
  disabledCount?: number
}

export default function CheckInDialog({ table, sessionId, onClose, onChanged }: { table: TableChoice; sessionId?: string; onClose: () => void; onChanged: () => void }) {
  const [adultCount, setAdultCount] = useState('0')
  const [childCount, setChildCount] = useState('0')
  const [seniorCount, setSeniorCount] = useState('0')
  const [disabledCount, setDisabledCount] = useState('0')
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const qrRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  useEffect(() => {
    if (!sessionId) return
    apiFetch<{ tableSession: SessionInfo }>(`/cashier/table-sessions/${sessionId}`)
      .then(({ tableSession }) => setSessionInfo(tableSession))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลด QR Code ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const formTotal = [adultCount, childCount, seniorCount, disabledCount].reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0)
  const sessionTotal = sessionInfo ? Number(sessionInfo.adultCount || 0) + Number(sessionInfo.childCount || 0) + Number(sessionInfo.seniorCount || 0) + Number(sessionInfo.disabledCount || 0) : 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const values = [adultCount, childCount, seniorCount, disabledCount]
    if (values.some((value) => !/^\d+$/.test(value) || parseInt(value, 10) < 0)) return setError('กรุณากรอกจำนวนลูกค้าเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
    if (formTotal <= 0) return setError('ต้องมีลูกค้าอย่างน้อย 1 คน')
    setSubmitting(true)
    try {
      const result = await apiFetch<{ tableSession: SessionInfo }>('/cashier/table-sessions', {
        method: 'POST',
        body: JSON.stringify({ diningTableId: table.id, adultCount: Number(adultCount), childCount: Number(childCount), seniorCount: Number(seniorCount), disabledCount: Number(disabledCount) }),
      })
      setSessionInfo({ ...result.tableSession, tableNumber: table.tableNumber })
      onChanged()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'เปิดโต๊ะไม่สำเร็จ') }
    finally { setSubmitting(false) }
  }

  const regenerateQr = async () => {
    if (!sessionInfo || !confirm('สร้าง QR ใหม่และยกเลิก QR เดิมใช่หรือไม่?')) return
    setSubmitting(true)
    try {
      const result = await apiFetch<{ qrCode: string }>(`/cashier/table-sessions/${sessionInfo.id}/regenerate-qr`, { method: 'POST' })
      setSessionInfo({ ...sessionInfo, qrCode: result.qrCode })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้าง QR ใหม่ไม่สำเร็จ') }
    finally { setSubmitting(false) }
  }

  const customerBaseUrl = import.meta.env.VITE_CUSTOMER_APP_URL?.replace(/\/$/, '') || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5173` : '')
  const qrContent = sessionInfo && customerBaseUrl ? `${customerBaseUrl}/landing?qr=${encodeURIComponent(sessionInfo.qrCode)}` : ''
  const downloadQr = () => {
    if (!qrRef.current) return
    const link = document.createElement('a')
    link.href = qrRef.current.toDataURL('image/png')
    link.download = `table-${table.tableNumber}-qr.png`
    link.click()
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1B17]/75 px-4 py-6 backdrop-blur-[3px] print:absolute print:bg-white" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="check-in-title" className="anim-up max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border-2 border-[#2D1B17] bg-[#FFFDF9] shadow-[9px_9px_0_#2D1B17] print:max-h-none print:border-none print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#2D1B17] bg-[#DBC8B8] px-6 py-5 print:hidden">
        <div><span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D1B17] bg-white px-3 py-1 text-[10px] font-black shadow-[2px_2px_0_#2D1B17]"><Sparkles size={12} /> TABLE CHECK IN</span><h2 id="check-in-title" className="mt-3 text-3xl font-black">โต๊ะ {sessionInfo?.tableNumber || table.tableNumber}</h2><p className="mt-1 text-xs font-bold text-[#6D5147]">{sessionInfo ? 'QR พร้อมสำหรับให้ลูกค้าสแกน' : 'ระบุจำนวนลูกค้าเพื่อเปิดโต๊ะ'}</p></div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="ปิด" className="rounded-full border-2 border-[#2D1B17] bg-white p-2.5 shadow-[2px_2px_0_#2D1B17] transition hover:-translate-y-0.5 disabled:opacity-50"><X size={18} /></button>
      </header>

      {loading ? <div className="px-6 py-20 text-center text-sm font-black text-[#7B726B]"><RefreshCw className="mx-auto mb-3 animate-spin" />กำลังโหลด QR…</div>
        : sessionInfo ? <div className="flex flex-col items-center px-6 py-7">
          <div className="flex w-full max-w-md items-center justify-between rounded-2xl border-2 border-[#2D1B17] bg-[#E8D8CA] px-4 py-3"><span className="flex items-center gap-2 text-sm font-black"><Users size={17} />ลูกค้า {sessionTotal} ท่าน</span><span className="text-xs font-black text-red-700">หมดเวลา {new Date(sessionInfo.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></div>
          {qrContent ? <><div className="mt-6 rounded-[22px] border-4 border-[#2D1B17] bg-white p-4 shadow-[6px_6px_0_#B97861]"><QRCodeCanvas ref={qrRef} value={qrContent} size={250} level="H" /></div><a href={qrContent} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-[#8B5746] underline decoration-2 underline-offset-4 print:hidden"><ExternalLink size={14} />เปิดหน้าลูกค้าเพื่อทดสอบ</a></>
            : <p className="mt-6 rounded-xl border-2 border-red-700 bg-red-50 p-4 text-sm font-bold text-red-700">ยังไม่ได้ตั้งค่า VITE_CUSTOMER_APP_URL</p>}
          {error && <p className="mt-5 w-full rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          <div className="mt-7 grid w-full grid-cols-2 gap-3 print:hidden"><button type="button" disabled={!qrContent} onClick={downloadQr} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-40"><Download size={16} />ดาวน์โหลด</button><button type="button" disabled={!qrContent} onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-3 text-sm font-black text-white shadow-[3px_3px_0_#B97861] transition hover:-translate-y-0.5 disabled:opacity-40"><Printer size={16} />พิมพ์ QR</button></div>
          <button type="button" disabled={submitting} onClick={() => void regenerateQr()} className="mt-5 inline-flex items-center gap-2 text-xs font-black text-red-700 underline decoration-2 underline-offset-4 print:hidden"><RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />สร้าง QR ใหม่</button>
        </div>
        : <form onSubmit={handleSubmit}>
          <div className="p-6"><div className="grid gap-4 sm:grid-cols-2"><HeadcountField label="ผู้ใหญ่" value={adultCount} onChange={setAdultCount} /><HeadcountField label="เด็ก" value={childCount} onChange={setChildCount} /><HeadcountField label="ผู้สูงอายุ" value={seniorCount} onChange={setSeniorCount} /><HeadcountField label="ผู้พิการ (ฟรี)" value={disabledCount} onChange={setDisabledCount} /></div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border-2 border-[#2D1B17] bg-[#F1E2CF] px-5 py-4 shadow-[3px_3px_0_#2D1B17]"><span className="text-sm font-black">ลูกค้ารวมทั้งหมด</span><strong className="text-3xl font-black">{formTotal}</strong></div>
            {error && <p role="alert" className="mt-5 rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          </div>
          <footer className="flex justify-end gap-3 border-t-2 border-[#2D1B17] bg-[#E7C7B8] px-6 py-5"><button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border-2 border-[#2D1B17] bg-white px-5 py-2.5 text-sm font-black">ยกเลิก</button><button disabled={submitting || formTotal === 0} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#2D1B17] bg-[#2D1B17] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#B97861] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"><QrCode size={16} />{submitting ? 'กำลังเปิดโต๊ะ…' : 'เปิดโต๊ะและสร้าง QR'}</button></footer>
        </form>}
    </section>
  </div>
}

function HeadcountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-black uppercase tracking-wide text-[#73564C]">{label}<input type="number" min="0" step="1" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#2D1B17] bg-white px-4 py-3 text-lg font-black outline-none transition-all focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#B97861]" /></label>
}
