import { useState } from 'react'
import WasteReviewTab from './WasteReviewTab'
import NotFreshInventoryTab from './NotFreshInventoryTab'

export default function WasteManagement() {
  const [tab, setTab] = useState<'review' | 'expired'>('review')

  return (
    <div className="admin-page w-full max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#302221]">จัดการของเสีย</h1>
        <p className="mt-1 text-sm text-[#7B726B]">รายการที่ระบบเตือนล่วงหน้าก่อนหมดอายุ กับของที่หมดอายุไปแล้วจริง — รวมอยู่ในหน้าเดียว</p>
      </div>

      <div className="mb-6 inline-flex rounded-2xl border-2 border-[#2D1B17] bg-white p-1 shadow-[4px_4px_0_#2D1B17]">
        <button type="button" onClick={() => setTab('review')} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${tab === 'review' ? 'bg-[#2D1B17] text-white' : 'text-[#2D1B17]'}`}>
          รายการรอตรวจ
        </button>
        <button type="button" onClick={() => setTab('expired')} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${tab === 'expired' ? 'bg-[#2D1B17] text-white' : 'text-[#2D1B17]'}`}>
          คลังไม่สด (หมดอายุ)
        </button>
      </div>

      {tab === 'review' ? <WasteReviewTab /> : <NotFreshInventoryTab />}
    </div>
  )
}
