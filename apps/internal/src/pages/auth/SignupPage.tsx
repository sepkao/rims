import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#fbf8f3]">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#fbf8f3]">
        
        {/* Left Form Section (สลับมาอยู่ฝั่งซ้าย) */}
        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <div className="w-full max-w-[430px]">
            <div className="mb-7">
              <h2 className="text-[32px] font-bold text-[#171717]">
                Sign up
              </h2>

              <p className="mt-1 text-sm text-[#5f5a57]">
                Access your kitchen dashboard to manage operations.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                // Logic สมัครสมาชิกเสร็จแล้วให้ไปหน้าหลัก
                navigate('/');
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

              {/* ปุ่ม Sign Up หลัก */}
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
                Sign up
                <span className="text-xl">→</span>
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

            {/* ลิงก์กลับไปหน้า Login */}
            <p className="mt-8 text-center text-sm text-[#5f5a57]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="font-bold text-[#164c3d] hover:underline transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </section>

        {/* Right Branding Section (สลับมาอยู่ฝั่งขวา) */}
        <section className="relative hidden w-1/2 flex-col bg-[#302221] px-10 py-14 text-white lg:flex items-end text-right">
          
          <div className="mb-8 flex w-full justify-end">
            <div className="relative h-16 w-20">
              <div className="absolute bottom-3 right-0 h-1 w-20 rounded-full bg-white" />
              <div className="absolute bottom-6 right-2 h-10 w-16 rounded-t-full bg-white" />
              <div className="absolute right-7 top-0 h-2 w-5 rounded-full bg-white" />
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

          {/* Temporary Illustration (คงไว้ตรงกลางด้านล่างตามเดิม) */}
          <div className="absolute bottom-12 left-1/2 w-[70%] max-w-[420px] -translate-x-1/2">
            <div className="mx-auto mb-3 h-2 w-[65%] rotate-[-14deg] rounded-full bg-black" />

            <div className="mx-auto mb-8 h-2 w-[65%] rotate-[-4deg] rounded-full bg-black" />

            <div className="relative mx-auto h-36 w-[72%] rounded-b-[120px] border-[8px] border-black border-t-0">
              <div className="absolute -top-20 left-[28%] h-24 w-10 rotate-[7deg] rounded-b-3xl border-x-[8px] border-black" />

              <div className="absolute -top-12 right-[18%] h-16 w-16 rounded-full border-[8px] border-black" />
            </div>
          </div>
        </section>
        
      </div>
    </main>
  );
}
