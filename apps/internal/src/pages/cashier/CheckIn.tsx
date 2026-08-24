import { useNavigate } from 'react-router-dom'

export default function CheckIn() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-[800px] bg-[#FDFBF7] pb-20">
      <header className="flex items-center gap-4 border-b border-[#EAE5DF] py-6">
        <button onClick={() => navigate('/cashier/tables')} className="rounded-full p-2 text-[#302221] hover:bg-[#F4EFEA]">
          ←
        </button>
        <div>
          <h1 className="text-[28px] font-bold text-[#302221]">เปิดโต๊ะ / ออก QR Code</h1>
          <p className="mt-1 text-sm text-[#7B726B]">หน้าจอสำหรับสร้าง session ใหม่ให้ลูกค้า</p>
        </div>
      </header>

      <section className="mt-8 rounded-xl border border-[#EAE5DF] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#302221]">เลือกโต๊ะเพื่อ Check In</h2>
        <div className="mt-6 rounded-xl border-2 border-dashed border-[#EAE5DF] p-12 text-center">
          <p className="font-bold text-[#302221]">ระบบเลือกโต๊ะ</p>
          <p className="mt-1 text-sm text-[#7B726B]">(รายการโต๊ะที่ว่างจะถูกดึงมาจาก API)</p>
          
          <button disabled className="mt-8 rounded-lg bg-[#5A403E] px-8 py-3 text-sm font-bold text-white opacity-50">
            ยืนยันการเปิดโต๊ะและสร้าง QR
          </button>
        </div>
      </section>
    </div>
  )
}
