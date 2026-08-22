import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// --- ไอคอนจาน ช้อน ส้อม (จำลองจากรูป) ---
const DiningIcon = ({ status }: { status: 'available' | 'occupied' | 'cleaning' }) => {
  const color = status === 'available' ? '#10B981' : status === 'occupied' ? '#894833' : '#9CA3AF';
  const bgColor = status === 'available' ? '#D1FAE5' : status === 'occupied' ? '#F5E6E1' : '#F3F4F6';
  
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      {/* ส้อม */}
      <svg width="18" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 2v6c0 2.2 1.8 4 4 4h0c2.2 0 4-1.8 4-4V2"></path>
        <path d="M11 2v6"></path><path d="M15 2v6"></path><path d="M11 12v10"></path>
      </svg>
      {/* จาน */}
      <div className="w-14 h-14 rounded-full border-[3px] flex items-center justify-center" style={{ borderColor: color, backgroundColor: bgColor }}>
         <div className="w-8 h-8 rounded-full bg-white opacity-50"></div>
      </div>
      {/* ช้อน */}
      <svg width="18" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0V4z"></path>
        <path d="M14 9v13"></path>
      </svg>
    </div>
  );
};

// --- Mock Data ---
type TableStatus = 'available' | 'occupied' | 'cleaning';

interface Table {
  id: string;
  name: string;
  status: TableStatus;
  pax?: number;
  timeLeft?: string; // e.g. "01:25:00"
  currentBill?: number;
}

const mockTables: Table[] = [
  { id: '1', name: 'Table 1', status: 'occupied', pax: 4, timeLeft: '01:15:30', currentBill: 1196 },
  { id: '2', name: 'Table 2', status: 'available' },
  { id: '3', name: 'Table 3', status: 'available' },
  { id: '8', name: 'Table 8', status: 'occupied', pax: 2, timeLeft: '00:20:00', currentBill: 598 }, // ใกล้หมดเวลา
  { id: '18', name: 'Table 18', status: 'occupied', pax: 6, timeLeft: '01:45:00', currentBill: 1794 },
  { id: '67', name: 'Table 67', status: 'cleaning' },
];

export default function CashierDashboardPage() {
  const [selectedTable, setSelectedTable] = useState<Table | null>(mockTables[1]); // ค่าเริ่มต้นโชว์ Table 2
  const [paxInput, setPaxInput] = useState(2);
  const [qrPrintedFor, setQrPrintedFor] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="flex w-full h-[calc(100vh-60px)]">
      
      {/* ซ้าย: พื้นที่แสดงตารางโต๊ะ (Grid) */}
      <div className="flex-1 p-8 overflow-y-auto border-r border-[#e8e3dd]">
        
        {/* Header ย่อย */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-[#302221]">Table Status</h1>
            <p className="text-sm text-[#7B726B]">Manage seating, generate QR codes, and checkout.</p>
          </div>
        </div>

        {/* Legend (คำอธิบายสี) */}
        <div className="flex gap-6 mb-8 text-sm font-bold">
          <span className="flex items-center gap-2 text-[#10B981]"><div className="w-3 h-3 rounded-full bg-[#10B981]"></div> Available</span>
          <span className="flex items-center gap-2 text-[#894833]"><div className="w-3 h-3 rounded-full bg-[#894833]"></div> Dining (Occupied)</span>
          <span className="flex items-center gap-2 text-[#9CA3AF]"><div className="w-3 h-3 rounded-full bg-[#9CA3AF]"></div> Cleaning</span>
        </div>

        {/* Table Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {mockTables.map(table => (
            <button 
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`
                bg-white p-6 rounded-xl border flex flex-col items-center justify-center transition-all shadow-sm
                ${selectedTable?.id === table.id ? 'border-[#302221] ring-2 ring-[#302221]/20 scale-[1.02]' : 'border-[#e8e3dd] hover:border-[#b8b2a8] hover:shadow-md'}
              `}
            >
              <DiningIcon status={table.status} />
              <h3 className="font-bold text-[#302221] mt-2">{table.name}</h3>
              
              {/* โชว์เวลาเฉพาะโต๊ะที่มีคน */}
              {table.status === 'occupied' && (
                <div className="mt-2 text-center">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${table.timeLeft?.startsWith('00:') ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#F4EFEA] text-[#894833]'}`}>
                    ⏱ {table.timeLeft}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ขวา: Action Panel (พื้นที่จัดการโต๊ะ) */}
      <div className="w-[380px] bg-[#FDFBF7] p-8 flex flex-col shrink-0">
        {selectedTable ? (
          <>
            <div className="flex flex-col items-center mb-8 pb-8 border-b border-[#e8e3dd]">
               <DiningIcon status={selectedTable.status} />
               <h2 className="text-2xl font-bold text-[#302221] mt-2">{selectedTable.name}</h2>
               <p className="text-sm font-semibold uppercase tracking-widest mt-1" 
                  style={{ color: selectedTable.status === 'available' ? '#10B981' : selectedTable.status === 'occupied' ? '#894833' : '#9CA3AF' }}>
                 {selectedTable.status}
               </p>
            </div>

            {/* กรณี: โต๊ะว่าง (เปิดโต๊ะ) */}
            {selectedTable.status === 'available' && (
              <div className="flex flex-col flex-1">
                <label className="text-sm font-bold text-[#555] mb-2">Number of Customers (Pax):</label>
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setPaxInput(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-full border border-[#d6d0c4] flex items-center justify-center font-bold hover:bg-[#F4EFEA]">-</button>
                  <span className="text-2xl font-bold w-12 text-center">{paxInput}</span>
                  <button onClick={() => setPaxInput(p => p + 1)} className="w-10 h-10 rounded-full border border-[#d6d0c4] flex items-center justify-center font-bold hover:bg-[#F4EFEA]">+</button>
                </div>
                
                <button onClick={() => setQrPrintedFor(selectedTable.name)} className="mt-auto w-full py-4 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-lg shadow-md transition-colors flex items-center justify-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  Open Table & Print QR
                </button>
                {qrPrintedFor === selectedTable.name && <p className="mt-3 text-center text-sm font-semibold text-emerald-700">สร้าง QR Code สำหรับ {selectedTable.name} แล้ว</p>}
              </div>
            )}

            {/* กรณี: มีลูกค้าทานอยู่ (ดูบิล / เช็คบิล) */}
            {selectedTable.status === 'occupied' && (
              <div className="flex flex-col flex-1">
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm font-bold text-[#555]">
                    <span>Customers:</span>
                    <span className="text-[#302221]">{selectedTable.pax} Pax</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-[#555]">
                    <span>Time Left:</span>
                    <span className={`text-lg ${selectedTable.timeLeft?.startsWith('00:') ? 'text-[#dc2626]' : 'text-[#894833]'}`}>
                      {selectedTable.timeLeft}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-[#e8e3dd]">
                    <span className="font-bold text-[#555]">Current Bill:</span>
                    <span className="text-2xl font-black text-[#302221]">฿{selectedTable.currentBill?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button onClick={() => navigate('/cashier/orders')} className="w-full py-3 bg-white border border-[#d6d0c4] text-[#302221] font-bold rounded-lg hover:bg-gray-50 transition-colors">
                    View Orders
                  </button>
                  <button onClick={() => navigate('/cashier/payment')} className="w-full py-4 bg-[#894833] hover:bg-[#683423] text-white font-bold rounded-lg shadow-md transition-colors">
                    Checkout
                  </button>
                </div>
              </div>
            )}

            {/* กรณี: กำลังทำความสะอาด */}
            {selectedTable.status === 'cleaning' && (
              <div className="flex flex-col flex-1 justify-end">
                <button className="w-full py-4 bg-[#4A322F] hover:bg-[#302221] text-white font-bold rounded-lg shadow-md transition-colors">
                  Mark as Available
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#999]">
            <p className="font-bold">Select a table to view details.</p>
          </div>
        )}
      </div>

    </div>
  );
}
