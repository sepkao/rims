import KitchenStockPage from '../staff/KitchenStock'

// Owner ดูได้อย่างเดียว ไม่มีปุ่ม "โอนย้าย" (นั่นเป็นงานปฏิบัติการของ Staff) — ใช้ component ตัวเดียวกับหน้า Staff เพื่อไม่ให้ logic ซ้ำ
export default function OwnerFreezerStockPage() {
  return <KitchenStockPage area="Freezer Stock" canTransfer={false} />
}
