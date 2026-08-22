import React, { useState } from 'react';

const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  FilterLines: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="10" y1="18" x2="14" y2="18"></line></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7B726B" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  PlusCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>,
  Save: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
};

export default function StaffBatchEntryPage() {
  // ข้อมูลจำลองในคิวที่เตรียมจะบันทึกเข้าสต็อก
  const [queueItems, setQueueItems] = useState([
    { id: 1, name: "เนื้อเสือร้องไห้", cat: "Protein / Meat", batch: "WG-2024-B1", status: "CHILLED", expiry: "Aug 20, 2026" },
    { id: 2, name: "น้ำซุปหม่าล่า (ก้อน)", cat: "Pantry / Condiments", batch: "TR-2024-X4", status: "DRY", expiry: "Dec 12, 2026" },
    { id: 3, name: "ลูกชิ้นกุ้งฮอกไกโด", cat: "Seafood / Frozen", batch: "HS-2024-Z9", status: "FROZEN", expiry: "Aug 22, 2026" },
  ]);

  const removeQueueItem = (id: number) => {
    setQueueItems(prev => prev.filter(item => item.id !== id));
  };

  const getStatusStyle = (status: string) => {
    if (status === 'CHILLED') return "bg-[#5A403E] text-white";
    if (status === 'FROZEN') return "bg-[#DDBFB5] text-[#4A3432]";
    return "bg-[#EAE5DF] text-[#7B726B]"; // DRY
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#FDFBF7] p-8 pb-20">
      
      {/* Top Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-medium text-[#302221]">Batch Recording</h1>
        <div className="relative w-[300px]">
          <input type="text" placeholder="Search inventory..." className="w-full pl-9 pr-4 py-2 bg-[#F4EFEA] border border-transparent rounded-full text-sm outline-none focus:border-[#d6d0c4]" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-bold text-[#302221] mb-1">Batch Entry</h2>
          <p className="text-sm text-[#7B726B]">Register new culinary stock with FIFO queue management.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#F4EFEA] border border-[#EAE5DF] px-4 py-2 rounded-lg text-sm font-mono text-[#302221]">
          <Icons.Calendar /> Aug 15, 2026
        </div>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-8">
        
        {/* --- Left Column: Form & Queue Status --- */}
        <div className="space-y-6">
          
          {/* Form Box */}
          <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#302221] mb-6">Item Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-2">Item Name</label>
                <input type="text" placeholder="e.g. Organic Jasmine Rice" className="w-full px-3 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm outline-none focus:border-[#5A403E]" />
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-2">Batch No.</label>
                <input type="text" placeholder="BT-2024-001" className="w-full px-3 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm outline-none focus:border-[#5A403E] font-mono" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-2">Expiry Date</label>
                  <input type="text" placeholder="mm/dd/yyyy" className="w-full px-3 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm outline-none focus:border-[#5A403E]" />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-2">Quantity</label>
                  <input type="number" placeholder="0" className="w-full px-3 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm outline-none focus:border-[#5A403E]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-2">Freshness Status</label>
                <select className="w-full px-3 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm outline-none focus:border-[#5A403E] appearance-none cursor-pointer">
                  <option>Fresh Stock (Chilled)</option>
                  <option>Frozen Stock</option>
                  <option>Dry Pantry</option>
                </select>
              </div>

              <button className="w-full mt-4 py-3 bg-[#4A3432] hover:bg-[#382625] text-white text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm">
                <Icons.PlusCircle /> Add to Queue
              </button>
            </div>
          </div>

          {/* Current Queue Progress */}
          <div className="bg-[#FAF8F5] border border-[#EAE5DF] rounded-xl p-6 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-sm text-[#302221] font-bold">Current Queue</span>
              <span className="text-[10px] font-bold font-mono bg-[#EAE5DF] text-[#7B726B] px-2 py-0.5 rounded-full uppercase">4 Items</span>
            </div>
            <div className="h-2 w-full bg-[#EAE5DF] rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[#DDBFB5] rounded-full w-[65%]"></div>
            </div>
            <p className="text-[10px] font-mono text-[#999] italic">FIFO Storage Capacity: 65%</p>
          </div>

        </div>

        {/* --- Right Column: Queue List & Banner --- */}
        <div className="flex flex-col gap-6">
          
          {/* FIFO Batch Queue */}
          <div className="bg-white border border-[#EAE5DF] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
            
            <div className="p-6 border-b border-[#EAE5DF] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#302221]">FIFO Batch Queue</h2>
              <div className="flex gap-3 text-[#7B726B]">
                <button className="hover:text-[#302221]"><Icons.FilterLines /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAF8F5] text-[#7B726B] font-mono text-[10px] uppercase tracking-wider border-b border-[#EAE5DF]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Item Details</th>
                    <th className="px-4 py-4 font-bold">Batch No.</th>
                    <th className="px-4 py-4 font-bold">Freshness</th>
                    <th className="px-6 py-4 font-bold">Expiry</th>
                    <th className="px-6 py-4 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE5DF]">
                  {queueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#302221]">{item.name}</p>
                        <p className="text-[11px] text-[#999] mt-0.5">{item.cat}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-[#555] text-xs">
                        {item.batch.split('-').map((part, i) => (
                          <React.Fragment key={i}>
                            {part}
                            {i < 2 && <br/>}
                          </React.Fragment>
                        ))}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 text-[10px] font-bold rounded-full font-mono tracking-wider ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[#302221] text-xs leading-tight">
                        {item.expiry.split(', ').map((part, i) => (
                          <React.Fragment key={i}>
                            {part}{i===0 && ','}
                            <br/>
                          </React.Fragment>
                        ))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => removeQueueItem(item.id)} className="p-2 hover:bg-[#FCE8E8] rounded-md transition-colors group">
                          <div className="group-hover:stroke-[#C53030]"><Icons.Trash /></div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-[#FAF8F5] border-t border-[#EAE5DF] flex justify-end gap-4">
              <button className="px-6 py-2.5 border border-[#d6d0c4] text-[#5A403E] font-mono text-sm font-bold rounded-lg hover:bg-[#EAE5DF] transition-colors">
                Clear Queue
              </button>
              <button className="px-6 py-2.5 bg-[#4A3432] hover:bg-[#382625] text-white font-sm font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                <Icons.Save /> Save to System
              </button>
            </div>
          </div>

          {/* Banner */}
          <div className="h-[140px] rounded-xl overflow-hidden relative shadow-sm">
            <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80" alt="Pantry" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
              <h4 className="text-white font-mono font-bold text-sm uppercase tracking-wider mb-1">Inventory Management Tips</h4>
              <p className="text-[#EAE5DF] text-xs">Always label refrigerated batches immediately.</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}