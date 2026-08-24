import { Link } from 'react-router-dom';
import { useInventory } from '../../contexts/InventoryContext';

const statusStyle = {
  Fresh: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Expiring Soon': 'bg-amber-50 text-amber-800 border-amber-200',
  Expired: 'bg-red-50 text-red-700 border-red-200',
};

export default function DashboardPage() {
  const { batches: inventoryBatches, fifoQueue } = useInventory();
  const expiring = inventoryBatches.filter((batch) => batch.status === 'Expiring Soon');
  const expired = inventoryBatches.filter((batch) => batch.status === 'Expired');
  const usable = inventoryBatches.filter((batch) => batch.status !== 'Expired');

  return (
    <div className="admin-page max-w-[1200px] w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-7">
        <div>
          <p className="text-sm font-semibold text-[#8b5e55]">Freshness-first inventory</p>
          <h1 className="text-3xl font-bold text-[#302221]">ศูนย์ควบคุมความสด</h1>
          <p className="text-sm text-[#7B726B] mt-1">จัดลำดับใช้วัตถุดิบตาม FIFO และติดตามล็อตเสี่ยงหมดอายุ</p>
        </div>
        <Link to="/owner/history" className="admin-primary w-fit rounded-md bg-[#5a403e] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a322f]">ดูทุกล็อตสินค้า</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <Metric label="ล็อตพร้อมใช้งาน" value={usable.length} detail="ล็อตที่ยังไม่หมดอายุ" tone="normal" />
        <Metric label="ต้องใช้ก่อน" value={expiring.length} detail="ใกล้หมดอายุภายใน 3 วัน" tone="warning" />
        <Metric label="ต้องดำเนินการ" value={expired.length} detail="ล็อตหมดอายุ ห้ามนำไปใช้" tone="danger" />
      </div>

      <section className="admin-surface rounded-xl border border-[#e8e3dd] bg-white shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between border-b border-[#e8e3dd] bg-[#fff9ed] px-6 py-4">
          <div><h2 className="font-bold text-[#302221]">คิวหยิบใช้ตาม FIFO</h2><p className="text-xs text-[#7B726B] mt-0.5">ใช้ล็อตที่รับเข้าก่อนเป็นลำดับแรก เพื่อลดของเสีย</p></div>
          <span className="rounded-full bg-[#5a403e] px-3 py-1 text-xs font-bold text-white">{fifoQueue.length} ล็อต</span>
        </div>
        <div className="divide-y divide-[#eee8e2]">
          {fifoQueue.map((batch, index) => (
            <div key={batch.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4efea] text-sm font-bold text-[#5a403e]">{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="font-bold text-[#302221]">{batch.item} <span className="ml-1 text-xs font-mono font-medium text-[#7B726B]">{batch.batch}</span></p><p className="text-xs text-[#7B726B]">รับเข้า {batch.receiveDate} · คงเหลือ {batch.qty}</p></div>
              <div className="sm:text-right"><p className="text-sm font-bold text-[#302221]">หมดอายุ {batch.expireDate}</p><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${statusStyle[batch.status]}`}>{batch.status === 'Expiring Soon' ? 'ควรใช้วันนี้' : 'พร้อมใช้'}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">แจ้งเตือนความสด</h2><div className="mt-3 space-y-3">{expiring.map((batch) => <p key={batch.id} className="rounded-lg bg-white px-3 py-2 text-sm text-[#4a322f]"><b>{batch.item}</b> · {batch.batch} หมดอายุ {batch.expireDate}</p>)}</div></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5"><h2 className="font-bold text-red-900">ล็อตที่ต้องแยกออก</h2><div className="mt-3 space-y-3">{expired.map((batch) => <p key={batch.id} className="rounded-lg bg-white px-3 py-2 text-sm text-[#4a322f]"><b>{batch.item}</b> · {batch.batch} หมดอายุแล้ว {batch.expireDate}</p>)}</div></div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'normal' | 'warning' | 'danger' }) {
  const toneClass = { normal: 'border-[#e8e3dd]', warning: 'border-amber-200 bg-amber-50', danger: 'border-red-200 bg-red-50' }[tone];
  return <div className={`admin-stat-card rounded-xl border p-5 shadow-sm ${toneClass}`}><p className="text-xs font-bold uppercase tracking-wide text-[#7B726B]">{label}</p><p className="my-1 text-3xl font-bold text-[#302221]">{value} <span className="text-sm font-medium">ล็อต</span></p><p className="text-xs text-[#7B726B]">{detail}</p></div>;
}
