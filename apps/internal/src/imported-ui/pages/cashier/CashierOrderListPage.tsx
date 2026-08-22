import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 👈 1. นำเข้า useNavigate

// --- Icons ชุดใหม่สำหรับหน้านี้ ---
const Icons = {
  ForkKnife: ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#365922" : "#7B726B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2v6c0 2.2 1.8 4 4 4h0c2.2 0 4-1.8 4-4V2"></path>
      <path d="M11 2v6"></path><path d="M15 2v6"></path><path d="M11 12v10"></path>
    </svg>
  ),
  Table: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v4"></path><path d="M20 14v4"></path><path d="M2 10h20"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path>
    </svg>
  ),
  Cooking: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="M10 4v4"></path><path d="M14 2v6"></path>
    </svg>
  ),
  Hourglass: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B3ADA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>
    </svg>
  )
};

export default function CashierOrderListPage() {
  const [selectedTable, setSelectedTable] = useState('Table 2');
  const navigate = useNavigate(); // 👈 2. เรียกใช้งานฟังก์ชันสำหรับเปลี่ยนหน้า

  return (
    <div className="flex w-full h-[calc(100vh-60px)] bg-[#F8F6F1]">
      
      {/* ---------------- ซ้าย: พื้นที่แสดงรายการ ---------------- */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold text-[#302221] mb-1">รายการสั่งอาหาร</h1>
          <p className="text-sm text-[#7B726B]">ข้อมูลเรียลไทม์ประจำวันนี้ - 25 มิ.ย.</p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#F0EBE1] flex flex-col justify-center">
            <span className="text-xs font-bold text-[#7B726B] mb-2">โต๊ะที่ว่าง</span>
            <span className="text-3xl font-bold text-[#34A853]">12</span>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#F0EBE1] flex flex-col justify-center">
            <span className="text-xs font-bold text-[#7B726B] mb-2">โต๊ะที่ใช้งาน</span>
            <span className="text-3xl font-bold text-[#5A403E]">05</span>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#F0EBE1] flex flex-col justify-center">
            <span className="text-xs font-bold text-[#7B726B] mb-2">รายการรอเตรียม</span>
            <span className="text-3xl font-bold text-[#302221]">08</span>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#F0EBE1] flex flex-col justify-center">
            <span className="text-xs font-bold text-[#7B726B] mb-2">รวมยอดขายวันนี้</span>
            <span className="text-3xl font-bold text-[#302221]">฿14,250</span>
          </div>
        </div>

        {/* Section: ผังที่นั่งทั้งหมด */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F0EBE1] mb-6">
          <div className="flex items-center gap-2 mb-6 text-[#302221]">
            <Icons.Table />
            <h2 className="text-lg font-bold">ผังที่นั่งทั้งหมด</h2>
          </div>
          
          <div className="flex gap-4 flex-wrap">
            {/* วนลูปแสดงโต๊ะ */}
            {['Table 1', 'Table 8', 'Table 67', 'Table 18', 'Table 2'].map((table) => {
              const isActive = table === selectedTable;
              return (
                <button 
                  key={table}
                  onClick={() => setSelectedTable(table)}
                  className={`
                    w-[100px] h-[100px] rounded-2xl flex flex-col items-center justify-center gap-2 transition-all
                    ${isActive ? 'bg-[#BDE4A7] shadow-md scale-105' : 'bg-[#EAE5DF] hover:bg-[#ded8d1]'}
                  `}
                >
                  <Icons.ForkKnife active={isActive} />
                  <span className={`text-sm font-bold ${isActive ? 'text-[#365922]' : 'text-[#5A403E]'}`}>
                    {table}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section: กำลังเตรียมอาหาร */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#F0EBE1]">
          <div className="flex items-center gap-2 mb-6 text-[#302221]">
            <Icons.Cooking />
            <h2 className="text-lg font-bold">กำลังเตรียมอาหาร</h2>
          </div>
          
          <div className="flex gap-4">
            {/* โต๊ะที่กำลังเตรียม */}
            <div className="w-[180px] p-4 rounded-xl border-2 border-dashed border-[#81C784] bg-[#F1F8E9] flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-[#BDE4A7] rounded-lg flex items-center justify-center mb-3">
                <Icons.ForkKnife active={true} />
              </div>
              <span className="font-bold text-[#302221] text-sm">Table 2</span>
              <span className="text-[10px] font-bold text-[#365922] mt-1">กำลังเตรียม (3 รายการ)</span>
            </div>

            {/* กล่องรอคิว */}
            <div className="w-[180px] p-4 rounded-xl border border-[#EAE5DF] bg-[#FAFAF8] flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-[#F0EBE1] rounded-lg flex items-center justify-center mb-3">
                <Icons.Hourglass />
              </div>
              <span className="text-xs font-medium text-[#A39D95]">รอรายการถัดไป...</span>
            </div>
          </div>
        </div>

      </div>

      {/* ---------------- ขวา: บิลและรายละเอียด (Right Panel) ---------------- */}
      <div className="w-[380px] bg-white border-l border-[#EAE5DF] flex flex-col shrink-0 shadow-lg z-10">
        
        {/* หัวบิล */}
        <div className="p-8 pb-4 flex flex-col items-center border-b border-[#F0EBE1]">
          <div className="w-32 h-32 bg-[#BDE4A7] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#365922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 2v6c0 2.2 1.8 4 4 4h0c2.2 0 4-1.8 4-4V2"></path>
              <path d="M11 2v6"></path><path d="M15 2v6"></path><path d="M11 12v10"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#302221]">โต๊ะ 2 (Table 2)</h2>
          <div className="mt-2 px-3 py-1 bg-[#365922] text-white text-[10px] font-bold tracking-wider rounded-full uppercase">
            Occupied
          </div>
        </div>

        {/* ข้อมูลลูกค้า */}
        <div className="px-8 py-5 flex justify-between items-center border-b border-[#F0EBE1]">
          <div>
            <p className="text-[11px] font-bold text-[#7B726B] mb-1">เช็คอินเมื่อ</p>
            <p className="text-sm font-bold text-[#302221]">18:15 (30 นาที)</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-[#7B726B] mb-1">จำนวนลูกค้า</p>
            <p className="text-sm font-bold text-[#302221]">4 ท่าน</p>
          </div>
        </div>

        {/* รายการอาหาร */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 text-[#7B726B] font-bold text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            รายการที่สั่ง
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-[#365922] text-white text-xs flex items-center justify-center rounded mt-0.5">2</span>
                <span className="text-sm text-[#302221] font-medium">ชุดหมูคุโรบูตะรวม</span>
              </div>
              <span className="text-sm font-bold text-[#555]">฿790</span>
            </div>
            
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-[#365922] text-white text-xs flex items-center justify-center rounded mt-0.5">1</span>
                <span className="text-sm text-[#302221] font-medium">เนื้อวากิว A4</span>
              </div>
              <span className="text-sm font-bold text-[#555]">฿1,250</span>
            </div>

            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-[#5A403E] text-white text-xs flex items-center justify-center rounded mt-0.5">4</span>
                <span className="text-sm text-[#302221] font-medium">น้ำดื่มรีฟิล</span>
              </div>
              <span className="text-sm font-bold text-[#555]">฿196</span>
            </div>
          </div>
        </div>

        {/* ส่วนชำระเงิน (ด้านล่างสุด) */}
        <div className="bg-[#EAE5DF] p-6 shrink-0 rounded-tl-2xl">
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm font-bold text-[#302221]">ยอดรวมสุทธิ</span>
            <span className="text-2xl font-black text-[#5A403E]">฿2,236</span>
          </div>
          
          <div className="flex gap-3">
            <button className="flex-1 py-3.5 bg-transparent border border-[#B3ADA5] text-[#5A403E] font-bold rounded-lg hover:bg-white transition-colors text-sm">
              พิมพ์ใบแจ้งหนี้
            </button>
            {/* 👈 3. ใส่ onClick ให้ปุ่มชำระเงินตรงนี้ */}
            <button 
              onClick={() => navigate('/cashier/payment')}
              className="flex-1 py-3.5 bg-[#5A403E] text-white font-bold rounded-lg hover:bg-[#4a322f] shadow-md transition-colors text-sm"
            >
              ชำระเงิน
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
