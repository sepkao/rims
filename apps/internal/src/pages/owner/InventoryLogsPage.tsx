import { useMemo, useState } from 'react';
import { useInventory } from '../../contexts/InventoryContext';

// --- Icons ---
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Alert: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Box: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
};

export default function InventoryLogsPage() {
  const { batches } = useInventory();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const inventoryLogs = useMemo(() => batches
    .filter((log) => activeTab === 'All' || log.category === activeTab)
    .filter((log) => `${log.item} ${log.batch}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.receiveDate.localeCompare(b.receiveDate)), [activeTab, batches, search]);
  const expiringCount = batches.filter((batch) => batch.status === 'Expiring Soon').length;
  const expiredCount = batches.filter((batch) => batch.status === 'Expired').length;

  // ฟังก์ชันช่วยกำหนดสีของ Badge สถานะ
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fresh': return 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]'; // เขียว
      case 'Expiring Soon': return 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'; // เหลือง/ส้ม
      case 'Expired': return 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]'; // แดง
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="admin-page max-w-[1200px] w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#302221] mb-1">Inventory Logs</h1>
          <p className="text-sm text-[#7B726B]">Track incoming shipments and monitor ingredient expiration dates.</p>
        </div>
        
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button className="admin-control flex items-center gap-2 px-4 py-2 bg-white border border-[#e0dcd5] rounded-md text-sm font-semibold text-[#555] hover:bg-gray-50 shadow-sm transition-colors">
            <Icons.Calendar /> This Week
          </button>
          <div className="relative w-full sm:w-[240px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Icons.Search />
            </div>
            <input 
              type="text" 
              placeholder="ค้นหาวัตถุดิบหรือรหัสล็อต..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="admin-control w-full pl-10 pr-4 py-2 bg-white border border-[#e0dcd5] rounded-md text-sm outline-none focus:border-[#694b49] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="admin-stat-card bg-white p-5 rounded-lg border border-[#e8e3dd] shadow-sm flex items-center gap-4">
          <div className="bg-[#f0ece9] p-3 rounded-md text-[#694b49]"><Icons.Box /></div>
          <div>
            <p className="text-xs font-semibold text-[#7B726B] uppercase tracking-wide">Total Received (This Week)</p>
            <h2 className="text-2xl font-bold text-[#302221]">{batches.length}<span className="text-sm font-medium text-[#777] ml-1">items</span></h2>
          </div>
        </div>
        
        <div className="admin-stat-card bg-[#fffbeb] p-5 rounded-lg border border-[#fde68a] shadow-sm flex items-center gap-4">
          <div className="bg-[#fef3c7] p-3 rounded-md text-[#d97706]"><Icons.Alert /></div>
          <div>
            <p className="text-xs font-semibold text-[#92400e] uppercase tracking-wide">Expiring Soon (&lt; 3 days)</p>
            <h2 className="text-2xl font-bold text-[#92400e]">{expiringCount}<span className="text-sm font-medium text-[#d97706] ml-1">items</span></h2>
          </div>
        </div>

        <div className="admin-stat-card bg-[#fef2f2] p-5 rounded-lg border border-[#fecaca] shadow-sm flex items-center gap-4">
          <div className="bg-[#fee2e2] p-3 rounded-md text-[#dc2626]"><Icons.Alert /></div>
          <div>
            <p className="text-xs font-semibold text-[#991b1b] uppercase tracking-wide">Expired Items</p>
            <h2 className="text-2xl font-bold text-[#991b1b]">{expiredCount}<span className="text-sm font-medium text-[#ef4444] ml-1">items</span></h2>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="admin-surface bg-[#FDFBF7] rounded-lg border border-[#e8e3dd] shadow-sm overflow-hidden">
        
        {/* Tabs หมวดหมู่ */}
        <div className="flex items-center gap-6 overflow-x-auto px-6 pt-4 border-b border-[#e8e3dd] bg-white">
          {['All', 'Meat', 'Vegetable', 'Others'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-bold transition-colors relative ${
                activeTab === tab ? 'text-[#4A322F]' : 'text-[#999] hover:text-[#666]'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#4A322F] rounded-t-full" />
              )}
            </button>
          ))}
          <div className="ml-auto pb-3">
             <button className="flex items-center gap-1.5 text-xs font-bold text-[#666] hover:text-[#333]">
                <Icons.Filter /> Filter
             </button>
          </div>
        </div>

        {/* ตาราง Data Log */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4EFEA] text-[11px] font-bold text-[#7B726B] uppercase tracking-wider border-b border-[#e8e3dd]">
                <th className="px-6 py-4">Log ID</th>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Batch / Lot</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Receive Date</th>
                <th className="px-6 py-4">Expire Date</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e3dd] bg-white">
              {inventoryLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#faf8f5] transition-colors">
                  <td className="px-6 py-4 text-xs font-mono font-medium text-[#777]">{log.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-[#302221]">{log.item}</div>
                    <div className="text-[11px] text-[#7B726B] mt-0.5 uppercase tracking-wide">{log.category}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-[#555]">{log.batch}</td>
                  <td className="px-6 py-4 text-sm font-bold text-[#4A322F]">{log.qty}</td>
                  <td className="px-6 py-4 text-sm text-[#555]">{log.receiveDate}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#302221]">{log.expireDate}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
