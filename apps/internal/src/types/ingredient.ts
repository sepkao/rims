export type IngredientPreset = {
  id: string
  name: string
  category: 'meat' | 'vegetable'
  defaultPortionSizeKg: number
  prepAvailablePlates?: number
  thawPrepThresholdPlates?: number | null
}

