import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../contexts/AuthContext'

const homeByRole: Record<Role, string> = {
  owner: '/owner/dashboard',
  staff: '/staff/dashboard',
  cashier: '/cashier/tables',
}
export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  return (
    <main className="min-h-screen bg-[#fbf8f3]">
      <div className="flex min-h-screen overflow-hidden">
        <section className="relative hidden w-1/2 flex-col overflow-hidden bg-[#302221] px-12 py-14 text-white lg:flex">
          <div className="h-14 w-16 rounded-t-full border-[7px] border-white border-b-0" />
          <h1 className="mt-8 text-6xl font-black uppercase leading-[1.18] tracking-tight text-white">
            Shabu<br />Inventory<br />Management
          </h1>
          <p className="mt-6 max-w-md text-sm font-semibold text-[#e8d8ca]">
            ระบบจัดการวัตถุดิบ ล็อต FIFO และการทำงานของร้านในที่เดียว
          </p>
          <div className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full border-[42px] border-[#694b49]" />
        </section>

        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <form
            className="w-full max-w-[430px] rounded-[28px] border-2 border-[#302221] bg-white p-8 shadow-[8px_8px_0_#694b49]"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              setSubmitting(true)
              setError('')
              try {
                const role = await login(String(form.get('email')), String(form.get('password')))
                navigate(homeByRole[role], { replace: true })
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'เข้าสู่ระบบไม่สำเร็จ')
              } finally {
                setSubmitting(false)
              }
            }}
          >
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#8b5746]">Secure access</p>
            <h2 className="mt-2 text-3xl font-black text-[#302221]">เข้าสู่ระบบ RIMS</h2>
            <p className="mt-2 text-sm text-[#6f625d]">ใช้บัญชีที่ Owner สร้างให้เพื่อเข้าใช้งาน</p>

            {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

            <label className="mt-6 block text-xs font-black uppercase tracking-wide text-[#513931]">
              Email
              <input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
            </label>

            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[#513931]">
              Password
              <div className="relative mt-2">
                <input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="h-12 w-full rounded-xl border-2 border-[#302221] bg-[#fffdf9] px-4 pr-14 text-sm outline-none focus:shadow-[3px_3px_0_#d9b99a]" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-[#694b49]">
                  {showPassword ? 'ซ่อน' : 'แสดง'}
                </button>
              </div>
            </label>

            <button disabled={submitting} className="mt-7 h-12 w-full rounded-xl border-2 border-[#302221] bg-[#694b49] font-black text-white shadow-[4px_4px_0_#302221] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ →'}
            </button>
            <p className="mt-6 text-center text-sm text-[#6f625d]">
              เปิดใช้ระบบครั้งแรก? <Link to="/register" className="font-black text-[#694b49] underline underline-offset-4">สมัคร Owner</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
