
// --- Icons สำหรับหน้านี้ ---
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  UsersGrp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Kitchen: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  Cashier: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line></svg>,
  Server: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 2C5 2 5 12 12 12C19 12 19 2 19 2"></path><path d="M12 12V22"></path><path d="M8 22H16"></path></svg>,
  Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
};

// --- ข้อมูลจำลองพนักงาน ---
const employees = [
  { id: 'EMP-001', name: 'Somchai Jaidee', email: 'somchai.j@shabu.co', role: 'Kitchen', status: 'Active', lastActive: 'Today, 02:30 PM', initials: 'S' },
  { id: 'EMP-005', name: 'Manee Meeta', email: 'manee.m@shabu.co', role: 'Cashier', status: 'Offline', lastActive: 'Yesterday, 10:15 PM', initials: 'M' },
  { id: 'EMP-012', name: 'Piti Yindee', email: 'piti.y@shabu.co', role: 'Server', status: 'Active', lastActive: 'Today, 04:05 PM', initials: 'P' },
  { id: 'EMP-003', name: 'Veera Phukla', email: 'veera.p@shabu.co', role: 'Kitchen', status: 'Active', lastActive: 'Today, 10:20 AM', initials: 'V' },
];

export default function UserManagementPage() {
  return (
    <div className="admin-page max-w-[1200px] w-full">
      
      {/* ส่วนหัว และปุ่มค้นหา */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#302221] mb-1">Employee List</h1>
          <p className="text-sm text-[#7B726B]">Manage user data and define system access levels</p>
        </div>
        
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[280px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Icons.Search />
            </div>
            <input 
              type="text" 
              placeholder="Search employees..." 
              className="admin-control w-full pl-10 pr-4 py-2 bg-white border border-[#e0dcd5] rounded-md text-sm outline-none focus:border-[#694b49] transition-colors"
            />
          </div>
          <button className="admin-primary flex items-center gap-2 px-4 py-2.5 bg-[#4A322F] rounded-md text-sm font-semibold text-white hover:bg-[#3a2624] transition-colors shadow-sm whitespace-nowrap">
            <Icons.Plus /> Add Employee
          </button>
        </div>
      </div>

      {/* Cards สถิติ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="admin-stat-card bg-white p-5 rounded-lg border border-[#e8e3dd] shadow-sm flex flex-col justify-between h-[130px]">
          <div className="flex justify-between items-start">
            <div className="bg-[#f0ece9] p-2 rounded-md text-[#694b49]"><Icons.UsersGrp /></div>
            <span className="bg-[#fcf1ed] text-[#b36b53] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">+2 THIS MONTH</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-[#302221]">24</h2>
            <p className="text-xs font-semibold text-[#7B726B] mt-1">Total Employees</p>
          </div>
        </div>

        {/* Card: Kitchen (Active State มีกรอบซ้าย) */}
        <div className="admin-stat-card bg-[#FDF9F7] p-5 rounded-lg border border-[#e8e3dd] border-l-4 border-l-[#d2b3a8] shadow-sm flex flex-col justify-between h-[130px]">
          <div className="bg-[#f7dfd6] p-2 rounded-md text-[#a3614d] w-max"><Icons.Kitchen /></div>
          <div>
            <h2 className="text-3xl font-bold text-[#302221]">8</h2>
            <p className="text-xs font-semibold text-[#7B726B] mt-1">Kitchen</p>
          </div>
        </div>

        <div className="admin-stat-card bg-white p-5 rounded-lg border border-[#e8e3dd] shadow-sm flex flex-col justify-between h-[130px]">
          <div className="bg-[#f0ece9] p-2 rounded-md text-[#694b49] w-max"><Icons.Cashier /></div>
          <div>
            <h2 className="text-3xl font-bold text-[#302221]">4</h2>
            <p className="text-xs font-semibold text-[#7B726B] mt-1">Cashier</p>
          </div>
        </div>

        <div className="admin-stat-card bg-white p-5 rounded-lg border border-[#e8e3dd] shadow-sm flex flex-col justify-between h-[130px]">
          <div className="bg-[#f0ece9] p-2 rounded-md text-[#694b49] w-max"><Icons.Server /></div>
          <div>
            <h2 className="text-3xl font-bold text-[#302221]">12</h2>
            <p className="text-xs font-semibold text-[#7B726B] mt-1">Server</p>
          </div>
        </div>
      </div>

      {/* ตารางข้อมูลพนักงาน */}
      <div className="admin-surface bg-[#FDFBF7] rounded-lg border border-[#e8e3dd] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4EFEA] text-[11px] font-bold text-[#7B726B] uppercase tracking-wider border-b border-[#e8e3dd]">
                <th className="px-6 py-4">Name - Surname</th>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e3dd] bg-white">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#faf8f5] transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EAE4DB] flex items-center justify-center text-sm font-bold text-[#4A322F]">
                      {emp.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#302221]">{emp.name}</div>
                      <div className="text-xs text-[#7B726B] mt-0.5">{emp.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-[#555]">{emp.id}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 bg-[#F4EFEA] text-[#4A322F] text-xs font-bold px-2.5 py-1.5 rounded-md border border-[#e8e3dd]">
                      {emp.role === 'Kitchen' && <Icons.Kitchen />}
                      {emp.role === 'Cashier' && <Icons.Cashier />}
                      {emp.role === 'Server' && <Icons.Server />}
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-[#555]">
                      <span className={`w-2 h-2 rounded-full ${emp.status === 'Active' ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'}`}></span>
                      {emp.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#777]">{emp.lastActive}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors"><Icons.Edit /></button>
                      <button className="p-1 hover:bg-red-50 rounded transition-colors"><Icons.Trash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-[#F4EFEA] px-6 py-3 border-t border-[#e8e3dd] flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#7B726B] uppercase tracking-wider">
            Showing 1 to 4 of 24 records
          </span>
          <div className="flex gap-1.5">
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#e8e3dd] rounded text-sm text-[#777] hover:bg-gray-50">&lt;</button>
            <button className="w-8 h-8 flex items-center justify-center bg-[#4A322F] text-white rounded text-sm font-bold shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#e8e3dd] rounded text-sm font-bold text-[#555] hover:bg-gray-50">2</button>
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#e8e3dd] rounded text-sm font-bold text-[#555] hover:bg-gray-50">3</button>
            <span className="w-8 h-8 flex items-center justify-center text-[#777]">...</span>
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#e8e3dd] rounded text-sm text-[#777] hover:bg-gray-50">&gt;</button>
          </div>
        </div>
      </div>

    </div>
  );
}
