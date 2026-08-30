import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type DiningTable = {
  id: string
  tableNumber: string
  status: string
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<DiningTable[]>([])
  const [tableId, setTableId] = useState('')
  const [adultCount, setAdultCount] = useState('0')
  const [childCount, setChildCount] = useState('0')
  const [seniorCount, setSeniorCount] = useState('0')
  const [disabledCount, setDisabledCount] = useState('0')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ diningTables: DiningTable[] }>('/cashier/dining-tables')
      .then((data) => setTables(data.diningTables.filter((t) => t.status === 'empty')))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดรายการโต๊ะไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const totalGuests = [adultCount, childCount, seniorCount, disabledCount]
    .map((v) => Number(v) || 0)
    .reduce((sum, n) => sum + n, 0)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!tableId) {
      setError('กรุณาเลือกโต๊ะ')
      return
    }
    if (totalGuests <= 0) {
      setError('ต้องมีลูกค้าอย่างน้อย 1 คน')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/cashier/table-sessions', {
        method: 'POST',
        body: JSON.stringify({
          diningTableId: tableId,
          adultCount: Number(adultCount) || 0,
          childCount: Number(childCount) || 0,
          seniorCount: Number(seniorCount) || 0,
          disabledCount: Number(disabledCount) || 0,
        }),
      })
      navigate('/cashier/tables', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'เปิดโต๊ะไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
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
