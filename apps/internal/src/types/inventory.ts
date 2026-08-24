export type InventoryStatus = 'Fresh' | 'Expiring Soon' | 'Expired'

export type InventoryBatch = {
  id: string
  item: string
  category: 'Meat' | 'Vegetable' | 'Others'
  batch: string
  qty: string
  receiveDate: string
  expireDate: string
  status: InventoryStatus
  unitValue: number
  location?: string
}

