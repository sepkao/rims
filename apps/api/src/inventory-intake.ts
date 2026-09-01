export type IntakeCategory = 'meat' | 'vegetable'

export type InventoryIntakeConversion = {
  inputQuantity: number
  inputUnit: 'kg' | 'plate'
  inputUnitCost: number
  storedQuantity: number
  storedUnit: 'kg' | 'plate'
  storedUnitCost: number
  roundingLossKg: number
}

type InventoryIntakeInput = {
  ingredientName: string
  category: IntakeCategory
  quantity: number
  unit?: string
  unitCost: number
  defaultPortionSizeKg: number
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function convertInventoryIntakeLine(input: InventoryIntakeInput): InventoryIntakeConversion {
  const unit = input.unit?.trim().toLowerCase()

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error(`${input.ingredientName} quantity must be greater than zero`)
  }
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
    throw new Error(`${input.ingredientName} unit cost must be zero or greater`)
  }

  if (input.category === 'meat') {
    if (unit !== 'kg') throw new Error(`${input.ingredientName} must be received in kg`)
    return {
      inputQuantity: input.quantity,
      inputUnit: 'kg',
      inputUnitCost: input.unitCost,
      storedQuantity: input.quantity,
      storedUnit: 'kg',
      storedUnitCost: input.unitCost,
      roundingLossKg: 0,
    }
  }

  if (unit === 'plate' || unit === 'plates') {
    if (!Number.isInteger(input.quantity)) {
      throw new Error(`${input.ingredientName} must be received in whole plates`)
    }
    return {
      inputQuantity: input.quantity,
      inputUnit: 'plate',
      inputUnitCost: input.unitCost,
      storedQuantity: input.quantity,
      storedUnit: 'plate',
      storedUnitCost: input.unitCost,
      roundingLossKg: 0,
    }
  }

  if (unit !== 'kg') throw new Error(`${input.ingredientName} must be received in kg or plates`)
  if (!Number.isFinite(input.defaultPortionSizeKg) || input.defaultPortionSizeKg <= 0) {
    throw new Error(`${input.ingredientName} has an invalid portion preset`)
  }

  const quantityMilliKg = Math.round(input.quantity * 1000)
  const portionMilliKg = Math.round(input.defaultPortionSizeKg * 1000)
  if (quantityMilliKg <= 0 || portionMilliKg <= 0) {
    throw new Error(`${input.ingredientName} has an invalid quantity or portion preset`)
  }

  const storedQuantity = Math.floor(quantityMilliKg / portionMilliKg)
  if (storedQuantity <= 0) throw new Error(`${input.ingredientName} is too small to create one plate`)

  return {
    inputQuantity: input.quantity,
    inputUnit: 'kg',
    inputUnitCost: input.unitCost,
    storedQuantity,
    storedUnit: 'plate',
    storedUnitCost: roundCurrency(input.unitCost * input.defaultPortionSizeKg),
    roundingLossKg: (quantityMilliKg - storedQuantity * portionMilliKg) / 1000,
  }
}
