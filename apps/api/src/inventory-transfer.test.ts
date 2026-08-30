import assert from 'node:assert/strict'
import test from 'node:test'
import type { PoolClient } from 'pg'
import { InventoryTransferError, transferInventoryIngredientFifo, transferInventoryLot } from './inventory-transfer.js'

type QueryCall = { text: string; values?: unknown[] }

const defaultSource = {
  id: '12',
  lotHeaderId: '4',
  ingredientId: '8',
  quantityRemaining: 10,
  unitCostPerKg: 200,
  expiryDate: '2026-09-11T00:00:00.000Z',
  isNotFresh: false,
  category: 'meat',
  portionSizeKg: 0.1,
  storageName: 'Freezer',
  storageUnit: 'kg',
  transferredAt: '2026-09-01T00:00:00.000Z',
}

function createClient(sourceOverrides: Partial<typeof defaultSource> = {}) {
  const calls: QueryCall[] = []
  const source = { ...defaultSource, ...sourceOverrides }

  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values })
      const normalized = text.replace(/\s+/g, ' ').trim()

      if (normalized.includes('FROM stock_lots sl')) return { rows: [source] }
      if (normalized.includes('FROM storage_locations')) return { rows: [{ id: '2' }] }
      if (normalized.startsWith('UPDATE stock_lots')) {
        return { rows: [{ quantityRemaining: source.quantityRemaining - Number(values?.[1]) }] }
      }
      if (normalized.startsWith('INSERT INTO stock_lots')) return { rows: [{ id: '99' }] }
      return { rows: [] }
    },
  } as unknown as PoolClient

  return { client, calls }
}

test('transfers freezer meat to a Prep sub-lot atomically', async () => {
  const { client, calls } = createClient()

  const result = await transferInventoryLot(client, {
    lotId: 'LOT-12',
    quantityKg: 5,
    actorId: 'staff-1',
  })

  assert.deepEqual(result, {
    sourceLotId: '12',
    prepLotId: '99',
    quantityKg: 5,
    plateCount: 50,
    roundingLossKg: 0,
    portionSizeKg: 0.1,
    unitCostPerPlate: 20,
    transferredAt: '2026-09-01T00:00:00.000Z',
    prepExpiryDate: '2026-09-06T00:00:00.000Z',
    sourceQuantityRemainingKg: 5,
  })

  const sourceLock = calls.find(call => call.text.includes('FROM stock_lots sl'))
  assert.match(sourceLock?.text ?? '', /FOR UPDATE OF sl/)

  const guardedUpdate = calls.find(call => call.text.includes('UPDATE stock_lots'))
  assert.match(guardedUpdate?.text ?? '', /quantity_remaining >= \$2/)
  assert.deepEqual(guardedUpdate?.values, ['12', 5])

  const prepInsert = calls.find(call => call.text.includes('INSERT INTO stock_lots'))
  assert.deepEqual(prepInsert?.values, ['4', '8', '2', 50, 20, '2026-09-06T00:00:00.000Z', '12'])

  const movementInsert = calls.find(call => call.text.includes('INSERT INTO stock_movements'))
  assert.deepEqual(movementInsert?.values, ['12', -5, 'staff-1', '99', 50])

  assert.equal(calls[0].text, 'BEGIN')
  assert.equal(calls.at(-1)?.text, 'COMMIT')
  assert.equal(calls.some(call => call.text === 'ROLLBACK'), false)
})

test('rejects a single-lot quantity that would discard a partial portion', async () => {
  const { client, calls } = createClient()

  await assert.rejects(
    () => transferInventoryLot(client, { lotId: '12', quantityKg: 5.03, actorId: 'staff-1' }),
    (error: unknown) => {
      assert.ok(error instanceof InventoryTransferError)
      assert.equal(error.code, 'quantity_not_full_portions')
      assert.equal(error.status, 422)
      return true
    },
  )

  assert.equal(calls.some((call) => call.text.includes('UPDATE stock_lots')), false)
  assert.equal(calls.at(-1)?.text, 'ROLLBACK')
})

test('rolls back when source quantity is insufficient', async () => {
  const { client, calls } = createClient({ quantityRemaining: 2 })

  await assert.rejects(
    () => transferInventoryLot(client, { lotId: '12', quantityKg: 3, actorId: 'staff-1' }),
    (error: unknown) => {
      assert.ok(error instanceof InventoryTransferError)
      assert.equal(error.code, 'insufficient_source_quantity')
      assert.equal(error.status, 409)
      return true
    },
  )

  assert.equal(calls.some(call => call.text.includes('UPDATE stock_lots')), false)
  assert.equal(calls.at(-1)?.text, 'ROLLBACK')
})

test('rolls back when the source lot is expired', async () => {
  const { client, calls } = createClient({ expiryDate: '2026-09-01T00:00:00.000Z' })

  await assert.rejects(
    () => transferInventoryLot(client, { lotId: '12', quantityKg: 1, actorId: 'staff-1' }),
    (error: unknown) => {
      assert.ok(error instanceof InventoryTransferError)
      assert.equal(error.code, 'source_lot_expired')
      assert.equal(error.status, 409)
      return true
    },
  )

  assert.equal(calls.at(-1)?.text, 'ROLLBACK')
})

function createFifoClient(sourceQuantities = [40, 20]) {
  const calls: QueryCall[] = []
  let prepLotSequence = 100
  const sources = sourceQuantities.map((quantityRemaining, index) => ({
    id: String(index + 1),
    lotHeaderId: String(index + 10),
    quantityRemaining,
    unitCostPerKg: index === 0 ? 200 : 240,
    expiryDate: index === 0 ? '2026-09-11T00:00:00.000Z' : '2026-09-21T00:00:00.000Z',
    transferredAt: '2026-09-01T00:00:00.000Z',
  }))

  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values })
      const normalized = text.replace(/\s+/g, ' ').trim()
      if (normalized.includes('FROM ingredients')) {
        return { rows: [{ id: '8', name: 'หมูสามชั้น', category: 'meat', portionSizeKg: 0.3 }] }
      }
      if (normalized.includes('FROM storage_locations')) return { rows: [{ id: '2' }] }
      if (normalized.includes('FROM stock_lots sl')) return { rows: sources }
      if (normalized.startsWith('UPDATE stock_lots')) {
        const source = sources.find((row) => row.id === values?.[0])
        return { rows: source ? [{ quantityRemaining: source.quantityRemaining - Number(values?.[1]) }] : [] }
      }
      if (normalized.startsWith('INSERT INTO stock_lots')) return { rows: [{ id: String(prepLotSequence++) }] }
      return { rows: [] }
    },
  } as unknown as PoolClient

  return { client, calls }
}

test('transfers one ingredient across FIFO source lots without merging traceability', async () => {
  const { client, calls } = createFifoClient()

  const result = await transferInventoryIngredientFifo(client, {
    ingredientId: '8',
    plateCount: 166,
    actorId: 'staff-1',
  })

  assert.equal(result.ingredientName, 'หมูสามชั้น')
  assert.equal(result.quantityKg, 49.8)
  assert.equal(result.totalPlateCount, 166)
  assert.deepEqual(result.allocations.map((allocation) => ({
    sourceLotId: allocation.sourceLotId,
    prepLotId: allocation.prepLotId,
    quantityKg: allocation.quantityKg,
    plateCount: allocation.plateCount,
  })), [
    { sourceLotId: '1', prepLotId: '100', quantityKg: 39.9, plateCount: 133 },
    { sourceLotId: '2', prepLotId: '101', quantityKg: 9.9, plateCount: 33 },
  ])

  const sourceLock = calls.find((call) => call.text.includes('FROM stock_lots sl'))
  assert.match(sourceLock?.text ?? '', /ORDER BY sl\.expiry_date, sl\.created_at, sl\.id/)
  assert.match(sourceLock?.text ?? '', /FOR UPDATE OF sl/)

  const updates = calls.filter((call) => call.text.includes('UPDATE stock_lots'))
  assert.deepEqual(updates.map((call) => call.values), [['1', 39.9], ['2', 9.9]])
  assert.equal(updates.reduce((total, call) => total + Number(call.values?.[1]), 0), result.quantityKg)

  const prepInserts = calls.filter((call) => call.text.includes('INSERT INTO stock_lots'))
  assert.equal(prepInserts.length, 2)
  assert.equal(prepInserts[0].values?.at(-1), '1')
  assert.equal(prepInserts[1].values?.at(-1), '2')
  assert.equal(calls.at(-1)?.text, 'COMMIT')
})

test('rolls back a FIFO transfer before mutation when aggregate stock is insufficient', async () => {
  const { client, calls } = createFifoClient([30, 15])

  await assert.rejects(
    () => transferInventoryIngredientFifo(client, { ingredientId: '8', plateCount: 167, actorId: 'staff-1' }),
    (error: unknown) => {
      assert.ok(error instanceof InventoryTransferError)
      assert.equal(error.code, 'insufficient_source_quantity')
      assert.equal(error.status, 409)
      return true
    },
  )

  assert.equal(calls.some((call) => call.text.includes('UPDATE stock_lots')), false)
  assert.equal(calls.at(-1)?.text, 'ROLLBACK')
})

test('uses full-portion lot boundaries to avoid compounding rounding loss', async () => {
  const { client } = createFifoClient()

  const result = await transferInventoryIngredientFifo(client, {
    ingredientId: '8',
    plateCount: 150,
    actorId: 'staff-1',
  })

  assert.equal(result.totalPlateCount, 150)
  assert.equal(result.quantityKg, 45)
  assert.deepEqual(result.allocations.map((allocation) => ({
    sourceLotId: allocation.sourceLotId,
    quantityKg: allocation.quantityKg,
    plateCount: allocation.plateCount,
  })), [
    { sourceLotId: '1', quantityKg: 39.9, plateCount: 133 },
    { sourceLotId: '2', quantityKg: 5.1, plateCount: 17 },
  ])
})
