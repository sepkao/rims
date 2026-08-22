import { useState } from 'react';

const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  AlertTriangle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Cutlery: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>
};

export default function StaffServingQueuePage() {
  // ข้อมูลจำลองคิวอาหารรอเสิร์ฟ
  const initialQueue = [
    { id: 1, name: "หมูสามชั้นสไลด์ (x2)", table: "12", server: "Sarah Jenkins", time: "12m ago", img: "https://images.unsplash.com/photo-1577640905050-83665af216b9?w=100&h=100&fit=crop", urgent: true },
    { id: 2, name: "เนื้อวากิวออสเตรเลีย", table: "05", server: "Marcus Wong", time: "15m ago", img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop", urgent: false },
    { id: 3, name: "เซตผักรวมออร์แกนิก", table: "18", server: "Sarah Jenkins", time: "18m ago", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop", urgent: false },
    { id: 4, name: "กุ้งแม่น้ำแกะเปลือก", table: "02", server: "Alex Chen", time: "8m ago", img: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=100&h=100&fit=crop", urgent: false },
  ];

  const [queue, setQueue] = useState(initialQueue);

  // ฟังก์ชันกดยืนยันเสิร์ฟแล้ว
  const handleConfirmServed = (id: number) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#FDFBF7] p-8 pb-20">
      
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#302221] mb-1">Serving Queue</h1>
          <p className="text-sm text-[#7B726B]">Orders ready for table delivery</p>
        </div>
        <div className="flex items-center gap-2 bg-[#EAE5DF] px-4 py-2 rounded-lg text-sm font-bold font-mono text-[#302221] shadow-sm">
          <Icons.Clock /> Avg. Service: 8m 20s
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-[1fr_340px] gap-8">
        
        {/* Left Column: Order List */}
        <div className="space-y-4">
          {queue.length > 0 ? queue.map(item => (
            <div key={item.id} className="bg-white border border-[#EAE5DF] rounded-xl p-4 flex items-center justify-between shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-[#d6d0c4] transition-colors">
              <div className="flex items-center gap-5">
                <img src={item.img} alt={item.name} className="w-16 h-16 rounded-lg object-cover border border-[#EAE5DF]" />
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    {item.urgent && <span className="bg-[#894833] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">URGENT</span>}
                    <h3 className="text-lg font-bold text-[#302221]">{item.name}</h3>
                  </div>
                  <p className="text-xs font-mono text-[#7B726B]">
                    Server: {item.server} <span className="mx-2">•</span> Ordered {item.time}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] font-bold tracking-widest text-[#999] uppercase mb-1">Table</p>
                  <p className="text-3xl font-black text-[#302221] leading-none">{item.table}</p>
                </div>
                <button 
                  onClick={() => handleConfirmServed(item.id)}
                  className="h-[60px] px-6 bg-[#4A3432] hover:bg-[#382625] text-white font-bold rounded-lg transition-colors flex flex-col justify-center items-center shadow-md"
                >
                  <span>Confirm</span>
                  <span>Served</span>
                </button>
              </div>
            </div>
          )) : (
            <div className="bg-white border border-dashed border-[#d6d0c4] rounded-xl p-12 flex flex-col items-center justify-center text-[#999]">
              <Icons.Cutlery />
              <p className="mt-4 font-bold text-[#7B726B]">No pending orders to serve</p>
              <p className="text-sm">Great job! The queue is clear.</p>
            </div>
          )}
        </div>

        {/* Right Column: Widgets */}
        <div className="space-y-6">
          
          {/* Stock Alert */}
          <div className="bg-[#FCE8E8] border border-[#F8CACA] rounded-xl p-6 shadow-sm">
            <div className="flex gap-3 mb-4">
              <div className="mt-1"><Icons.AlertTriangle /></div>
              <div>
                <h3 className="font-bold text-[#C53030] text-lg mb-1">Stock Alert: Critical</h3>
                <p className="text-xs text-[#C53030] leading-relaxed">5 items expiring in less than 48h.<br/>Estimated value at risk: $145.00.</p>
              </div>
            </div>
            <button className="w-full py-2.5 bg-[#6b2121] hover:bg-[#4a1717] text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
              View Expiring Items
            </button>
          </div>

          {/* Staff Performance */}
          <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#302221] mb-6">Staff Performance</h3>
            <div className="space-y-5">
              {[
                { name: "Sarah Jenkins", served: 12, percent: 85 },
                { name: "Marcus Wong", served: 8, percent: 55 },
                { name: "Alex Chen", served: 5, percent: 35 },
              ].map((staff, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-[#302221] font-mono">{staff.name}</span>
                    <span className="text-[#7B726B] font-mono">{staff.served} items served</span>
                  </div>
                  <div className="h-2 w-full bg-[#F4EFEA] rounded-full">
                    <div className="h-full bg-[#4A3432] rounded-full" style={{ width: `${staff.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floor Status */}
          <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#302221]">Floor Status</h3>
              <span className="text-[10px] font-bold bg-[#EAE5DF] text-[#7B726B] px-2 py-1 rounded-full">80% Capacity</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'T01', status: 'eating', icon: <Icons.Users /> },
                { id: 'T02', status: 'waiting', icon: <Icons.Cutlery />, alert: true },
                { id: 'T03', status: 'empty', icon: null },
                { id: 'T04', status: 'empty', icon: null },
                { id: 'T05', status: 'waiting', icon: <Icons.Cutlery />, alert: true },
                { id: 'T06', status: 'empty', icon: null },
                { id: 'T11', status: 'empty', icon: null },
                { id: 'T12', status: 'waiting', icon: <Icons.Cutlery />, alert: true },
                { id: 'T13', status: 'eating', icon: <Icons.Users /> },
              ].map((table, i) => (
                <div key={i} className={`
                  relative h-[70px] rounded-md flex flex-col justify-center items-center gap-1 border
                  ${table.status === 'eating' ? 'bg-[#EAE5DF] border-transparent text-[#302221]' : 
                    table.status === 'waiting' ? 'bg-[#FEF2F2] border-[#F8CACA] text-[#C53030]' : 
                    'bg-[#F4EFEA] border-transparent text-[#999]'}
                `}>
                  {table.alert && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#C53030] rounded-full border border-white"></span>}
                  <span className="text-[11px] font-bold font-mono">{table.id}</span>
                  {table.icon && <div className="scale-75">{table.icon}</div>}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
