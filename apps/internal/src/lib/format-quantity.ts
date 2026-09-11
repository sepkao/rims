export function formatInventoryQuantity(value: string | number, unit?: string) {
  const text = String(value).trim()
  const numeric = Number.parseFloat(text)
  if (!Number.isFinite(numeric)) return text

  const suffix = unit ?? text.replace(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*/, '')
  const formatted = numeric.toLocaleString('th-TH', {
    minimumFractionDigits: suffix.toLowerCase() === 'kg' ? 1 : 0,
    maximumFractionDigits: 1,
  })
  return suffix ? `${formatted} ${suffix}` : formatted
}
