/**
 * `crypto.randomUUID()` is unavailable in some browsers when the Customer
 * app is opened over plain HTTP on a LAN IP. Cart IDs are local UI keys, so
 * use the strongest available browser primitive and retain a compatibility
 * fallback for those devices.
 */
export function createCartItemId() {
  const webCrypto = globalThis.crypto
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID()

  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes = new Uint32Array(4)
    webCrypto.getRandomValues(bytes)
    return `cart-${Array.from(bytes, (value) => value.toString(36)).join('-')}`
  }

  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
