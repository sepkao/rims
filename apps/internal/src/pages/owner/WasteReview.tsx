import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type WasteRecord = {
  id: string
  quantity: number
  unitCostSnapshot: number
  wasteCost: number
  aiReason: string | null
  status: string
  createdAt: string
  ingredientName: string
  storageName: string
  unit: string
  expiryDate: string
}

function formatCurrency(value: number) {
  return `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
}

export default function WasteReviewPage() {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch<{ wasteRecords: WasteRecord[] }>('/owner/waste-records?status=pending_review')
      setRecords(data.wasteRecords)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดคิวตรวจของเสียไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRecords() }, [loadRecords])

  const runScan = async () => {
    setScanning(true)
    setScanMessage('')
    setError('')
    try {
      const result = await apiFetch<{ newlyFlagged: number }>('/owner/waste-records/scan', { method: 'POST' })
      setScanMessage(result.newlyFlagged > 0 ? `พบของเสียใหม่ ${result.newlyFlagged} รายการ` : 'ไม่พบของเสียใหม่ในรอบนี้')
      await loadRecords()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สแกนหาของเสียไม่สำเร็จ')
    } finally {
      setScanning(false)
    }
  }

  const review = async (id: string, status: 'confirmed' | 'rejected') => {
    setActingId(id)
    setError('')
    try {
      await apiFetch(`/owner/waste-records/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      await loadRecords()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกผลตรวจไม่สำเร็จ')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="admin-page w-full max-w-[1200px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#302221]">Waste Review Queue</h1>
          <p className="text-sm text-[#7B726B]">รายการที่ระบบเสนอว่าอาจเป็นของเสีย (ใกล้หมดอายุ 2 วัน + ไม่มีการเคลื่อนไหว 3 วัน) รอ Owner ตรวจสอบ</p>
        </div>
        <button
          disabled={scanning}
          onClick={runScan}
          className="admin-primary rounded-md bg-[#4A322F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {scanning ? 'กำลังสแกน…' : 'สแกนหาของเสียใหม่'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {scanMessage && <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{scanMessage}</div>}

      <div className="admin-surface overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#e8e3dd] bg-[#FDFBF7] px-6 py-4">
          <h2 className="text-lg font-bold text-[#302221]">รอตรวจสอบ ({records.length})</h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm font-bold text-[#7B726B]">กำลังโหลดข้อมูล…</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-[#302221]">ไม่มีรายการรอตรวจ</p>
            <p className="mt-1 text-sm text-[#7B726B]">กดปุ่ม "สแกนหาของเสียใหม่" เพื่อให้ระบบตรวจสอบล็อตที่เข้าเงื่อนไข</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b bg-[#FDFBF7] text-[10px] font-bold uppercase tracking-widest text-[#999]">
                  <th className="px-6 py-4">Ingredient</th>
                  <th className="px-6 py-4">Storage</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Expiry Date</th>
                  <th className="px-6 py-4">Est. Loss</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 text-sm font-medium text-[#302221]">{record.ingredientName}</td>
                    <td className="px-6 py-4 text-sm text-[#555]">{record.storageName}</td>
                    <td className="px-6 py-4 text-sm text-[#555]">{record.quantity} {record.unit}</td>
                    <td className="px-6 py-4 text-sm text-[#555]">{record.expiryDate.slice(0, 10)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-700">{formatCurrency(record.wasteCost)}</td>
                    <td className="px-6 py-4 text-xs text-[#7B726B]">{record.aiReason ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={actingId === record.id}
                          onClick={() => review(record.id, 'rejected')}
                          className="rounded-md border border-[#e0dcd5] px-3 py-1.5 text-xs font-bold text-[#555] disabled:opacity-50"
                        >
                          ปฏิเสธ
                        </button>
                        <button
                          disabled={actingId === record.id}
                          onClick={() => review(record.id, 'confirmed')}
                          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {actingId === record.id ? 'กำลังบันทึก…' : 'ยืนยันเป็นของเสีย'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
