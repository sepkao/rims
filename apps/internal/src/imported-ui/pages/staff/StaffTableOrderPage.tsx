import { useState } from 'react';

// --- Icons ---
const Icons = {
  // ไอคอนจาน ช้อน ส้อม สไตล์ Mockup
  DiningSet: ({ className = "" }) => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="10" fill="currentColor" opacity="0.2" />
      <circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.4" />
      {/* Fork */}
      <path d="M14 16V22C14 23.1046 14.8954 24 16 24V34C16 35.1046 15.1046 36 14 36C12.8954 36 12 35.1046 12 34V24C13.1046 24 14 23.1046 14 22V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 16V20M16 16V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      {/* Spoon */}
      <path d="M34 16C34 16 36 17 36 20C36 23 34 24 34 24C32.8954 24 32 24.8954 32 26V34C32 35.1046 32.8954 36 34 36C35.1046 36 36 35.1046 36 34V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <ellipse cx="34" cy="18" rx="2" ry="4" fill="currentColor"/>
    </svg>
  ),
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
  Check: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
};

// --- Mock Data ---
// สมมติว่าตอนนี้เวลา 17:35 น.
const mockTables = [
  { 
    id: 1, number: '01', status: 'new_order', newItemsCount: 3, 
    orders: [
      { id: 101, name: 'หมูสามชั้นสไลด์', qty: 2, time: '17:32', status: 'pending' },
      { id: 102, name: 'เนื้อวากิวออสเตรเลีย', qty: 1, time: '17:32', status: 'pending' },
      { id: 103, name: 'เซตผักรวม', qty: 1, time: '17:34', status: 'pending' }
    ]
  },
  { id: 2, number: '02', status: 'eating', newItemsCount: 0, orders: [] },
  { id: 3, number: '03', status: 'empty', newItemsCount: 0, orders: [] },
  { 
    id: 4, number: '04', status: 'new_order', newItemsCount: 1, 
    orders: [
      { id: 104, name: 'กุ้งแม่น้ำ (แกะเปลือก)', qty: 3, time: '17:30', status: 'pending' }
    ]
  },
  { id: 5, number: '05', status: 'empty', newItemsCount: 0, orders: [] },
  { id: 6, number: '06', status: 'eating', newItemsCount: 0, orders: [] },
  { id: 7, number: '07', status: 'empty', newItemsCount: 0, orders: [] },
  { id: 8, number: '08', status: 'eating', newItemsCount: 0, orders: [] },
  { id: 9, number: '09', status: 'empty', newItemsCount: 0, orders: [] },
  { id: 10, number: '10', status: 'empty', newItemsCount: 0, orders: [] },
  { id: 11, number: '11', status: 'empty', newItemsCount: 0, orders: [] },
  { id: 12, number: '12', status: 'empty', newItemsCount: 0, orders: [] },
];

export default function StaffTableOrderPage() {
  // สร้าง State สำหรับเก็บว่าพนักงานกดดูโต๊ะไหนอยู่ (ค่าเริ่มต้นคือโต๊ะ 1)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(1);
  const [tables, setTables] = useState(mockTables);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  // ฟังก์ชันจำลองการกด "จัดเตรียมเสร็จสิ้น"
  const handleMarkAsDone = (orderId: number) => {
    setTables(prevTables => 
      prevTables.map(table => {
        if (table.id === selectedTableId) {
          const updatedOrders = table.orders.map(order => 
            order.id === orderId ? { ...order, status: 'done' } : order
          );
          // อัปเดตจำนวนแจ้งเตือนของโต๊ะ
          const remainingPending = updatedOrders.filter(o => o.status === 'pending').length;
          return { 
            ...table, 
            orders: updatedOrders, 
            newItemsCount: remainingPending,
            status: remainingPending === 0 && table.status === 'new_order' ? 'eating' : table.status
          };
        }
        return table;
      })
    );
  };

  return (
    <div className="w-full h-[calc(100vh-60px)] p-6 overflow-hidden bg-[#FDFBF7] flex flex-col">
      
      {/* Header ของหน้า */}
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold text-[#302221] mb-1">Dining Table Number</h1>
        <p className="text-sm text-[#7B726B]">Real-time metrics for today, Aug 15.</p>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* ---------------- ซ้าย: ตารางโต๊ะ (Grid) ---------------- */}
        <div className="flex-[2] bg-white border border-[#EAE5DF] rounded-2xl p-6 shadow-sm overflow-y-auto">
          <div className="grid grid-cols-4 gap-6">
            {tables.map(table => {
              const isSelected = table.id === selectedTableId;
              const hasNewOrder = table.status === 'new_order' && table.newItemsCount > 0;
              const isEmpty = table.status === 'empty';

              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`
                    relative flex flex-col items-center justify-center py-6 rounded-xl border-2 transition-all duration-200
                    ${isSelected ? 'border-[#5A403E] bg-[#F4EFEA]' : 'border-transparent bg-[#FAFAF9] hover:bg-[#F4EFEA] hover:border-[#EAE5DF]'}
                    ${hasNewOrder && !isSelected ? 'ring-2 ring-[#E53E3E] ring-offset-2' : ''}
                  `}
                >
                  {/* Badge แจ้งเตือนสีแดง */}
                  {hasNewOrder && (
                    <div className="absolute -top-2 -right-2 bg-[#E53E3E] text-white text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full shadow-md animate-bounce">
                      {table.newItemsCount}
                    </div>
                  )}

                  {/* Icon จานชาม */}
                  <Icons.DiningSet className={isEmpty ? "text-[#D6D0C4]" : "text-[#894833]"} />
                  
                  <span className={`mt-3 font-bold text-lg ${isEmpty ? "text-[#999]" : "text-[#302221]"}`}>
                    Table {table.number}
                  </span>
                  
                  {/* สถานะใต้โต๊ะ */}
                  <span className={`text-[11px] font-bold mt-1 px-2 py-0.5 rounded-full 
                    ${isEmpty ? 'text-[#999] bg-[#EAE5DF]' : 
                      hasNewOrder ? 'text-[#E53E3E] bg-[#FEF2F2]' : 'text-[#10B981] bg-[#D1FAE5]'}`}
                  >
                    {isEmpty ? 'ว่าง' : hasNewOrder ? 'ออเดอร์เข้า!' : 'กำลังทาน'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- ขวา: รายละเอียดออเดอร์ (Order Panel) ---------------- */}
        <div className="flex-1 bg-white border border-[#EAE5DF] rounded-2xl shadow-sm flex flex-col overflow-hidden w-[400px]">
          {selectedTable ? (
            <>
              {/* Panel Header */}
              <div className="bg-[#5A403E] px-6 py-5 flex justify-between items-center text-white shrink-0">
                <div>
                  <h2 className="text-xl font-bold">Table {selectedTable.number}</h2>
                  <p className="text-xs text-[#DDBFB5] mt-1">
                    {selectedTable.status === 'empty' ? 'ยังไม่มีลูกค้า' : 'กำลังใช้บริการ'}
                  </p>
                </div>
                {selectedTable.newItemsCount > 0 && (
                  <div className="bg-[#E53E3E] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                    <Icons.Bell />
                    <span className="font-bold text-sm">{selectedTable.newItemsCount} New</span>
                  </div>
                )}
              </div>

              {/* Panel Body (รายการอาหาร) */}
              <div className="flex-1 overflow-y-auto p-2 bg-[#FAF8F5]">
                {selectedTable.orders.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTable.orders.map(order => (
                      <div 
                        key={order.id} 
                        className={`p-4 rounded-xl flex items-center gap-4 transition-all border
                          ${order.status === 'done' ? 'bg-white opacity-50 border-transparent' : 'bg-white border-[#EAE5DF] shadow-sm'}
                        `}
                      >
                        {/* จำนวน */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg
                          ${order.status === 'done' ? 'bg-gray-100 text-gray-400' : 'bg-[#F4EFEA] text-[#5A403E]'}
                        `}>
                          x{order.qty}
                        </div>
                        
                        {/* ชื่ออาหารและเวลา */}
                        <div className="flex-1">
                          <h3 className={`font-bold text-[15px] ${order.status === 'done' ? 'text-gray-500 line-through' : 'text-[#302221]'}`}>
                            {order.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-[#999] mt-1">
                            <Icons.Clock /> สั่งเมื่อ {order.time} น.
                          </div>
                        </div>

                        {/* ปุ่มเช็คว่าทำเสร็จแล้ว */}
                        {order.status === 'pending' && (
                          <button 
                            onClick={() => handleMarkAsDone(order.id)}
                            className="w-10 h-10 bg-[#D1FAE5] hover:bg-[#10B981] hover:text-white text-[#059669] rounded-lg flex items-center justify-center transition-colors"
                            title="เตรียมเสร็จแล้ว"
                          >
                            <Icons.Check />
                          </button>
                        )}
                        {order.status === 'done' && (
                          <span className="text-xs font-bold text-[#10B981] bg-[#D1FAE5] px-2 py-1 rounded">เสร็จสิ้น</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#999] space-y-3">
                    <Icons.DiningSet className="w-16 h-16 opacity-50" />
                    <p className="text-sm font-medium">ยังไม่มีออเดอร์จากโต๊ะนี้</p>
                  </div>
                )}
              </div>

              {/* Panel Footer (ปุ่มกดยืนยันทั้งหมด) */}
              {selectedTable.newItemsCount > 0 && (
                <div className="p-4 bg-white border-t border-[#EAE5DF] shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-10">
                  <button 
                    onClick={() => {
                      selectedTable.orders.forEach(order => {
                        if (order.status === 'pending') handleMarkAsDone(order.id);
                      });
                    }}
                    className="w-full py-3.5 bg-[#5A403E] hover:bg-[#4a322f] text-white font-bold rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"
                  >
                    <Icons.Check /> ยืนยันเตรียมครบแล้วทั้งหมด
                  </button>
                </div>
              )}
            </>
          ) : (
            // กรณีไม่ได้เลือกโต๊ะใดๆ (State ว่าง)
            <div className="h-full flex flex-col items-center justify-center text-[#999]">
              <p>กรุณาคลิกเลือกโต๊ะเพื่อดูออเดอร์</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
