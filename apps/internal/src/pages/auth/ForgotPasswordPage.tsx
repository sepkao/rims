import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // จำลองการส่ง API รีเซ็ตรหัสผ่าน
    console.log("Sending reset link to:", email);
    setIsSubmitted(true); // เปลี่ยนสถานะเพื่อแสดงข้อความสำเร็จ
  };

  return (
    <main className="min-h-screen bg-[#fbf8f3]">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#fbf8f3]">
        
        {/* Left Branding Section (ดึงมาจากหน้า Login ให้เข้าธีมเป๊ะๆ) */}
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

          <div className="absolute bottom-12 left-1/2 w-[70%] max-w-[420px] -translate-x-1/2">
            <div className="mx-auto mb-3 h-2 w-[65%] rotate-[-14deg] rounded-full bg-black" />
            <div className="mx-auto mb-8 h-2 w-[65%] rotate-[-4deg] rounded-full bg-black" />
            <div className="relative mx-auto h-36 w-[72%] rounded-b-[120px] border-[8px] border-black border-t-0">
              <div className="absolute -top-20 left-[28%] h-24 w-10 rotate-[7deg] rounded-b-3xl border-x-[8px] border-black" />
              <div className="absolute -top-12 right-[18%] h-16 w-16 rounded-full border-[8px] border-black" />
            </div>
          </div>
        </section>

        {/* Right Form Section */}
        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <div className="w-full max-w-[430px]">
            <div className="mb-7">
              <h2 className="text-[32px] font-bold text-[#171717]">
                Reset Password
              </h2>
              <p className="mt-1 text-sm text-[#5f5a57]">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {/* ดักเงื่อนไข: ถ้าส่งเมลแล้วให้โชว์ข้อความสำเร็จ ถ้ายังให้โชว์ฟอร์ม */}
            {isSubmitted ? (
              <div className="rounded-md border border-[#c9d0ce] bg-[#eef5f1] p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#164c3d] text-white text-xl">
                  ✓
                </div>
                <h3 className="mb-2 font-bold text-[#171717]">Check your email</h3>
                <p className="text-sm text-[#5f5a57]">
                  We sent a password reset link to <br/>
                  <span className="font-semibold text-[#164c3d]">{email}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-medium tracking-wide text-[#4f5357]"
                  >
                    ♙ Registered Email or Staff ID
                  </label>

                  <input
                    id="email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

                <button
                  type="submit"
                  className="
                    mt-6
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
                  Send Reset Link
                </button>
              </form>
            )}

            {/* ปุ่มกลับหน้า Login */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="
                mt-8
                flex
                w-full
                items-center
                justify-center
                gap-2
                text-sm
                font-semibold
                text-[#5f5a57]
                transition
                hover:text-[#171717]
              "
            >
              <span className="text-lg leading-none">←</span>
              Back to Sign In
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
