import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'

type Employee = {
  id: string
  name: string
  email: string
  role: 'owner' | 'staff' | 'cashier'
  isActive: boolean
  createdAt: string
}

export default function UserManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch<{ users: Employee[] }>('/owner/users')
      setEmployees(data.users)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const visible = useMemo(() => employees.filter((employee) =>
    `${employee.name} ${employee.email} ${employee.role}`.toLowerCase().includes(query.toLowerCase()),
  ), [employees, query])

  const staffCount = employees.filter((employee) => employee.role === 'staff').length
  const cashierCount = employees.filter((employee) => employee.role === 'cashier').length

  return (
    <div className="admin-page max-w-[1200px] w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-1 text-[28px] font-bold">Employee List</h1>
          <p className="text-sm text-[#7B726B]">ข้อมูลจากตาราง users และสิทธิ์เข้าใช้งานจริง</p>
        </div>
        <div className="flex gap-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees..." className="admin-control rounded-md border bg-white px-4 py-2 text-sm" />
          <button onClick={() => setShowCreate((value) => !value)} className="admin-primary rounded-md bg-[#4A322F] px-4 py-2.5 text-sm font-semibold text-white">+ Add Employee</button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {showCreate && <CreateUserForm onCreated={async () => { setShowCreate(false); await loadUsers() }} />}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Total Employees" value={employees.length} />
        <Stat label="Staff" value={staffCount} />
        <Stat label="Cashier" value={cashierCount} />
      </div>

      <div className="admin-surface overflow-hidden rounded-lg bg-[#FDFBF7]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b bg-[#F4EFEA] text-[11px] font-bold uppercase tracking-wider text-[#7B726B]"><th className="px-6 py-4">Name</th><th className="px-6 py-4">Employee ID</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
            <tbody className="divide-y bg-white">
              {visible.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4"><div className="font-bold text-[#302221]">{employee.name}</div><div className="text-xs text-[#7B726B]">{employee.email}</div></td>
                  <td className="px-6 py-4 font-mono text-sm">EMP-{employee.id.padStart(3, '0')}</td>
                  <td className="px-6 py-4"><span className="rounded-md border bg-[#F4EFEA] px-2.5 py-1.5 text-xs font-bold uppercase">{employee.role}</span></td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-2 text-sm ${employee.isActive ? 'text-emerald-700' : 'text-gray-500'}`}><span className={`h-2 w-2 rounded-full ${employee.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />{employee.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td className="px-6 py-4 text-sm text-[#777]">{new Date(employee.createdAt).toLocaleDateString('th-TH')}</td>
                  <td className="px-6 py-4 text-right">
                    {employee.role !== 'owner' && <button onClick={async () => { await apiFetch(`/owner/users/${employee.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !employee.isActive }) }); await loadUsers() }} className="rounded-lg border px-3 py-1.5 text-xs font-bold">{employee.isActive ? 'Disable' : 'Enable'}</button>}
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-[#777]">ไม่พบข้อมูลผู้ใช้</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-6 py-4 text-sm font-semibold text-[#7B726B]">Loading users…</div>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="admin-stat-card h-[120px] rounded-lg bg-white p-5"><div className="text-3xl font-black text-[#302221]">{value}</div><p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#7B726B]">{label}</p></div>
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <form className="admin-surface mb-6 grid gap-4 rounded-xl bg-white p-5 md:grid-cols-4" onSubmit={async (event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      setSubmitting(true)
      setError('')
      try {
        await apiFetch('/owner/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })
        await onCreated()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to create user')
      } finally {
        setSubmitting(false)
      }
    }}>
      <input name="name" required placeholder="Name" className="admin-control rounded-lg border px-3 py-2" />
      <input name="email" required type="email" placeholder="Email" className="admin-control rounded-lg border px-3 py-2" />
      <input name="password" required type="password" placeholder="Temporary password" className="admin-control rounded-lg border px-3 py-2" />
      <select name="role" className="admin-control rounded-lg border px-3 py-2"><option value="staff">Staff</option><option value="cashier">Cashier</option></select>
      {error && <div className="text-sm font-bold text-red-700 md:col-span-3">{error}</div>}
      <button disabled={submitting} className="admin-primary rounded-lg bg-[#4A322F] px-4 py-2 font-bold text-white md:col-start-4">{submitting ? 'Saving…' : 'Create user'}</button>
    </form>
  )
}
