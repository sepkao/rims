const tables = ['Table 2', 'Table 5', 'Table 8', 'Table 11'];
export default function ServerOperationsPage({ view }: { view: 'tables' | 'queue' }) {
  const isQueue = view === 'queue';
  return <div className="max-w-4xl"><h1 className="text-3xl font-bold text-[#302221]">{isQueue ? 'Serve Queue' : 'Dining Table Number'}</h1><p className="mt-1 text-sm text-[#7B726B]">{isQueue ? 'รายการอาหารที่พร้อมนำไปเสิร์ฟ' : 'สถานะโต๊ะสำหรับพนักงานเสิร์ฟ'}</p><div className="mt-7 grid gap-4 sm:grid-cols-2">{tables.map((table, index) => <section key={table} className="rounded-xl border border-[#e8e3dd] bg-white p-5 shadow-sm"><p className="font-bold text-[#302221]">{table}</p><p className="mt-1 text-sm text-[#7B726B]">{isQueue ? `${index + 1} รายการพร้อมเสิร์ฟ` : index % 2 ? 'กำลังรับประทาน' : 'รอเก็บโต๊ะ'}</p>{isQueue && <button className="mt-4 rounded-md bg-[#5a403e] px-3 py-2 text-sm font-semibold text-white">Mark served</button>}</section>)}</div></div>;
}
