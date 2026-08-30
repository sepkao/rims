import type { PoolClient, QueryResultRow } from 'pg'

type TransferErrorStatus = 400 | 404 | 409 | 422 | 500

export class InventoryTransferError extends Error {
  readonly status: TransferErrorStatus
  readonly code: string

  constructor(status: TransferErrorStatus, code: string, message: string) {
    super(message)
    this.name = 'InventoryTransferError'
    this.status = status
    this.code = code
  }
}

type TransferSourceRow = QueryResultRow & {
  id: string
  lotHeaderId: string
  ingredientId: string
  quantityRemaining: number
  unitCostPerKg: number
  expiryDate: Date | string
  isNotFresh: boolean
  category: string
  portionSizeKg: number
  storageName: string
  storageUnit: string
  transferredAt: Date | string
}

type StorageRow = QueryResultRow & { id: string }
type InsertedLotRow = QueryResultRow & { id: string }
type RemainingQuantityRow = QueryResultRow & { quantityRemaining: number }

export type InventoryTransferResult = {
  sourceLotId: string
  prepLotId: string
  quantityKg: number
  plateCount: number
  roundingLossKg: number
  portionSizeKg: number
  unitCostPerPlate: number
  transferredAt: string
  prepExpiryDate: string
  sourceQuantityRemainingKg: number
}

export type InventoryTransferInput = {
  lotId: string
  quantityKg: number
  actorId: string
}

type IngredientRow = QueryResultRow & {
  id: string
  name: string
  category: string
  portionSizeKg: number
}

type FifoTransferSourceRow = QueryResultRow & {
  id: string
  lotHeaderId: string
  quantityRemaining: number
  unitCostPerKg: number
  expiryDate: Date | string
  transferredAt: Date | string
}

export type InventoryFifoTransferAllocation = {
  sourceLotId: string
  sourceBatch: string
  prepLotId: string
  quantityKg: number
  plateCount: number
  unitCostPerPlate: number
  prepExpiryDate: string
  sourceQuantityRemainingKg: number
}

export type InventoryFifoTransferResult = {
  ingredientId: string
  ingredientName: string
  quantityKg: number
  totalPlateCount: number
  portionSizeKg: number
  transferredAt: string
  allocations: InventoryFifoTransferAllocation[]
}

export type InventoryFifoTransferInput = {
  ingredientId: string
  plateCount: number
  actorId: string
}

function normalizeLotId(value: string) {
  const match = /^(?:LOT-)?([1-9]\d*)$/i.exec(value.trim())
  if (!match) {
    throw new InventoryTransferError(400, 'invalid_lot_id', 'Stock lot id must be a positive integer')
  }
  return match[1]
}

function normalizeIngredientId(value: string) {
  const match = /^([1-9]\d*)$/.exec(value.trim())
  if (!match) {
    throw new InventoryTransferError(400, 'invalid_ingredient_id', 'Ingredient id must be a positive integer')
  }
  return match[1]
}

function toThousandths(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InventoryTransferError(400, `invalid_${fieldName}`, `${fieldName} must be greater than zero`)
  }

  const scaled = value * 1000
  const rounded = Math.round(scaled)
  if (Math.abs(scaled - rounded) > 1e-7) {
    throw new InventoryTransferError(400, `invalid_${fieldName}_precision`, `${fieldName} supports at most 3 decimal places`)
  }
  return rounded
}

function toPositiveInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InventoryTransferError(400, `invalid_${fieldName}`, `${fieldName} must be a positive integer`)
  }
  return value
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export async function transferInventoryLot(
  client: PoolClient,
  input: InventoryTransferInput,
): Promise<InventoryTransferResult> {
  const lotId = normalizeLotId(input.lotId)
  const quantityMilliKg = toThousandths(input.quantityKg, 'quantityKg')
  const quantityKg = quantityMilliKg / 1000
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    const sourceResult = await client.query<TransferSourceRow>(
      `SELECT sl.id::text,
              sl.lot_header_id::text AS "lotHeaderId",
              sl.ingredient_id::text AS "ingredientId",
              sl.quantity_remaining::float8 AS "quantityRemaining",
              sl.unit_cost::float8 AS "unitCostPerKg",
              sl.expiry_date AS "expiryDate",
              sl.is_not_fresh AS "isNotFresh",
              i.category,
              i.default_portion_size_kg::float8 AS "portionSizeKg",
              loc.name AS "storageName",
              loc.unit_type AS "storageUnit",
              clock_timestamp() AS "transferredAt"
       FROM stock_lots sl
       JOIN ingredients i ON i.id = sl.ingredient_id
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE sl.id = $1
       FOR UPDATE OF sl`,
      [lotId],
    )
    const source = sourceResult.rows[0]
    if (!source) {
      throw new InventoryTransferError(404, 'source_lot_not_found', 'Source stock lot was not found')
    }
    if (source.storageName !== 'Freezer' || source.storageUnit !== 'kg') {
      throw new InventoryTransferError(422, 'source_lot_not_in_freezer', 'Only Freezer lots measured in kg can be transferred')
    }
    if (source.category !== 'meat') {
      throw new InventoryTransferError(422, 'source_lot_not_meat', 'Only meat can be transferred from Freezer to Prep')
    }
    if (source.isNotFresh) {
      throw new InventoryTransferError(409, 'source_lot_not_fresh', 'This stock lot is marked as not fresh')
    }

    const transferredAt = new Date(source.transferredAt)
    const sourceExpiry = new Date(source.expiryDate)
    if (!Number.isFinite(transferredAt.getTime()) || !Number.isFinite(sourceExpiry.getTime())) {
      throw new InventoryTransferError(500, 'invalid_source_dates', 'Source stock lot has invalid date data')
    }
    if (sourceExpiry.getTime() <= transferredAt.getTime()) {
      throw new InventoryTransferError(409, 'source_lot_expired', 'Expired stock cannot be transferred')
    }

    const remainingMilliKg = Math.round(Number(source.quantityRemaining) * 1000)
    if (!Number.isFinite(remainingMilliKg) || remainingMilliKg < quantityMilliKg) {
      throw new InventoryTransferError(409, 'insufficient_source_quantity', 'Transfer quantity exceeds the source lot balance')
    }

    const portionMilliKg = toThousandths(Number(source.portionSizeKg), 'portionSizeKg')
    if (quantityMilliKg % portionMilliKg !== 0) {
      throw new InventoryTransferError(
        422,
        'quantity_not_full_portions',
        'Transfer quantity must equal a whole number of plates',
      )
    }
    const plateCount = quantityMilliKg / portionMilliKg
    const roundingLossKg = 0
    const unitCostPerPlate = roundCurrency(Number(source.unitCostPerKg) * Number(source.portionSizeKg))
    if (!Number.isFinite(unitCostPerPlate) || unitCostPerPlate < 0) {
      throw new InventoryTransferError(500, 'invalid_source_unit_cost', 'Source stock lot has invalid unit cost data')
    }

    const prepExpiryDate = new Date(
      transferredAt.getTime() + (sourceExpiry.getTime() - transferredAt.getTime()) / 2,
    )

    const destinationResult = await client.query<StorageRow>(
      `SELECT id::text
       FROM storage_locations
       WHERE name = 'ตู้พักละลาย'
         AND unit_type = 'plate'
         AND accepts_category IN ('meat', 'both')
       LIMIT 1`,
    )
    const destination = destinationResult.rows[0]
    if (!destination) {
      throw new InventoryTransferError(500, 'prep_storage_missing', 'Prep storage location is not configured correctly')
    }

    const updateResult = await client.query<RemainingQuantityRow>(
      `UPDATE stock_lots
       SET quantity_remaining = quantity_remaining - $2
       WHERE id = $1 AND quantity_remaining >= $2
       RETURNING quantity_remaining::float8 AS "quantityRemaining"`,
      [source.id, quantityKg],
    )
    const updatedSource = updateResult.rows[0]
    if (!updatedSource) {
      throw new InventoryTransferError(409, 'insufficient_source_quantity', 'Transfer quantity exceeds the source lot balance')
    }

    const prepLotResult = await client.query<InsertedLotRow>(
      `INSERT INTO stock_lots (
         lot_header_id, ingredient_id, storage_location_id,
         quantity_original, quantity_remaining, unit_cost, expiry_date, source_lot_id
       )
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
       RETURNING id::text`,
      [
        source.lotHeaderId,
        source.ingredientId,
        destination.id,
        plateCount,
        unitCostPerPlate,
        prepExpiryDate.toISOString(),
        source.id,
      ],
    )
    const prepLot = prepLotResult.rows[0]
    if (!prepLot) {
      throw new InventoryTransferError(500, 'prep_lot_not_created', 'Unable to create the Prep sub-lot')
    }

    await client.query(
      `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
       VALUES ($1, 'adjustment', $2, $3),
              ($4, 'intake', $5, $3)`,
      [source.id, -quantityKg, input.actorId, prepLot.id, plateCount],
    )

    const result: InventoryTransferResult = {
      sourceLotId: source.id,
      prepLotId: prepLot.id,
      quantityKg,
      plateCount,
      roundingLossKg,
      portionSizeKg: Number(source.portionSizeKg),
      unitCostPerPlate,
      transferredAt: transferredAt.toISOString(),
      prepExpiryDate: prepExpiryDate.toISOString(),
      sourceQuantityRemainingKg: Number(updatedSource.quantityRemaining),
    }

    await client.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.lot_transferred', $2::jsonb)`,
      [input.actorId, JSON.stringify(result)],
    )
    await client.query('COMMIT')
    transactionStarted = false
    return result
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Preserve the original transfer error; a broken connection will be surfaced by the caller logs.
      }
    }
    throw error
  }
}

export async function transferInventoryIngredientFifo(
  client: PoolClient,
  input: InventoryFifoTransferInput,
): Promise<InventoryFifoTransferResult> {
  const ingredientId = normalizeIngredientId(input.ingredientId)
  const requestedPlateCount = toPositiveInteger(input.plateCount, 'plateCount')
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    const ingredientResult = await client.query<IngredientRow>(
      `SELECT id::text, name, category,
              default_portion_size_kg::float8 AS "portionSizeKg"
       FROM ingredients
       WHERE id = $1`,
      [ingredientId],
    )
    const ingredient = ingredientResult.rows[0]
    if (!ingredient) {
      throw new InventoryTransferError(404, 'ingredient_not_found', 'Ingredient was not found')
    }
    if (ingredient.category !== 'meat') {
      throw new InventoryTransferError(422, 'ingredient_not_meat', 'Only meat can be transferred from Freezer to Prep')
    }

    const portionMilliKg = toThousandths(Number(ingredient.portionSizeKg), 'portionSizeKg')
    const quantityMilliKg = requestedPlateCount * portionMilliKg
    if (!Number.isSafeInteger(quantityMilliKg)) {
      throw new InventoryTransferError(400, 'invalid_plateCount', 'plateCount is too large')
    }
    const quantityKg = quantityMilliKg / 1000

    const destinationResult = await client.query<StorageRow>(
      `SELECT id::text
       FROM storage_locations
       WHERE name = 'ตู้พักละลาย'
         AND unit_type = 'plate'
         AND accepts_category IN ('meat', 'both')
       LIMIT 1`,
    )
    const destination = destinationResult.rows[0]
    if (!destination) {
      throw new InventoryTransferError(500, 'prep_storage_missing', 'Prep storage location is not configured correctly')
    }

    const sourceResult = await client.query<FifoTransferSourceRow>(
      `SELECT sl.id::text,
              sl.lot_header_id::text AS "lotHeaderId",
              sl.quantity_remaining::float8 AS "quantityRemaining",
              sl.unit_cost::float8 AS "unitCostPerKg",
              sl.expiry_date AS "expiryDate",
              transaction_timestamp() AS "transferredAt"
       FROM stock_lots sl
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE sl.ingredient_id = $1
         AND loc.name = 'Freezer'
         AND loc.unit_type = 'kg'
         AND sl.quantity_remaining > 0
         AND sl.is_not_fresh = false
         AND sl.expiry_date > transaction_timestamp()
       ORDER BY sl.expiry_date, sl.created_at, sl.id
       FOR UPDATE OF sl`,
      [ingredientId],
    )
    if (!sourceResult.rows.length) {
      throw new InventoryTransferError(409, 'no_transferable_source_stock', 'No fresh Freezer stock is available for this ingredient')
    }

    const availableMilliKg = sourceResult.rows.reduce(
      (total, source) => total + Math.round(Number(source.quantityRemaining) * 1000),
      0,
    )
    if (!Number.isFinite(availableMilliKg) || availableMilliKg < quantityMilliKg) {
      throw new InventoryTransferError(409, 'insufficient_source_quantity', 'Transfer quantity exceeds the total fresh Freezer balance')
    }

    const transferredAt = new Date(sourceResult.rows[0].transferredAt)
    if (!Number.isFinite(transferredAt.getTime())) {
      throw new InventoryTransferError(500, 'invalid_transfer_date', 'Database returned an invalid transfer timestamp')
    }

    const targetPlateCount = requestedPlateCount
    let remainingPlateCount = targetPlateCount
    const plannedAllocations = sourceResult.rows.map((source) => ({
      source,
      sourceRemainingMilliKg: Math.round(Number(source.quantityRemaining) * 1000),
      allocationMilliKg: 0,
      plateCount: 0,
    }))

    for (const planned of plannedAllocations) {
      if (remainingPlateCount <= 0) break
      const sourcePlateCapacity = Math.floor(planned.sourceRemainingMilliKg / portionMilliKg)
      const plateCount = Math.min(sourcePlateCapacity, remainingPlateCount)
      planned.plateCount = plateCount
      planned.allocationMilliKg = plateCount * portionMilliKg
      remainingPlateCount -= plateCount
    }
    if (remainingPlateCount > 0) {
      throw new InventoryTransferError(
        409,
        'insufficient_full_portions',
        'Fresh Freezer stock is too fragmented to create the requested number of traceable plates',
      )
    }

    const allocations: InventoryFifoTransferAllocation[] = []

    for (const planned of plannedAllocations) {
      if (planned.allocationMilliKg <= 0) continue
      const { source, allocationMilliKg, plateCount } = planned
      const allocationKg = allocationMilliKg / 1000
      const sourceExpiry = new Date(source.expiryDate)
      if (!Number.isFinite(sourceExpiry.getTime()) || sourceExpiry.getTime() <= transferredAt.getTime()) {
        throw new InventoryTransferError(409, 'source_lot_expired', 'A FIFO source lot expired before the transfer completed')
      }
      const unitCostPerPlate = roundCurrency(Number(source.unitCostPerKg) * Number(ingredient.portionSizeKg))
      if (!Number.isFinite(unitCostPerPlate) || unitCostPerPlate < 0) {
        throw new InventoryTransferError(500, 'invalid_source_unit_cost', 'A FIFO source lot has invalid unit cost data')
      }

      const updateResult = await client.query<RemainingQuantityRow>(
        `UPDATE stock_lots
         SET quantity_remaining = quantity_remaining - $2
         WHERE id = $1 AND quantity_remaining >= $2
         RETURNING quantity_remaining::float8 AS "quantityRemaining"`,
        [source.id, allocationKg],
      )
      const updatedSource = updateResult.rows[0]
      if (!updatedSource) {
        throw new InventoryTransferError(409, 'insufficient_source_quantity', 'A FIFO source lot changed during the transfer')
      }

      const prepExpiryDate = new Date(
        transferredAt.getTime() + (sourceExpiry.getTime() - transferredAt.getTime()) / 2,
      )

      const prepLotResult = await client.query<InsertedLotRow>(
        `INSERT INTO stock_lots (
           lot_header_id, ingredient_id, storage_location_id,
           quantity_original, quantity_remaining, unit_cost, expiry_date, source_lot_id
         )
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
         RETURNING id::text`,
        [
          source.lotHeaderId,
          ingredient.id,
          destination.id,
          plateCount,
          unitCostPerPlate,
          prepExpiryDate.toISOString(),
          source.id,
        ],
      )
      const prepLotId = prepLotResult.rows[0]?.id ?? ''
      if (!prepLotId) {
        throw new InventoryTransferError(500, 'prep_lot_not_created', 'Unable to create a FIFO Prep sub-lot')
      }

      await client.query(
        `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
         VALUES ($1, 'adjustment', $2, $3),
                ($4, 'intake', $5, $3)`,
        [source.id, -allocationKg, input.actorId, prepLotId, plateCount],
      )

      allocations.push({
        sourceLotId: source.id,
        sourceBatch: `LOT-${source.lotHeaderId}`,
        prepLotId,
        quantityKg: allocationKg,
        plateCount,
        unitCostPerPlate,
        prepExpiryDate: prepExpiryDate.toISOString(),
        sourceQuantityRemainingKg: Number(updatedSource.quantityRemaining),
      })
    }

    const totalPlateCount = allocations.reduce((total, allocation) => total + allocation.plateCount, 0)
    if (totalPlateCount !== targetPlateCount || totalPlateCount < 1) {
      throw new InventoryTransferError(409, 'fifo_allocation_failed', 'Unable to allocate the requested quantity into full Prep plates')
    }

    const result: InventoryFifoTransferResult = {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantityKg,
      totalPlateCount,
      portionSizeKg: Number(ingredient.portionSizeKg),
      transferredAt: transferredAt.toISOString(),
      allocations,
    }

    await client.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.ingredient_fifo_transferred', $2::jsonb)`,
      [input.actorId, JSON.stringify(result)],
    )
    await client.query('COMMIT')
    transactionStarted = false
    return result
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Preserve the original transfer error.
      }
    }
    throw error
  }
}
