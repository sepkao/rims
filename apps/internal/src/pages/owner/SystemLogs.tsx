import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type SystemLog = {
  id: string
  timestamp: string
  action: string
  details: unknown
  actor: string | null
}

// ชื่อ action ที่เก็บใน DB เป็นรหัสเทคนิค (เช่น "ingredient.portion_preset_updated") — แปลงเป็นภาษาคนอ่านง่ายตรงนี้
// หมายเหตุ: 'inventory.lot_transferred' ไม่มี endpoint ที่ยิง action นี้อยู่ในโค้ดปัจจุบันแล้ว (เป็น log เก่าจากโค้ดที่หายไป/ไม่เคย commit)
// แต่ยังคงไว้เพื่อให้ log แถวเก่าที่มีอยู่จริงใน DB อ่านรู้เรื่อง ไม่ตกไป fallback เป็น JSON ดิบ
const ACTION_LABELS: Record<string, string> = {
  'ingredient.portion_preset_updated': 'แก้ไข preset วัตถุดิบ',
  'inventory.lot_received': 'รับของเข้าคลัง',
  'inventory.lot_transferred': 'โอนของไปตู้พักละลาย',
  'inventory.ingredient_fifo_transferred': 'โอนวัตถุดิบแบบ FIFO เข้าตู้พักละลาย',
  'UC-N13_call_staff': 'ลูกค้าเรียกพนักงาน',
}

type LotReceivedLine = { item?: string; category?: string; quantity?: number; storageName?: string }
type FifoAllocation = { sourceLotId?: string; sourceBatch?: string; plateCount?: number; quantityKg?: number }

// แปลง details (JSON ดิบ) ให้เป็นประโยคอ่านง่ายตาม action ที่รู้จัก — action ที่ยังไม่รู้จักจะ return null แล้วไป fallback แสดง JSON ดิบแทน กันข้อมูลตกหล่น
function describeDetails(log: SystemLog): string | null {
  const d = (log.details ?? {}) as Record<string, unknown>
  switch (log.action) {
    case 'ingredient.portion_preset_updated':
      return `ปรับ preset ปริมาณต่อถาดของวัตถุดิบ #${d.ingredientId} เป็น ${d.defaultPortionSizeKg} กก./ถาด`

    case 'inventory.lot_received':
      // โค้ดปัจจุบันรับเข้าทีละ 1 รายการ ({item, lotId, quantity, storageName})
      // แต่ log เก่าบางแถวมาจากฟีเจอร์ "รับหลายรายการใน lot เดียว" ({lines: [...], reference}) ที่ยังไม่ได้ merge เข้า main — รองรับทั้ง 2 แบบ
      if (Array.isArray(d.lines)) {
        const lines = d.lines as LotReceivedLine[]
        const summary = lines.map((line) => `${line.item ?? '?'} ${line.quantity ?? '?'} → ${line.storageName ?? '?'}`).join(', ')
        return `รับของเข้าคลัง ${lines.length} รายการ${d.reference ? ` (อ้างอิง ${d.reference})` : ''}: ${summary}`
      }
      return `รับล็อต "${d.item}" เข้า ${d.storageName} จำนวน ${d.quantity} (ล็อต #${d.lotId})`

    case 'inventory.lot_transferred':
      return `โอนจากล็อต #${d.sourceLotId} ไปตู้พักละลาย ${d.plateCount} ถาด (${d.quantityKg} กก., เศษเสีย ${d.roundingLossKg ?? 0} กก., ต้นทุน ${d.unitCostPerPlate}/ถาด)`

    case 'inventory.ingredient_fifo_transferred': {
      const allocations = Array.isArray(d.allocations) ? (d.allocations as FifoAllocation[]) : []
      const breakdown = allocations.map((a) => `${a.sourceBatch ?? `ล็อต #${a.sourceLotId}`} ${a.plateCount ?? '?'} ถาด`).join(', ')
      return `โอน "${d.ingredientName}" ${d.quantityKg} กก. (${d.totalPlateCount} ถาด) เข้าตู้พักละลาย ตัดข้าม ${allocations.length} ล็อตแบบ FIFO: ${breakdown}`
    }

    case 'UC-N13_call_staff':
      return `โต๊ะ ${d.tableNumber} เรียกพนักงาน — ${d.message}`

    default:
      return null
  }
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<{ logs: SystemLog[] }>('/owner/system-logs?limit=200')
      .then((data) => setLogs(data.logs))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load system logs'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="admin-page flex h-[calc(100vh-152px)] w-full max-w-[1200px] flex-col">
      <div className="mb-6">
        <h1 className="mb-1 text-[28px] font-bold">System Activity Logs</h1>
        <p className="text-sm text-[#7B726B]">Audit events from the system_logs database table.</p>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      <div className="admin-surface flex flex-1 flex-col overflow-hidden rounded-md bg-[#FDFBF7]">
        <div className="grid min-w-[760px] grid-cols-[170px_220px_150px_1fr] border-b bg-[#F4EFEA] px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[#7B726B]"><div>Timestamp</div><div>Action</div><div>Actor</div><div>Details</div></div>
        <div className="min-w-[760px] flex-1 overflow-y-auto bg-white font-mono text-[13px]">
          {logs.map((log) => {
            const readable = describeDetails(log)
            return (
              <div key={log.id} className="grid grid-cols-[170px_220px_150px_1fr] border-b px-6 py-4 hover:bg-[#fffdf9]">
                <div className="text-[#888]">{new Date(log.timestamp).toLocaleString('th-TH')}</div>
                <div className="font-bold text-[#4A322F]" title={log.action}>{ACTION_LABELS[log.action] ?? log.action}</div>
                <div>{log.actor ?? 'System'}</div>
                {readable ? (
                  <div className="whitespace-pre-wrap font-sans text-[13px] text-[#302221]">{readable}</div>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{log.details ? JSON.stringify(log.details, null, 2) : '—'}</pre>
                )}
              </div>
            )
          })}
          {!loading && logs.length === 0 && <div className="px-6 py-10 text-center text-sm text-[#777]">ยังไม่มี system log</div>}
          {loading && <div className="px-6 py-6 text-sm font-bold text-[#777]">Loading logs…</div>}
        </div>
        <div className="border-t bg-[#F4EFEA] px-6 py-2.5 font-mono text-[10px] font-bold tracking-wider text-[#7B726B]">TOTAL RECORDS: {logs.length}</div>
      </div>
    </div>
  )
}
