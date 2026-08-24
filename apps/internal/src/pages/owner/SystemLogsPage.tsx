import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type SystemLog = {
  id: string
  timestamp: string
  action: string
  details: unknown
  actor: string | null
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
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[170px_220px_150px_1fr] border-b px-6 py-4 hover:bg-[#fffdf9]">
              <div className="text-[#888]">{new Date(log.timestamp).toLocaleString('th-TH')}</div>
              <div className="font-bold text-[#4A322F]">{log.action}</div>
              <div>{log.actor ?? 'System'}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{log.details ? JSON.stringify(log.details, null, 2) : '—'}</pre>
            </div>
          ))}
          {!loading && logs.length === 0 && <div className="px-6 py-10 text-center text-sm text-[#777]">ยังไม่มี system log</div>}
          {loading && <div className="px-6 py-6 text-sm font-bold text-[#777]">Loading logs…</div>}
        </div>
        <div className="border-t bg-[#F4EFEA] px-6 py-2.5 font-mono text-[10px] font-bold tracking-wider text-[#7B726B]">TOTAL RECORDS: {logs.length}</div>
      </div>
    </div>
  )
}
