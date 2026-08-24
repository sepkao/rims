export default function ServerOperationsPage({ view }: { view: 'tables' | 'queue' }) {
  return <div className="max-w-4xl rounded-xl border-2 border-dashed border-[#EAE5DF] bg-white p-14 text-center"><h1 className="text-3xl font-bold text-[#302221]">{view === 'queue' ? 'Serve Queue' : 'Dining Table Number'}</h1><p className="mt-2 text-sm text-[#7B726B]">ข้อมูลจะแสดงเมื่อเชื่อมต่อ API</p></div>
}
