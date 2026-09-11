export type InventoryStatus = 'Fresh' | 'Expiring Soon' | 'Expired'

export type InventoryBatch = {
  id: string
  ingredientId: string
  item: string
  category: 'Meat' | 'Vegetable' | 'Others'
  batch: string
  qty: string
  receiveDate: string
  expireDate: string
  receivedAt?: string
  supplierReference?: string
  expiryAt?: string
  status: InventoryStatus
  unitValue: number
  location?: string
}
