import { useCallback, useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/api'

type PrepAlert = {
  ingredientId: string
  ingredientName: string
  availablePlates: number
  thresholdPlates: number
  shortagePlates: number
}

export default function StaffPrepAlert() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alerts, setAlerts] = useState<PrepAlert[]>([])
  const [dismissedSignature, setDismissedSignature] = useState('')

  const refresh = useCallback(async () => {
    if (role !== 'staff') return
    try {
      const data = await apiFetch<{ alerts: PrepAlert[] }>('/staff/prep-alerts')
      setAlerts(data.alerts)
    } catch {
      // The detail page presents request errors; the global alert stays quiet.
    }
  }, [role])

  useEffect(() => {
    if (role !== 'staff') {
      setAlerts([])
      return
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 10000)
    return () => window.clearInterval(interval)
  }, [refresh, role])

  const signature = alerts.map((alert) => `${alert.ingredientId}:${alert.availablePlates}:${alert.thresholdPlates}`).join('|')
  if (role !== 'staff' || alerts.length === 0 || signature === dismissedSignature || location.pathname === '/staff/notifications') return null

  const first = alerts[0]
  return (
    <aside role="alert" className="fixed bottom-5 right-5 z-50 w-[min(390px,calc(100vw-2.5rem))] overflow-hidden rounded-[22px] border-2 border-[#2D1B17] bg-amber-50 shadow-[7px_7px_0_#2D1B17]">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-amber-300 shadow-[2px_2px_0_#2D1B17]"><BellRing size={19} /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-800">Prep ต่ำกว่าเกณฑ์ {alerts.length} รายการ</p><p className="mt-1 text-sm font-black text-[#2D1B17]">{first.ingredientName} ต้องเติม {first.shortagePlates} ถาด{alerts.length > 1 ? ` และอีก ${alerts.length - 1} รายการ` : ''}</p></div>
        <button type="button" aria-label="ปิดการแจ้งเตือนชั่วคราว" onClick={() => setDismissedSignature(signature)} className="rounded-lg p-1 hover:bg-black/10"><X size={17} /></button>
      </div>
      <button type="button" onClick={() => navigate('/staff/notifications')} className="w-full border-t-2 border-[#2D1B17] bg-[#2D1B17] px-4 py-2.5 text-xs font-black text-white">ดูรายการและแปรรูป →</button>
    </aside>
  )
}
