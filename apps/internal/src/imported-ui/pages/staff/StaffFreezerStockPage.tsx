
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  Plus: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  // 👇 เพิ่ม Table icon ให้แล้วครับ
  Table: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14v4"></path><path d="M20 14v4"></path><path d="M2 10h20"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path></svg>,
  // Item Icons
  ForkKnife: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>,
  Meat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="8" rx="2"></rect><line x1="7" y1="8" x2="7" y2="16"></line><line x1="17" y1="8" x2="17" y2="16"></line></svg>,
  Drop: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>,
  IceCream: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 11v8a5 5 0 0 0 10 0v-8"></path><path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
};

export default function StaffFreezerStockPage() {
  const inventory = [
    { name: "Fish Balls (XL)", cat: "Seafood • Frozen", batch: "#FB-2024-001", remaining: 45.5, expiry: "Jun 28, 2026", status: "Critical", icon: Icons.ForkKnife },
    { name: "Wagyu Sliced (A5)", cat: "Meat • Premium", batch: "#WG-BEEF-882", remaining: 12.0, expiry: "Jul 15, 2026", status: "Stable", icon: Icons.Meat },
    { name: "Shrimp Shumai", cat: "Dim Sum • Stocked", batch: "#DM-SS-0042", remaining: 82.1, expiry: "Aug 02, 2026", status: "Stocked", icon: Icons.Drop },
    { name: "Gelato Base (Milk)", cat: "Dairy • Pre-mix", batch: "#DR-GEL-109", remaining: 34.8, expiry: "Jun 30, 2026", status: "Warning", icon: Icons.IceCream }
  ];

  return (
    <div className="w-full h-screen p-8 overflow-y-auto bg-[#FDFBF7] relative">
      
      {/* --- Top Header --- */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-[26px] font-medium text-[#302221]">Freezer Inventory</h1>
          <span className="text-[11px] font-bold text-[#555] bg-[#EAE5DF] px-2.5 py-1 rounded-full uppercase tracking-widest">Zone A-04</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-[240px]">
            <Icons.Search />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#EAE5DF] rounded-full text-sm outline-none focus:border-[#5A403E] transition-colors"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
          </div>
          <button className="p-2 text-[#555] hover:bg-[#EAE5DF] rounded-full transition-colors"><Icons.Bell /></button>
        </div>
      </div>

      {/* --- 3 Top Cards --- */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Capacity */}
        <div className="bg-[#FAF8F5] border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center text-[#7B726B] font-bold text-xs tracking-widest uppercase mb-4">
            Freezer Capacity <Icons.Meat /> {/* ใช้ Icon แทนชั่วคราว */}
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-[#302221]">85%</span>
            <span className="text-sm text-[#7B726B]">Utilized</span>
          </div>
          <div className="h-2.5 w-full bg-[#EAE5DF] rounded-full overflow-hidden">
            <div className="h-full bg-[#302221] w-[85%] rounded-full"></div>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-[#FCE8E8] border border-[#F8CACA] rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center text-[#C53030] font-bold text-xs tracking-widest uppercase mb-4 relative z-10">
            FIFO Alerts 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div className="flex items-baseline gap-2 mb-1 relative z-10">
            <span className="text-4xl font-bold text-[#C53030]">12</span>
            <span className="text-sm text-[#C53030] font-medium">Critical Items</span>
          </div>
          <p className="text-xs text-[#C53030] relative z-10">Expiring within 48 hours</p>
          <Icons.Bell /> {/* Icon จางๆ เป็นแบคกราวน์ */}
          <div className="absolute -bottom-4 -right-2 text-[#F8CACA] opacity-50 scale-[3]">
            <Icons.Bell />
          </div>
        </div>

        {/* Environment */}
        <div className="bg-[#FAF8F5] border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center text-[#7B726B] font-bold text-xs tracking-widest uppercase mb-4">
            Environment <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold text-[#302221]">-18.5<span className="text-xl">°C</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#302221]">
            <div className="w-2 h-2 rounded-full bg-[#10B981]"></div> Optimal Range
          </div>
        </div>
      </div>

      {/* --- Main Table Area --- */}
      <div className="bg-white border border-[#EAE5DF] rounded-xl shadow-sm mb-6">
        <div className="p-6 border-b border-[#EAE5DF] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-[#302221]">Bulk Inventory List</h2>
            <p className="text-xs text-[#7B726B]">Last updated today, 08:30 AM</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 border border-[#EAE5DF] px-3 py-1.5 rounded-md text-xs font-bold text-[#302221] hover:bg-gray-50"><Icons.Filter /> Filter</button>
            <button className="flex items-center gap-2 border border-[#EAE5DF] px-3 py-1.5 rounded-md text-xs font-bold text-[#302221] hover:bg-gray-50"><Icons.Download /> Export</button>
          </div>
        </div>

        <div className="w-full">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-[#7B726B] font-mono text-[11px] uppercase tracking-wider border-b border-[#EAE5DF]">
              <tr>
                <th className="px-6 py-4 font-bold">Item Name</th>
                <th className="px-6 py-4 font-bold">Batch No.</th>
                <th className="px-6 py-4 font-bold">Remaining</th>
                <th className="px-6 py-4 font-bold">Expiry Date</th>
                <th className="px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5DF]">
              {inventory.map((item, i) => (
                <tr key={i} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-md bg-[#F4EFEA] flex items-center justify-center text-[#7B726B]">
                        <item.icon />
                      </div>
                      <div>
                        <p className="font-bold text-[#302221]">{item.name}</p>
                        <p className="text-[11px] font-mono text-[#999] mt-0.5">{item.cat}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[#555] text-xs">{item.batch}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#302221] w-12">{item.remaining} <span className="text-[10px] font-normal text-[#999]">kg</span></span>
                      <div className="w-12 h-1.5 bg-[#EAE5DF] rounded-full">
                        <div className="h-full bg-[#5A403E] rounded-full" style={{ width: `${Math.min(100, item.remaining)}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[#555] text-xs">{item.expiry}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full
                      ${item.status === 'Critical' ? 'bg-[#FCE8E8] text-[#C53030]' : 
                        item.status === 'Warning' ? 'bg-[#FEF3C7] text-[#D97706]' : 
                        'bg-[#EAE5DF] text-[#7B726B]'}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-[#EAE5DF] flex justify-between items-center bg-[#FAF8F5] rounded-b-xl">
            <span className="text-xs font-mono text-[#7B726B] font-bold">Showing 1-4 of 156 items</span>
            <div className="flex gap-1">
              <button className="w-7 h-7 rounded border border-[#EAE5DF] flex items-center justify-center text-[#999] bg-white">&lt;</button>
              <button className="w-7 h-7 rounded border border-[#5A403E] flex items-center justify-center text-white bg-[#5A403E]">1</button>
              <button className="w-7 h-7 rounded border border-[#EAE5DF] flex items-center justify-center text-[#555] bg-white hover:bg-gray-50">2</button>
              <button className="w-7 h-7 rounded border border-[#EAE5DF] flex items-center justify-center text-[#555] bg-white hover:bg-gray-50">3</button>
              <button className="w-7 h-7 rounded border border-[#EAE5DF] flex items-center justify-center text-[#999] bg-white">&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Bottom Cards --- */}
      <div className="grid grid-cols-[2fr_1fr] gap-6 mb-16">
        {/* Insights */}
        <div className="bg-[#FAF8F5] border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-[#302221]">
            <div className="bg-[#5A403E] p-1.5 rounded-md text-white"><Icons.Table /></div>
            <h2 className="font-medium text-lg">Freezer Efficiency Insights</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold font-mono text-[#7B726B] uppercase tracking-wider mb-2">Top Consumption</p>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-xl font-medium text-[#302221]">Wagyu Sliced</span>
                <span className="text-xs font-bold text-[#10B981]">+24% vs LY</span>
              </div>
              <p className="text-[11px] text-[#7B726B]">Predicted stockout in 4 days at current velocity.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold font-mono text-[#7B726B] uppercase tracking-wider mb-2">Storage Density</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-medium text-[#302221]">Optimized</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#302221" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <p className="text-[11px] text-[#7B726B]">Pallet layout A-4 is currently maximizing vertical space.</p>
            </div>
          </div>
        </div>

        {/* Cycle Stability */}
        <div className="bg-[#5A403E] rounded-xl p-6 shadow-md text-white flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold font-mono text-[#DDBFB5] uppercase tracking-wider mb-2">Cycle Stability</p>
            <p className="text-sm font-medium leading-tight">Environmental systems report 99.8% uptime.</p>
          </div>
          <div className="mt-4 flex items-end gap-1.5 h-12">
            {[40, 50, 100, 45, 60, 100, 50].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t-sm ${h === 100 ? 'bg-white' : 'bg-[#894833]'}`} style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-[#DDBFB5] mt-3">Internal temp variance &lt; 0.2°C</p>
        </div>
      </div>

      {/* --- Floating Action Button (FAB) --- */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#5A403E] hover:bg-[#4a322f] text-white rounded-xl shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-50">
        <Icons.Plus />
      </button>

    </div>
  );
}
