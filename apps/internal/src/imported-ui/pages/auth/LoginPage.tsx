import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type UserRole, useAuth } from '../../contexts/AuthContext';

// 1. ต้องมีบรรทัดนี้เพื่อประกาศสร้างหน้า LoginPage
export default function LoginPage() {
  const navigate = useNavigate(); // 2. เรียกใช้งาน navigate สำหรับเปลี่ยนหน้า
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [role, setRole] = useState<UserRole>('admin');
  const { login } = useAuth();
  const homeByRole: Record<UserRole, string> = { admin: '/admin', kitchen: '/kitchen', server: '/server', cashier: '/cashier' };

  return (
    <main className="min-h-screen bg-[#fbf8f3]">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#fbf8f3]">
        {/* Left Branding Section */}
        <section className="relative hidden w-1/2 flex-col bg-[#302221] px-10 py-14 text-white lg:flex">
          <div className="mb-8">
            <div className="relative h-16 w-20">
              <div className="absolute bottom-3 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white" />
              <div className="absolute bottom-6 left-1/2 h-10 w-16 -translate-x-1/2 rounded-t-full bg-white" />
              <div className="absolute left-1/2 top-0 h-2 w-5 -translate-x-1/2 rounded-full bg-white" />
            </div>
          </div>

          <h1
            className="
              max-w-[650px]
              text-[44px]
              font-black
              uppercase
              leading-[1.45]
              tracking-wide
              text-white
              drop-shadow-[4px_4px_0_rgba(105,70,67,0.85)]
              xl:text-[58px]
            "
          >
            Shabu
            <br />
            Inventory
            <br />
            Management
            <br />
            Systems
          </h1>

          {/* Temporary Illustration */}
          <div className="absolute bottom-12 left-1/2 w-[70%] max-w-[420px] -translate-x-1/2">
            <div className="mx-auto mb-3 h-2 w-[65%] rotate-[-14deg] rounded-full bg-black" />
            <div className="mx-auto mb-8 h-2 w-[65%] rotate-[-4deg] rounded-full bg-black" />

            <div className="relative mx-auto h-36 w-[72%] rounded-b-[120px] border-[8px] border-black border-t-0">
              <div className="absolute -top-20 left-[28%] h-24 w-10 rotate-[7deg] rounded-b-3xl border-x-[8px] border-black" />
              <div className="absolute -top-12 right-[18%] h-16 w-16 rounded-full border-[8px] border-black" />
            </div>
          </div>
        </section>

        {/* Login Section */}
        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <div className="w-full max-w-[430px]">
            <div className="mb-7">
              <h2 className="text-[32px] font-bold text-[#171717]">
                Welcome To Shabu Inventory management
              </h2>

              <p className="mt-1 text-sm text-[#5f5a57]">
                Access your kitchen dashboard to manage operations.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                login(role);
                navigate(homeByRole[role]);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-medium tracking-wide text-[#4f5357]"
                >
                  ♙ Email or Staff ID
                </label>

                <input
                  id="email"
                  type="text"
                  placeholder="chef.rossi@kitchen.com"
                  className="
                    h-12
                    w-full
                    rounded-md
                    border
                    border-[#c9d0ce]
                    bg-white
                    px-4
                    text-sm
                    outline-none
                    transition
                    placeholder:text-[#b9c1bf]
                    focus:border-[#694b49]
                    focus:ring-2
                    focus:ring-[#694b49]/10
                  "
                />
              </div>

              <div>
                <label htmlFor="role" className="mb-2 block text-xs font-medium tracking-wide text-[#4f5357]">Role</label>
                <select id="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="h-12 w-full rounded-md border border-[#c9d0ce] bg-white px-4 text-sm outline-none focus:border-[#694b49]">
                  <option value="admin">Owner / Admin</option>
                  <option value="kitchen">Kitchen Staff</option>
                  <option value="server">Service Staff</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-medium tracking-wide text-[#4f5357]"
                >
                  ♙ Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="
                      h-12
                      w-full
                      rounded-md
                      border
                      border-[#c9d0ce]
                      bg-white
                      px-4
                      pr-12
                      text-sm
                      outline-none
                      transition
                      placeholder:text-[#b9c1bf]
                      focus:border-[#694b49]
                      focus:ring-2
                      focus:ring-[#694b49]/10
                    "
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="
                      absolute
                      right-4
                      top-1/2
                      -translate-y-1/2
                      text-lg
                      text-[#77807d]
                      transition
                      hover:text-[#4e5552]
                    "
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#66615e]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 accent-[#694b49]"
                  />
                  Remember
                </label>
              </div>

              <button
                 type="button"
                  onClick={() => navigate('/forgot-password')} /* เพิ่ม onClick ตรงนี้ */
                    className="text-xs font-medium text-[#164c3d] hover:underline"
              >
                  Forgot password?
              </button>

              <button
                type="submit"
                className="
                  mt-5
                  flex
                  h-12
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-md
                  bg-[#694b49]
                  font-semibold
                  text-white
                  shadow-md
                  transition
                  hover:bg-[#5a403e]
                  active:scale-[0.99]
                "
              >
                Sign In
                <span className="text-xl">→</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/signup')} /* 3. ใส่คำสั่งเปลี่ยนหน้าตรงนี้ */
                className="
                  h-12
                  w-full
                  rounded-md
                  border
                  border-[#cec7bf]
                  bg-[#e8e3dd]
                  font-semibold
                  text-[#694b49]
                  shadow-sm
                  transition
                  hover:bg-[#ded8d1]
                "
              >
                Register
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#c8cdca]" />
              <span className="text-[10px] tracking-[0.18em] text-[#707572]">
                SECURE ACCESS
              </span>
              <div className="h-px flex-1 bg-[#c8cdca]" />
            </div>

            <button
              type="button"
              className="
                flex
                h-12
                w-full
                items-center
                justify-center
                gap-3
                rounded-md
                border
                border-[#c9d0ce]
                bg-white
                text-sm
                text-[#3e4140]
                transition
                hover:bg-[#f8f8f8]
              "
            >
              <span className="font-bold text-[#4285F4]">G</span>
              Continue with Google
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
