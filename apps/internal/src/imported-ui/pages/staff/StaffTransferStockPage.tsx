import { useNavigate } from 'react-router-dom';

const Icons = {
  ArrowLeft: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Snowflake: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="m20 16-4-4 4-4"></path><path d="m4 8 4 4-4 4"></path><path d="m16 4-4 4-4-4"></path><path d="m8 20 4-4 4 4"></path></svg>,
  Fridge: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="5" y1="10" x2="19" y2="10"></line><line x1="9" y1="14" x2="9" y2="14.01"></line></svg>,
  ArrowRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  PlusCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7B726B" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
};

export default function StaffTransferStockPage() {
  const navigate = useNavigate();

  // ข้อมูลจำลองรายการที่ต้องการย้ายสต็อก
  const items = [
    {
      id: 1,
      name: "Bulk Wagyu Beef (A5)",
      batch: "#WGY-0922",
      expires: "12 DAYS",
      currentStock: 45.0,
      transferQty: "12.0",
      img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop"
    },
    {
      id: 2,
      name: "Kurobuta Pork Loin",
      batch: "#KRP-1104",
      expires: "8 DAYS",
      currentStock: 22.5,
      transferQty: "5.0",
      img: "https://images.unsplash.com/photo-1577640905050-83665af216b9?w=100&h=100&fit=crop"
    }
  ];

  const totalItems = items.length;
  const totalWeight = items.reduce((acc, curr) => acc + (parseFloat(curr.transferQty) || 0), 0);

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#FDFBF7] p-8 pb-20">
      
      {/* Top Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-[#302221] hover:bg-[#EAE5DF] p-2 rounded-full transition-colors">
            <Icons.ArrowLeft />
          </button>
          <h1 className="text-2xl font-medium text-[#302221]">Transfer Inventory</h1>
        </div>
        <div className="relative w-[300px]">
          <input type="text" placeholder="Search inventory..." className="w-full pl-9 pr-4 py-2 bg-[#F4EFEA] border border-transparent rounded-full text-sm outline-none focus:border-[#d6d0c4]" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2"><Icons.Search /></div>
        </div>
      </div>

      {/* Section 1: Locations */}
      <div className="flex items-center gap-6 mb-8">
        {/* Source */}
        <div className="flex-1 bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-4">Source Location</p>
          <div className="bg-[#F4EFEA] border border-[#d6d0c4] rounded-lg p-4 flex justify-between items-center cursor-pointer">
            <div className="flex items-center gap-3 text-[#302221]">
              <Icons.Snowflake />
              <div>
                <p className="font-medium text-[15px]">Main Freezer</p>
                <p className="text-xs text-[#7B726B]">Zone A - Bulk Storage</p>
              </div>
            </div>
            <Icons.ChevronDown />
          </div>
        </div>

        {/* Arrow */}
        <div className="w-12 h-12 bg-white border border-[#EAE5DF] rounded-xl flex items-center justify-center text-[#7B726B] shadow-sm shrink-0">
          <Icons.ArrowRight />
        </div>

        {/* Target */}
        <div className="flex-1 bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-4">Target Location</p>
          <div className="bg-[#F4EFEA] border border-[#d6d0c4] rounded-lg p-4 flex justify-between items-center cursor-pointer">
            <div className="flex items-center gap-3 text-[#302221]">
              <Icons.Fridge />
              <div>
                <p className="font-medium text-[15px]">Prep Fridge</p>
                <p className="text-xs text-[#7B726B]">Line Station 1</p>
              </div>
            </div>
            <Icons.ChevronDown />
          </div>
        </div>
      </div>

      {/* Section 2: Items List */}
      <div className="bg-white border border-[#EAE5DF] rounded-xl shadow-sm mb-8 overflow-hidden">
        
        <div className="p-6 border-b border-[#EAE5DF] flex justify-between items-end bg-white">
          <div>
            <h2 className="text-[15px] font-medium text-[#302221] mb-1">Items to Transfer</h2>
            <p className="text-xs text-[#7B726B]">Select items and specify quantities for relocation.</p>
          </div>
          <button className="flex items-center gap-1.5 text-sm font-mono font-bold text-[#302221] hover:bg-[#F4EFEA] px-3 py-1.5 rounded transition-colors">
            <Icons.PlusCircle /> Add Item
          </button>
        </div>

        <div className="divide-y divide-[#EAE5DF]">
          {items.map((item) => (
            <div key={item.id} className="p-6 flex items-center justify-between">
              
              {/* Product Info */}
              <div className="flex items-center gap-4 w-[40%]">
                <img src={item.img} alt={item.name} className="w-16 h-16 rounded-md object-cover border border-[#EAE5DF]" />
                <div>
                  <h3 className="font-medium text-[#302221]">{item.name}</h3>
                  <p className="text-[10px] font-mono text-[#7B726B] uppercase mt-1">
                    BATCH: {item.batch} <span className="mx-1">•</span> EXPIRES IN {item.expires}
                  </p>
                </div>
              </div>

              {/* Current Stock */}
              <div className="text-right">
                <p className="text-xs font-mono text-[#7B726B] mb-1">Current Stock</p>
                <p className="text-lg font-mono text-[#302221]">{item.currentStock.toFixed(1)} kg</p>
              </div>

              {/* Quantity Input */}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-mono text-[#7B726B] mb-1">Quantity to Transfer</p>
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      defaultValue={item.transferQty}
                      className="w-24 px-3 py-2 bg-[#FAF8F5] border border-[#d6d0c4] rounded-md text-sm font-mono text-[#302221] outline-none focus:border-[#5A403E]"
                    />
                    <span className="text-sm font-mono text-[#302221]">kg</span>
                  </div>
                </div>
                <button className="mt-5 p-2 hover:bg-[#FCE8E8] rounded-md transition-colors group">
                  <div className="group-hover:stroke-[#C53030]"><Icons.Trash /></div>
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Bottom Notes & Summary */}
      <div className="grid grid-cols-[3fr_2fr] gap-6">
        
        {/* Notes */}
        <div className="bg-white border border-[#EAE5DF] rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-mono text-[#7B726B] uppercase tracking-wider mb-4">Transfer Notes (Optional)</p>
          <textarea 
            placeholder="Reason for transfer or special handling instructions..."
            className="w-full h-32 p-4 bg-[#FAF8F5] border border-[#d6d0c4] rounded-lg text-sm text-[#302221] outline-none focus:border-[#5A403E] resize-none"
          ></textarea>
        </div>

        {/* Summary Card */}
        <div className="bg-[#3A2A28] rounded-xl p-6 shadow-md text-[#FDFBF7] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-[#5A403E] pb-4">
              <span className="text-sm text-[#DDBFB5]">Total Items</span>
              <span className="text-sm font-medium">{totalItems} Categories</span>
            </div>
            <div className="flex justify-between items-center mb-8">
              <span className="text-sm text-[#DDBFB5]">Estimated Weight</span>
              <span className="text-sm font-medium">{totalWeight.toFixed(1)} kg</span>
            </div>
          </div>
          
          <div>
            <button className="w-full py-3.5 bg-white hover:bg-[#F4EFEA] text-[#302221] font-bold rounded-lg transition-colors flex justify-center items-center gap-2 mb-3 shadow-sm">
              Confirm Transfer <Icons.CheckCircle />
            </button>
            <p className="text-[10px] font-mono text-[#DDBFB5] text-center leading-relaxed opacity-70">
              This action will be logged in the inventory<br/>history for audit trails.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
