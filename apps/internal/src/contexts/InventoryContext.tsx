import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { InventoryBatch } from '../types/inventory'

export type NewLotLine = {
  ingredientId: string
  qty: string
  expireDate: string
  unitCost: number
}

export type NewLot = {
  reference?: string
  receiveDate: string
  items: NewLotLine[]
}

type InventoryContextValue = {
  batches: InventoryBatch[]
  fifoQueue: InventoryBatch[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  receiveLot: (lot: NewLot) => Promise<string>
  disposeLot: (lotId: string, reason: string) => Promise<void>
}

type ApiLot = {
  id: string
  ingredientId: string
  item: string
  category: InventoryBatch['category']
  batch: string
  quantity: number
  unit: string
  receivedAt: string
  expiryDate: string
  status: InventoryBatch['status']
  unitValue: number
  location?: string
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

function toBatch(lot: ApiLot): InventoryBatch {
  return {
    id: `LOT-${lot.id}`,
    ingredientId: lot.ingredientId,
    item: lot.item,
    category: lot.category,
    batch: lot.batch,
    qty: `${lot.quantity} ${lot.unit}`,
    receiveDate: lot.receivedAt.slice(0, 10),
    expireDate: lot.expiryDate.slice(0, 10),
    receivedAt: lot.receivedAt,
    expiryAt: lot.expiryDate,
    status: lot.status,
    unitValue: lot.unitValue,
    location: lot.location,
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch<{ lots: ApiLot[] }>('/inventory/lots')
      setBatches(data.lots.map(toBatch))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load inventory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const receiveLot = useCallback(async (lot: NewLot) => {
    const response = await apiFetch<{ id: string }>('/inventory/lots', {
      method: 'POST',
      body: JSON.stringify({
        reference: lot.reference,
        receivedAt: lot.receiveDate,
        items: lot.items.map((item) => {
          const [quantity, unit = 'kg'] = item.qty.trim().split(/\s+/, 2)
          return {
            ingredientId: item.ingredientId,
            quantity: Number(quantity),
            unit,
            expiryDate: item.expireDate,
            unitCost: item.unitCost,
          }
        }),
      }),
    })
    await refresh()
    return response.id
  }, [refresh])

  const disposeLot = useCallback(async (lotId: string, reason: string) => {
    await apiFetch(`/inventory/lots/${lotId.replace(/^LOT-/, '')}/dispose`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    await refresh()
  }, [refresh])

  const fifoQueue = useMemo(
    () => [...batches]
      .filter((batch) => batch.status !== 'Expired' && Number.parseFloat(batch.qty) > 0)
      .sort((a, b) => a.expireDate.localeCompare(b.expireDate)),
    [batches],
  )

  return <InventoryContext.Provider value={{ batches, fifoQueue, loading, error, refresh, receiveLot, disposeLot }}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory must be used inside InventoryProvider')
  return context
}
