
// --- Icons ---
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  TrendDown: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Alert: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Export: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  // Item Icons
  Box: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>,
  Droplet: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>,
  Triangle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>,
  Leaf: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>
};

// --- Mock Data ---
const expiredItems = [
  { id: 1, icon: Icons.Box, name: "Premium Sliced\nBeef", batch: "BEEF-2310-045", expiry: "Oct 12, 2023", qty: "2.5 kg", value: "฿3,500", status: "AWAITING DISPOSAL" },
  { id: 2, icon: Icons.Droplet, name: "Fresh Chicken\nEggs", batch: "EGG-2310-112", expiry: "Oct 10, 2023", qty: "45 units", value: "฿270", status: "RECORDED" },
  { id: 3, icon: Icons.Triangle, name: "Squid Balls", batch: "BALL-2309-088", expiry: "Oct 05, 2023", qty: "1.2 kg", value: "฿420", status: "RECORDED" },
  { id: 4, icon: Icons.Leaf, name: "Chinese Cabbage", batch: "VEG-2310-201", expiry: "Oct 14, 2023", qty: "5.0 kg", value: "฿350", status: "PENDING AUDIT" },
  { id: 5, icon: Icons.Droplet, name: "Suki Sauce\n(Gallon)", batch: "SAUCE-2308-\n011", expiry: "Oct 20, 2023\n(Expiring)", qty: "2\nGallons", value: "฿1,800\n(Est.)", status: "MONITORING" },
];

export default function ExpiredGoodsPage() {
  return (
    <div className="admin-page max-w-[1200px] w-full">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 -mt-2">
        <h1 className="text-[26px] font-bold text-[#302221]">Expired Goods Check</h1>
        
        <div className="relative w-full sm:w-[320px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icons.Search />
          </div>
          <input 
            type="text" 
            placeholder="Search ingredients..." 
            className="admin-control w-full pl-10 pr-4 py-2.5 bg-[#F4EFEA] border-none rounded-md text-sm outline-none focus:ring-1 focus:ring-[#694b49] transition-all placeholder:text-[#999]"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        
        <div className="admin-stat-card bg-white p-6 rounded-lg border border-[#e8e3dd] shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-[#7B726B] uppercase tracking-wider mb-1">Loss Value (This Week)</p>
            <h2 className="text-3xl font-bold text-[#302221]">฿12,450</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#F4EFEA] flex items-center justify-center text-[#555]">
            <Icons.TrendDown />
          </div>
        </div>

        <div className="admin-stat-card bg-white p-6 rounded-lg border border-[#e8e3dd] shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-[#7B726B] uppercase tracking-wider mb-1">Items For Disposal</p>
            <h2 className="text-3xl font-bold text-[#302221]">8 <span className="text-sm font-medium text-[#777] ml-1">Items</span></h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#F4EFEA] flex items-center justify-center text-[#555]">
            <Icons.Trash />
          </div>
        </div>

        <div className="admin-stat-card bg-white p-6 rounded-lg border border-[#e8e3dd] shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-[#7B726B] uppercase tracking-wider mb-1">Expiring Soon Alerts</p>
            <h2 className="text-3xl font-bold text-[#302221]">15 <span className="text-sm font-medium text-[#777] ml-1">Items</span></h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#F4EFEA] flex items-center justify-center text-[#555]">
            <Icons.Alert />
          </div>
        </div>

      </div>

      {/* Table Section */}
      <div className="admin-surface bg-white rounded-lg border border-[#e8e3dd] shadow-sm overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="flex flex-col gap-3 border-b border-[#e8e3dd] bg-[#FDFBF7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-lg font-bold text-[#302221]">Expired / Degraded Ingredients List</h2>
          <div className="flex flex-wrap gap-3">
            <button className="admin-control flex items-center gap-2 px-4 py-2 bg-white border border-[#d6d0c4] rounded-md text-sm font-semibold text-[#555] hover:bg-gray-50 transition-colors">
              <Icons.Filter /> Filter
            </button>
            <button className="admin-primary flex items-center gap-2 px-4 py-2 bg-[#5a403e] rounded-md text-sm font-semibold text-white hover:bg-[#4a322f] transition-colors shadow-sm">
              <Icons.Export /> Export Report
            </button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FDFBF7] text-[10px] font-bold text-[#999] uppercase tracking-widest border-b border-[#e8e3dd]">
                <th className="px-6 py-4 w-[280px]">Ingredient Name</th>
                <th className="px-6 py-4">Batch No.</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4 text-right">Lost Qty</th>
                <th className="px-6 py-4 text-right">Lost Value</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede6]">
              {expiredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#faf8f5] transition-colors">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#F4EFEA] flex items-center justify-center text-[#777] shrink-0">
                      <item.icon />
                    </div>
                    <span className="text-sm font-medium text-[#302221] whitespace-pre-line leading-tight">
                      {item.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono font-medium text-[#7B726B] whitespace-pre-line">
                    {item.batch}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#555] whitespace-pre-line">
                    {item.expiry}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#555] text-right whitespace-pre-line">
                    {item.qty}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[#302221] text-right whitespace-pre-line">
                    {item.value}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-[#F4EFEA] text-[#7B726B] text-[10px] font-bold uppercase tracking-wider min-w-[120px]">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-3 border-t border-[#e8e3dd] bg-[#FDFBF7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-xs font-medium text-[#7B726B]">
            Showing 1 to 5 of 24 records
          </span>
          <div className="flex items-center gap-1.5">
            <button className="px-3 py-1.5 bg-transparent text-sm text-[#999] hover:text-[#555] font-medium transition-colors">Previous</button>
            <button className="w-8 h-8 flex items-center justify-center bg-[#5a403e] text-white rounded text-sm font-bold shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center bg-transparent text-[#777] rounded text-sm font-medium hover:bg-[#F4EFEA] transition-colors">2</button>
            <button className="w-8 h-8 flex items-center justify-center bg-transparent text-[#777] rounded text-sm font-medium hover:bg-[#F4EFEA] transition-colors">3</button>
            <span className="w-8 h-8 flex items-center justify-center text-[#999]">...</span>
            <button className="px-3 py-1.5 bg-white border border-[#e8e3dd] rounded-md text-sm font-medium text-[#555] hover:bg-gray-50 shadow-sm transition-colors">Next</button>
          </div>
        </div>

      </div>
    </div>
  );
}
