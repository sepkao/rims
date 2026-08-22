import { useState } from 'react';

const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  History: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  ArrowRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
};

export default function StaffKitchenQueuePage() {
  // จำลองข้อมูลตั๋วออเดอร์ (Tickets) สำหรับห้องครัว
  const [tickets, setTickets] = useState([
    {
      id: 1,
      table: "T-14",
      waitTime: "12m",
      isLate: true,
      items: [
        { qty: 1, name: "หมูสันคอสไลด์ (ใหญ่)", cat: "Mains" },
        { qty: 2, name: "เนื้อวากิวออสเตรเลีย", cat: "Mains" }
      ],
      note: "Note: No onions on sliders." // จำลองหมายเหตุ
    },
    {
      id: 2,
      table: "T-08",
      waitTime: "4m",
      isLate: false,
      items: [
        { qty: 4, name: "กุ้งแม่น้ำ (แกะเปลือก)", cat: "Seafood" },
        { qty: 1, name: "ชุดผักรวมออร์แกนิก", cat: "Sides" }
      ],
      note: ""
    },
    {
      id: 3,
      table: "T-21",
      waitTime: "18m",
      isLate: true,
      items: [
        { qty: 2, name: "เนื้อเสือร้องไห้", cat: "Mains" },
        { qty: 2, name: "ยำสาหร่าย", cat: "Appetizer" }
      ],
      note: ""
    }
  ]);

  // ฟังก์ชันกด "เตรียมเสร็จแล้ว" เพื่อเอาบิลออกจากหน้าจอ
  const markAsReady = (id: number) => {
    setTickets(prev => prev.filter(ticket => ticket.id !== id));
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#FDFBF7] p-8 pb-20">
      
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-medium text-[#302221]">Kitchen Queue</h1>
          <div className="bg-[#FCE8E8] px-3 py-1 rounded-full flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#C53030]"></div>
            <span className="text-xs font-bold text-[#C53030]">{tickets.length} Active Orders</span>
          </div>
        </div>
        <div className="relative w-[300px]">
          <input type="text" placeholder="Search orders..." className="w-full pl-9 pr-4 py-2 bg-[#F4EFEA] border border-transparent rounded-full text-sm outline-none focus:border-[#d6d0c4]" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#302221] mb-1">Live Tickets</h2>
          <p className="text-sm text-[#7B726B]">Real-time kitchen status for Today, Aug 15.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 border border-[#d6d0c4] bg-white px-4 py-2 rounded-lg text-sm font-bold text-[#302221] hover:bg-[#F4EFEA] transition-colors shadow-sm">
            <Icons.Filter /> Filter
          </button>
          <button className="flex items-center gap-2 border border-[#d6d0c4] bg-white px-4 py-2 rounded-lg text-sm font-bold text-[#302221] hover:bg-[#F4EFEA] transition-colors shadow-sm">
            <Icons.History /> History
          </button>
        </div>
      </div>

      {/* Main Content: Tickets & Sidebar */}
      <div className="grid grid-cols-[1fr_340px] gap-8">
        
        {/* Left: Tickets Grid (แสดงผลแบบ 2 คอลัมน์) */}
        <div className="grid grid-cols-2 gap-6 items-start">
          {tickets.length > 0 ? tickets.map(ticket => (
            <div key={ticket.id} className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col">
              
              <div className="flex justify-between items-end border-b border-dashed border-[#EAE5DF] pb-4 mb-4">
                <div>
                  <p className="text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-1">Table</p>
                  <h3 className="text-2xl font-bold text-[#302221] leading-none">{ticket.table}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-1">Wait Time</p>
                  <div className={`flex items-center gap-1.5 font-bold ${ticket.isLate ? 'text-[#C53030]' : 'text-[#302221]'}`}>
                    <Icons.Clock /> {ticket.waitTime}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-6">
                {ticket.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[#F4EFEA] text-[#302221] font-bold flex items-center justify-center text-sm shadow-sm">
                        {item.qty}
                      </div>
                      <span className="font-medium text-[#302221] text-[15px]">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#999]">{item.cat}</span>
                  </div>
                ))}
              </div>

              {ticket.note && (
                <div className="mb-5 border-t border-dashed border-[#EAE5DF] pt-4">
                  <p className="text-xs font-mono text-[#7B726B] italic">{ticket.note}</p>
                </div>
              )}

              <button 
                onClick={() => markAsReady(ticket.id)}
                className="w-full py-3 bg-[#4A3432] hover:bg-[#382625] text-white font-bold rounded-lg transition-colors shadow-md mt-auto"
              >
                Mark as Ready
              </button>
            </div>
          )) : (
            <div className="col-span-2 py-20 text-center border-2 border-dashed border-[#EAE5DF] rounded-xl text-[#999]">
              <h3 className="text-xl font-bold mb-2">No Active Tickets</h3>
              <p>Kitchen is clear. Good job!</p>
            </div>
          )}
        </div>

        {/* Right: Sidebar Widgets */}
        <div className="space-y-6">
          
          {/* Stock Alert */}
          <div className="bg-[#FCE8E8] border border-[#F8CACA] rounded-xl p-6 shadow-sm">
            <div className="flex gap-4 items-start mb-4">
              <div className="bg-[#C53030] text-white p-2 rounded shrink-0">
                <Icons.AlertTriangle />
              </div>
              <div>
                <h3 className="font-bold text-[#C53030] text-lg mb-1 leading-tight">Stock Alert: Critical</h3>
                <p className="text-xs text-[#C53030] leading-relaxed">
                  5 items expiring in less than 48h. Estimated value at risk: $145.00.
                </p>
              </div>
            </div>
            <button className="w-full py-2.5 bg-[#6b2121] hover:bg-[#4a1717] text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
              Check Inventory
            </button>
          </div>

          {/* Queue Efficiency */}
          <div className="bg-[#FAF8F5] border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#302221] mb-2">Queue Efficiency</h3>
            <p className="text-xs text-[#7B726B] mb-6">Average prep time is down 12% today.</p>

            <div className="space-y-5 mb-6">
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-2">
                  <span className="text-[#302221] font-mono">Pork Belly Prep</span>
                  <span className="text-[#302221] font-mono">85%</span>
                </div>
                <div className="h-2.5 w-full bg-white border border-[#EAE5DF] rounded-full overflow-hidden">
                  <div className="h-full bg-[#4A3432]" style={{ width: '85%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-2">
                  <span className="text-[#302221] font-mono">Wagyu Stock</span>
                  <span className="text-[#302221] font-mono">42%</span>
                </div>
                <div className="h-2.5 w-full bg-white border border-[#EAE5DF] rounded-full overflow-hidden">
                  <div className="h-full bg-[#DDBFB5]" style={{ width: '42%' }}></div>
                </div>
              </div>
            </div>

            <button className="flex items-center gap-2 text-xs font-mono font-bold text-[#302221] hover:text-[#5A403E]">
              View Detailed Metrics <Icons.ArrowRight />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
