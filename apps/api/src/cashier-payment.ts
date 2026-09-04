export type PaymentMethod = 'cash' | 'promptpay' | 'card'

export type CheckoutPayment = {
  paymentMethod: PaymentMethod
  cashReceived: number | null
  changeAmount: number
  paymentReference: string | null
}

export class CashierPaymentError extends Error {}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseCheckoutPayment(body: unknown, total: number): CheckoutPayment {
  if (!Number.isFinite(total) || total < 0) throw new CashierPaymentError('Invalid bill total')
  if (!body || typeof body !== 'object') throw new CashierPaymentError('Payment details are required')

  const input = body as { paymentMethod?: unknown; cashReceived?: unknown; paymentReference?: unknown }
  const paymentMethod = input.paymentMethod
  if (paymentMethod !== 'cash' && paymentMethod !== 'promptpay' && paymentMethod !== 'card') {
    throw new CashierPaymentError('Payment method must be cash, promptpay or card')
  }

  const paymentReference = typeof input.paymentReference === 'string' && input.paymentReference.trim()
    ? input.paymentReference.trim().slice(0, 120)
    : null

  if (paymentMethod === 'cash') {
    const cashReceived = Number(input.cashReceived)
    if (!Number.isFinite(cashReceived) || cashReceived < total) {
      throw new CashierPaymentError('Cash received must cover the bill total')
    }
    return { paymentMethod, cashReceived: money(cashReceived), changeAmount: money(cashReceived - total), paymentReference }
  }

  if (!paymentReference) {
    throw new CashierPaymentError('Payment reference is required after manual verification')
  }
  return { paymentMethod, cashReceived: null, changeAmount: 0, paymentReference }
}
