import assert from 'node:assert/strict'
import test from 'node:test'
import { convertInventoryIntakeLine } from './inventory-intake.js'

test('converts vegetable kg quantity and cost into whole Prep plates', () => {
  assert.deepEqual(convertInventoryIntakeLine({
    ingredientName: 'แครอท',
    category: 'vegetable',
    quantity: 1.03,
    unit: 'kg',
    unitCost: 100,
    defaultPortionSizeKg: 0.05,
  }), {
    inputQuantity: 1.03,
    inputUnit: 'kg',
    inputUnitCost: 100,
    storedQuantity: 20,
    storedUnit: 'plate',
    storedUnitCost: 5,
    roundingLossKg: 0.03,
  })
})

test('uses thousandths arithmetic without losing an exact plate to floating point', () => {
  const result = convertInventoryIntakeLine({
    ingredientName: 'ผัก',
    category: 'vegetable',
    quantity: 0.3,
    unit: 'kg',
    unitCost: 90,
    defaultPortionSizeKg: 0.1,
  })

  assert.equal(result.storedQuantity, 3)
  assert.equal(result.roundingLossKg, 0)
})

test('keeps meat quantity and unit cost in kg', () => {
  assert.deepEqual(convertInventoryIntakeLine({
    ingredientName: 'หมูสามชั้น',
    category: 'meat',
    quantity: 2.5,
    unit: 'kg',
    unitCost: 200,
    defaultPortionSizeKg: 0.1,
  }), {
    inputQuantity: 2.5,
    inputUnit: 'kg',
    inputUnitCost: 200,
    storedQuantity: 2.5,
    storedUnit: 'kg',
    storedUnitCost: 200,
    roundingLossKg: 0,
  })
})

test('accepts vegetable quantities already expressed as whole plates', () => {
  const result = convertInventoryIntakeLine({
    ingredientName: 'ผักกาด',
    category: 'vegetable',
    quantity: 12,
    unit: 'plates',
    unitCost: 4.5,
    defaultPortionSizeKg: 0.05,
  })

  assert.equal(result.storedQuantity, 12)
  assert.equal(result.storedUnitCost, 4.5)
  assert.equal(result.storedUnit, 'plate')
})

test('rejects fractional plate intake', () => {
  assert.throws(
    () => convertInventoryIntakeLine({
      ingredientName: 'ผักกาด',
      category: 'vegetable',
      quantity: 1.5,
      unit: 'plates',
      unitCost: 4.5,
      defaultPortionSizeKg: 0.05,
    }),
    /whole plates/,
  )
})
