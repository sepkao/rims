import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type DiningTable = {
  id: string
  tableNumber: string
  status: 'empty' | 'occupied' | 'near_expiry' | 'expired' | 'pending_cleanup'
  activeSessionId: string | null
  startedAt?: string
  expiresAt?: string
  adultCount?: number
  childCount?: number
  seniorCount?: number
  disabledCount?: number
  pendingOrders?: number
  confirmedOrders?: number
}

function formatTimeRemaining(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return 'หมดเวลา'
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} นาที`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours} ชม. ${mins} นาที`
}

function getStatusBadge(status: DiningTable['status']) {
  switch (status) {
    case 'empty': return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">ว่าง</span>
    case 'occupied': return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">มีลูกค้า</span>
    case 'near_expiry': return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">ใกล้หมดเวลา</span>
    case 'expired': return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">หมดเวลา</span>
    case 'pending_cleanup': return <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-700">รอเก็บโต๊ะ</span>
    default: return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-800">{status}</span>
  }
}

export default function TableList() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)

  const fetchData = () => {
    apiFetch<{ diningTables: DiningTable[] }>('/cashier/dining-tables')
      .then((data) => setTables(data.diningTables))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    const tickInterval = setInterval(() => setTick(t => t + 1), 60000)
    return () => {
      clearInterval(interval)
      clearInterval(tickInterval)
    }
  }, [])

  const handleClearTable = async (tableId: string) => {
    if (!confirm('ยืนยันว่าเก็บโต๊ะเรียบร้อยแล้ว?')) return
    try {
      await apiFetch(`/cashier/dining-tables/${tableId}/clear`, { method: 'POST' })
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ไม่สามารถเก็บโต๊ะได้')
    }
  }

  const available = tables.filter(t => t.status === 'empty').length
  const occupied = tables.filter(t => t.status === 'occupied').length
  const pendingCleanup = tables.filter(t => t.status === 'pending_cleanup').length
  const openBills = tables.filter(t => t.activeSessionId).length

  return (
    <div className="w-full max-w-[1240px] bg-[#FDFBF7] pb-20">
      <header className="flex flex-col justify-between gap-4 border-b border-[#EAE5DF] py-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[28px] font-bold text-[#302221]">Table Status</h1>
          <p className="mt-1 text-sm text-[#7B726B]">สถานะโต๊ะจากระบบจัดการ (อัปเดตทุก 10 วินาที)</p>
        </div>
      </header>
      
      {error && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <section className="mt-8 grid gap-5 md:grid-cols-4">
        <Metric label="โต๊ะว่าง" value={loading ? '—' : String(available)} />
        <Metric label="มีลูกค้า" value={loading ? '—' : String(occupied)} />
        <Metric label="รอเก็บโต๊ะ" value={loading ? '—' : String(pendingCleanup)} />
        <Metric label="บิลที่เปิดอยู่" value={loading ? '—' : String(openBills)} />
      </section>
      
      <section className="mt-8 rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#302221]">โต๊ะทั้งหมด</h2>
            <p className="mt-1 text-sm text-[#7B726B]">จัดการ Check In และ Check Out</p>
          </div>
        </div>
        
        {loading ? (
          <div className="mt-8 p-14 text-center"><p className="text-[#7B726B]">กำลังโหลด...</p></div>
        ) : tables.length === 0 ? (
          <div className="mt-8 rounded-xl border-2 border-dashed border-[#EAE5DF] p-14 text-center">
            <p className="font-bold text-[#302221]">ยังไม่มีข้อมูลโต๊ะ</p>
            <p className="mt-1 text-sm text-[#7B726B]">ให้ Owner เพิ่มโต๊ะในระบบก่อน</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map(table => {
              const headCount = (Number(table.adultCount) || 0) + (Number(table.childCount) || 0) + (Number(table.seniorCount) || 0) + (Number(table.disabledCount) || 0)
              
              return (
                <div key={table.id} className="flex flex-col justify-between rounded-xl border border-[#EAE5DF] p-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#302221]">โต๊ะ {table.tableNumber}</h3>
                      {getStatusBadge(table.status)}
                    </div>
                    
                    {table.activeSessionId ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-sm text-[#7B726B]">ลูกค้า: <span className="font-medium text-[#302221]">{headCount} ท่าน</span></p>
                        {table.expiresAt && (
                          <p className="text-sm text-[#7B726B]">เหลือเวลา: <span className="font-medium text-[#302221]">{formatTimeRemaining(table.expiresAt)}</span></p>
                        )}
                        <p className="text-sm text-[#7B726B]">ออเดอร์: <span className="font-medium text-[#302221]">{table.confirmedOrders || 0}</span> (รอ <span className="text-amber-600 font-medium">{table.pendingOrders || 0}</span>)</p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <p className="text-sm text-[#7B726B]">{table.status === 'pending_cleanup' ? 'รอลูกค้าออกและทำความสะอาด' : 'พร้อมให้บริการ'}</p>
                      </div>
                    )}
                  </div>
                  
                  {table.status === 'occupied' && table.activeSessionId && (
                    <button 
                      onClick={() => navigate(`/cashier/payment?sessionId=${table.activeSessionId}`)}
                      className="mt-4 w-full rounded-lg bg-[#5A403E] py-2 text-sm font-bold text-white hover:bg-[#4A3432]"
                    >
                      Check Out
                    </button>
                  )}
                  {table.status === 'empty' && (
                    <button 
                      onClick={() => navigate('/cashier/check-in?tableId=' + table.id)}
                      className="mt-4 w-full rounded-lg border border-[#EAE5DF] py-2 text-sm font-bold text-[#302221] hover:bg-[#F4EFEA]"
                    >
                      Check In
                    </button>
                  )}
                  {table.status === 'pending_cleanup' && (
                    <button 
                      onClick={() => handleClearTable(table.id)}
                      className="mt-4 w-full rounded-lg bg-[#EAE5DF] py-2 text-sm font-bold text-[#302221] hover:bg-[#d6d0c4]"
                    >
                      เก็บโต๊ะเรียบร้อย
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#EAE5DF] bg-white p-5 shadow-sm"><p className="text-xs font-bold text-[#7B726B]">{label}</p><p className="mt-2 text-3xl font-bold text-[#302221]">{value}</p></div>
}
