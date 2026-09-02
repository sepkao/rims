export type CustomerSession = {
  id: string
  tableNumber: string
  startedAt: string
  expiresAt: string
  capacity?: number
  status?: 'active' | 'expired'
}

const QR_STORAGE_KEY = 'rims.qr-session'

export function getQrCode() {
  return sessionStorage.getItem(QR_STORAGE_KEY)
}

export function storeQrCode(qrCode: string) {
  sessionStorage.setItem(QR_STORAGE_KEY, qrCode)
}

export function clearCustomerSession() {
  sessionStorage.removeItem(QR_STORAGE_KEY)
}

export function requireQrCode() {
  const qrCode = getQrCode()
  if (!qrCode) throw new Error('ไม่พบ QR Code กรุณาสแกน QR จากแคชเชียร์อีกครั้ง')
  return qrCode
}

export function customerQuery() {
  return `?qr_code=${encodeURIComponent(requireQrCode())}`
}
