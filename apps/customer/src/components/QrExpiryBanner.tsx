export default function QrExpiryBanner({ expiresAt }: { expiresAt?: string }) {
  if (!expiresAt) return null
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (remainingMs > 5 * 60 * 1000) return null
  if (remainingMs <= 0) {
    return <div role="alert" className="bg-red-700 px-4 py-2 text-center text-xs font-bold text-white">QR หมดเวลาแล้ว กรุณาติดต่อแคชเชียร์เพื่อเปิดโต๊ะใหม่</div>
  }
  const remainingMinutes = Math.ceil(remainingMs / 60_000)
  return <div role="status" className="bg-amber-500 px-4 py-2 text-center text-xs font-bold text-[#302221]">เหลือเวลา {remainingMinutes} นาที กรุณาสั่งอาหารภายในเวลาที่กำหนด</div>
}
