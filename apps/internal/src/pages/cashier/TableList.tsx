import { useNavigate } from 'react-router-dom'

export default function CashierDashboardPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-[1240px] bg-[#FDFBF7] pb-20">
      <header className="flex flex-col justify-between gap-4 border-b border-[#EAE5DF] py-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[28px] font-bold text-[#302221]">Table Status</h1>
          <p className="mt-1 text-sm text-[#7B726B]">สถานะโต๊ะจาก cashier API</p>
        </div>
        <button onClick={() => navigate('/cashier/orders')} className="rounded-lg bg-[#4A3432] px-5 py-2.5 text-sm font-bold text-white">View Orders</button>
      </header>
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <Metric label="Available tables" value="—" />
        <Metric label="Occupied tables" value="—" />
        <Metric label="Open bills" value="—" />
      </section>
      <section className="mt-8 rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#302221]">Tables</h2>
            <p className="mt-1 text-sm text-[#7B726B]">รายการจะแสดงเมื่อเชื่อมต่อ tables API</p>
          </div>
          <button className="rounded-lg border border-[#d6d0c4] px-4 py-2 text-sm font-bold text-[#302221]">Check In</button>
        </div>
        <div className="mt-8 rounded-xl border-2 border-dashed border-[#EAE5DF] p-14 text-center">
          <p className="font-bold text-[#302221]">ยังไม่มีข้อมูลโต๊ะ</p>
          <p className="mt-1 text-sm text-[#7B726B]">หน้านี้จะแสดงข้อมูลจาก API เมื่อพร้อมใช้งาน</p>
        </div>
      </section>
    </div>
  )
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#EAE5DF] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#7B726B]">{label}</p><p className="mt-2 text-3xl font-bold text-[#302221]">{value}</p></div>
}
