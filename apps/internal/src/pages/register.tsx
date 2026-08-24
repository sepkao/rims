import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiFetch<{ registrationOpen: boolean }>('/auth/bootstrap-status')
      .then((data) => { if (active) setRegistrationOpen(data.registrationOpen) })
      .catch(() => { if (active) setError('ตรวจสอบสถานะการสมัครไม่สำเร็จ') })
    return () => { active = false }
  }, [])

  return (
    <main className="min-h-screen bg-[#fbf8f3] px-6 py-12">
      <section className="mx-auto w-full max-w-[500px] rounded-[28px] border-2 border-[#302221] bg-white p-8 shadow-[8px_8px_0_#694b49]">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#8b5746]">First-time setup</p>
        <h1 className="mt-2 text-3xl font-black text-[#302221]">สร้างบัญชี Owner</h1>
        <p className="mt-2 text-sm text-[#6f625d]">ใช้ได้เฉพาะครั้งแรกของระบบ หลังจากนั้น Owner จะเป็นผู้สร้างบัญชีพนักงาน</p>

        {registrationOpen === null && !error && <p className="mt-7 text-sm font-semibold text-[#6f625d]">กำลังตรวจสอบ…</p>}
        {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {registrationOpen === false && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            ระบบมีบัญชี Owner แล้ว จึงปิดการสมัครเพื่อความปลอดภัย <Link to="/login" className="font-black underline">เข้าสู่ระบบ</Link>
          </div>
        )}

        {registrationOpen && (
          <form
            className="mt-6"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const name = String(form.get('name') ?? '').trim()
              const email = String(form.get('email') ?? '').trim()
              const password = String(form.get('password') ?? '')
              const confirmPassword = String(form.get('confirmPassword') ?? '')
              if (password !== confirmPassword) {
                setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
                return
              }
              setSubmitting(true)
              setError('')
              try {
                await register(name, email, password)
                navigate('/owner/dashboard', { replace: true })
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'สมัครใช้งานไม่สำเร็จ')
              } finally {
                setSubmitting(false)
              }
            }}
          >
            <label className="block text-xs font-black uppercase tracking-wide text-[#513931]">
              ชื่อที่แสดง
              <input name="name" required autoComplete="name" className="mt-2 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
            </label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[#513931]">
              Email
              <input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
            </label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[#513931]">
              Password (อย่างน้อย 8 ตัวอักษร)
              <input name="password" type="password" minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
            </label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[#513931]">
              ยืนยัน Password
              <input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
            </label>
            <button disabled={submitting} className="mt-7 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#694b49] font-black text-white shadow-[4px_4px_0_#302221] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี Owner →'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[#6f625d]"><Link to="/login" className="font-black text-[#694b49] underline underline-offset-4">กลับหน้าเข้าสู่ระบบ</Link></p>
      </section>
    </main>
  )
}

