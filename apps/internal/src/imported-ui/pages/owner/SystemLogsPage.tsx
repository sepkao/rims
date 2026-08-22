
// --- Icons ---
const Icons = {
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
      <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
      <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
    </svg>
  ),
  Download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  )
};

// --- Mock Data ---
const systemLogs = [
  {
    id: 1,
    timestamp: "2023-10-27\n14:32:01.452",
    level: "INFO",
    source: "Inventory.FIFO",
    message: "Deducted 15 units of [SKU-B001] Beef Slices. OrderID: ORD-9921.",
    payload: null
  },
  {
    id: 2,
    timestamp: "2023-10-27\n14:30:15.110",
    level: "WARN",
    source: "System.Audit",
    message: "Low stock alert triggered for [SKU-S005] Soy Sauce. Current level: 12 units.",
    payload: null
  },
  {
    id: 3,
    timestamp: "2023-10-27\n14:28:44.009",
    level: "ERROR",
    source: "Auth.Service",
    message: "Failed login attempt from IP 192.168.1.105. User: admin_temp",
    payload: '{"code": 401, "status": "unauthorized", "retry_count": 3}'
  },
  {
    id: 4,
    timestamp: "2023-10-27\n14:25:00.000",
    level: "INFO",
    source: "Cron.Job",
    message: "Started daily expiry check routine. Process ID: 8842.",
    payload: null
  },
  {
    id: 5,
    timestamp: "2023-10-27\n14:25:02.145",
    level: "SUCCESS",
    source: "Cron.Job",
    message: "Daily expiry check completed. Scanned 452 items. 3 items nearing expiry.",
    payload: null
  }
];

export default function SystemLogsPage() {

  // ฟังก์ชันกำหนดสีตาม Level
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-[#444] font-bold';
      case 'WARN': return 'text-[#a18825] font-bold'; // สีเหลืองอมเขียวมะกอก
      case 'ERROR': return 'text-[#c73a3a] font-bold'; // สีแดง
      case 'SUCCESS': return 'text-[#2e8c4a] font-bold'; // สีเขียว
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="admin-page max-w-[1200px] w-full flex flex-col h-[calc(100vh-152px)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-[28px] font-bold text-[#2c2221] mb-1">System Activity Logs</h1>
          <p className="text-sm text-[#7B726B]">Real-time background operations and system audit trail.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button className="admin-control flex items-center gap-2 px-4 py-2 bg-[#FDFBF7] border border-[#e0dcd5] rounded-md text-sm font-semibold text-[#302221] hover:bg-gray-50 shadow-sm transition-colors">
            <Icons.Filter /> Filters
          </button>
          <button className="admin-control flex items-center gap-2 px-4 py-2 bg-[#FDFBF7] border border-[#e0dcd5] rounded-md text-sm font-semibold text-[#302221] hover:bg-gray-50 shadow-sm transition-colors">
            <Icons.Download /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Log Window */}
      <div className="admin-surface bg-[#FDFBF7] border border-[#e0dcd5] rounded-md flex flex-col flex-1 overflow-x-auto shadow-sm">
        
        {/* Table Header */}
        <div className="grid min-w-[760px] grid-cols-[140px_100px_150px_1fr] shrink-0 border-b border-[#e0dcd5] bg-[#F4EFEA] px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[#7B726B]">
          <div>Timestamp</div>
          <div>Level</div>
          <div>Source</div>
          <div>Message / Payload</div>
        </div>

        {/* Table Body (Scrollable) */}
        <div className="min-w-[760px] flex-1 overflow-y-auto bg-[#FDFBF7] font-mono text-[13px] text-[#555]">
          {systemLogs.map((log) => {
            const isError = log.level === 'ERROR';
            
            return (
              <div 
                key={log.id} 
                className={`
                  grid grid-cols-[140px_100px_150px_1fr] px-6 py-4 border-b border-[#f0ede6]
                  ${isError ? 'bg-[#fff8f8] border-l-2 border-l-[#c73a3a]' : 'border-l-2 border-l-transparent hover:bg-white'}
                `}
              >
                <div className="whitespace-pre-line text-[#888] leading-relaxed">
                  {log.timestamp}
                </div>
                <div className={getLevelColor(log.level)}>
                  {log.level}
                </div>
                <div className="font-semibold text-[#444]">
                  {log.source}
                </div>
                <div className="flex flex-col gap-3">
                  <span className={isError ? 'font-semibold text-[#222]' : ''}>
                    {log.message}
                  </span>
                  {/* แสดง Payload Box เฉพาะข้อมูลที่มี */}
                  {log.payload && (
                    <div className="bg-white border border-[#e0dcd5] text-[#666] p-3 rounded text-xs overflow-x-auto">
                      {log.payload}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Footer */}
        <div className="flex min-w-[760px] shrink-0 items-center justify-between border-t border-[#e0dcd5] bg-[#F4EFEA] px-6 py-2.5 font-mono text-[10px] font-bold tracking-wider text-[#7B726B]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[#4A322F]">
              <div className="w-2 h-2 rounded-full bg-[#34a853]"></div>
              SYSTEM ONLINE
            </span>
            <span className="text-[#d0c9c0]">/</span>
            <span>TOTAL RECORDS: 45,210</span>
          </div>
          <div className="flex items-center gap-4">
            <span>AUTO-SCROLL <span className="text-[#302221]">ON</span></span>
            <span className="text-[#d0c9c0]">/</span>
            <span>UPTIME: 142H 12M</span>
          </div>
        </div>

      </div>
    </div>
  );
}
