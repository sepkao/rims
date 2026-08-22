
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Info: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
};

// Mock Data ถาดอาหาร
const prepItems = [
  { id: 1, name: "สามชั้นสไลด์", category: "MEAT", qty: 18, min: 5, img: "https://images.unsplash.com/photo-1577640905050-83665af216b9?w=150&h=150&fit=crop" },
  { id: 2, name: "เนื้อวากิวพรีเมียม", category: "MEAT", qty: 3, min: 10, img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=150&h=150&fit=crop" },
  { id: 3, name: "ชุดผักรวมออร์แกนิก", category: "PRODUCE", qty: 7, min: 6, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=150&h=150&fit=crop" },
  { id: 4, name: "เห็ดออรินจิ", category: "PRODUCE", qty: 24, min: 8, img: "https://images.unsplash.com/photo-1506458961255-571f40df5aad?w=150&h=150&fit=crop" },
  { id: 5, name: "เต้าหู้ไข่", category: "SOY", qty: 15, min: 5, img: "https://images.unsplash.com/photo-1593006240097-f5bc7dbd2fc9?w=150&h=150&fit=crop" },
  { id: 6, name: "หมี่หยก", category: "GRAIN", qty: 8, min: 12, img: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=150&h=150&fit=crop" },
];

export default function StaffPrepFridgePage() {
  
  // คำนวณสถานะของแต่ละอัน
  const getStatus = (qty: number, min: number) => {
    if (qty <= min / 2) return { label: 'Critical', color: '#C53030', barColor: 'bg-[#C53030]' };
    if (qty < min) return { label: 'Low Stock', color: '#7B726B', barColor: 'bg-[#7B726B]' };
    return { label: 'Adequate', color: '#999', barColor: 'bg-[#5A403E]' };
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#FDFBF7] relative pb-20">
      
      {/* Top Navigation */}
      <div className="h-[70px] flex justify-between items-center px-8 bg-[#FDFBF7] sticky top-0 z-20">
        <h1 className="text-2xl font-medium text-[#302221]">Prep Fridge Monitor</h1>
        <div className="relative w-[300px]">
          <input type="text" placeholder="Search inventory..." className="w-full pl-9 pr-4 py-2 bg-[#F4EFEA] border border-transparent rounded-full text-sm outline-none focus:border-[#d6d0c4]" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
        </div>
      </div>

      <div className="px-8 pb-8">
        
        {/* --- Top Dashboard Cards --- */}
        <div className="grid grid-cols-[3fr_2fr] gap-6 mb-10">
          
          {/* Ingredient Status */}
          <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] font-mono text-[#999] uppercase tracking-wider mb-1">Real-time Overview</p>
                <h2 className="text-xl font-medium text-[#302221]">Ingredient Status</h2>
              </div>
              <button className="text-[#999] hover:text-[#302221]"><Icons.Info /></button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-[#F4EFEA] rounded-lg p-4">
                <p className="text-[11px] font-bold text-[#7B726B] mb-1">Adequate</p>
                <p className="text-3xl font-medium text-[#302221]">12 Items</p>
              </div>
              <div className="flex-1 bg-[#F4EFEA] rounded-lg p-4">
                <p className="text-[11px] font-bold text-[#C53030] mb-1">Low Stock</p>
                <p className="text-3xl font-medium text-[#C53030]">3 Items</p>
              </div>
            </div>
          </div>

          {/* Critical Stock Alert */}
          <div className="bg-[#FCE8E8] border border-[#F8CACA] rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-[#C53030]"><Icons.AlertTriangle /></div>
              <h2 className="text-xl font-medium text-[#C53030]">Critical Stock Alert</h2>
            </div>
            <p className="text-sm text-[#C53030] mb-6 leading-relaxed">
              5 items are below safety threshold and require immediate prep or replenishment.
            </p>
            <button className="self-start px-6 py-2.5 bg-[#4A3432] hover:bg-[#382625] text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
              Check Expiry List
            </button>
          </div>

        </div>

        {/* --- Prep Trays Section --- */}
        <div className="flex justify-between items-end border-b border-[#302221] pb-3 mb-6">
          <h2 className="text-xl font-medium text-[#302221]">Prep Trays</h2>
          <div className="flex gap-2">
            <button className="w-9 h-9 border border-[#EAE5DF] bg-white rounded flex items-center justify-center text-[#7B726B] hover:bg-[#F4EFEA]"><Icons.Filter /></button>
            <button className="w-9 h-9 border border-[#EAE5DF] bg-white rounded flex items-center justify-center text-[#7B726B] hover:bg-[#F4EFEA]"><Icons.Grid /></button>
          </div>
        </div>

        {/* Grid of Trays */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          {prepItems.map(item => {
            const status = getStatus(item.qty, item.min);
            const percentage = Math.min(100, (item.qty / (item.min * 2)) * 100);

            // แก้ไขการต่อ String แบบคลีนๆ เพื่อไม่ให้ VS Code งง
            const qtyColorClass = item.qty <= item.min / 2 ? "text-[#C53030]" : "text-[#302221]";
            const barClass = "h-full rounded-full " + status.barColor;
            const barStyle = { width: percentage + "%" };

            return (
              <div key={item.id} className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded overflow-hidden border border-[#EAE5DF] bg-[#F4EFEA]">
                    <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#EAE5DF] text-[#7B726B] px-2 py-1 rounded uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
                
                <h3 className="text-lg font-medium text-[#302221] mb-2">{item.name}</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-xs font-bold text-[#7B726B]">Qty:</span>
                  <span className={"text-2xl font-medium " + qtyColorClass}>
                    {item.qty} Trays
                  </span>
                </div>

                <div className="h-2 w-full bg-[#EAE5DF] rounded-full mb-3 overflow-hidden">
                  <div className={barClass} style={barStyle}></div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono font-bold">
                  <span style={{ color: status.color }}>{status.label}</span>
                  <span className="text-[#302221]">Min: {item.min}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* --- Bottom Footer actions --- */}
        <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 flex justify-between items-center shadow-sm">
          <div className="flex gap-4">
            <div className="bg-[#F4EFEA] px-4 py-2.5 rounded border border-[#EAE5DF]">
              <p className="text-[10px] font-mono text-[#999] uppercase tracking-wider mb-0.5">Last Sync</p>
              <p className="text-xs font-medium text-[#302221]">Today, 14:45</p>
            </div>
            <div className="bg-[#F4EFEA] px-4 py-2.5 rounded border border-[#EAE5DF]">
              <p className="text-[10px] font-mono text-[#999] uppercase tracking-wider mb-0.5">Fridge Temp</p>
              <p className="text-xs font-medium text-[#302221]">2.4°C / 36°F</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="px-6 py-2.5 border border-[#302221] text-[#302221] font-medium rounded-lg hover:bg-[#F4EFEA] transition-colors text-sm">
              Print Labels
            </button>
            <button className="px-6 py-2.5 bg-[#4A3432] hover:bg-[#382625] text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm">
              <Icons.Plus /> New Prep Batch
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
