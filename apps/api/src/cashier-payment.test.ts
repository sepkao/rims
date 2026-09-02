import assert from 'node:assert/strict'
import test from 'node:test'
import { CashierPaymentError, parseCheckoutPayment } from './cashier-payment.js'

test('cash payment records rounded tender and change', () => {
  assert.deepEqual(parseCheckoutPayment({ paymentMethod: 'cash', cashReceived: 300.009 }, 199.99), {
    paymentMethod: 'cash', cashReceived: 300.01, changeAmount: 100.02, paymentReference: null,
  })
})

test('cash payment rejects insufficient tender', () => {
  assert.throws(() => parseCheckoutPayment({ paymentMethod: 'cash', cashReceived: 99 }, 100), CashierPaymentError)
})

test('manual payment requires verified reference', () => {
  assert.throws(() => parseCheckoutPayment({ paymentMethod: 'promptpay' }, 100), CashierPaymentError)
  assert.deepEqual(parseCheckoutPayment({ paymentMethod: 'card', paymentReference: 'EDC-1234' }, 100), {
    paymentMethod: 'card', cashReceived: null, changeAmount: 0, paymentReference: 'EDC-1234',
  })
})
