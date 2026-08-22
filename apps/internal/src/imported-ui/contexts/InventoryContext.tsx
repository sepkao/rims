import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import type { InventoryBatch } from '../mocks/inventory'

export type NewBatch = Omit<InventoryBatch, 'id' | 'status' | 'unitValue'> & { unitCost: number }

type InventoryContextValue = {
  batches: InventoryBatch[]
  fifoQueue: InventoryBatch[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  receiveBatch: (batch: NewBatch) => Promise<void>
}

type ApiLot = {
  id: string
  item: string
  category: InventoryBatch['category']
  batch: string
  quantity: number
  unit: string
  receivedAt: string
  expiryDate: string
  status: InventoryBatch['status']
  unitValue: number
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

function toBatch(lot: ApiLot): InventoryBatch {
  return {
    id: `LOT-${lot.id}`,
    item: lot.item,
    category: lot.category,
    batch: lot.batch,
    qty: `${lot.quantity} ${lot.unit}`,
    receiveDate: lot.receivedAt.slice(0, 10),
    expireDate: lot.expiryDate.slice(0, 10),
    status: lot.status,
    unitValue: lot.unitValue,
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

  const receiveBatch = useCallback(async (batch: NewBatch) => {
    const [quantityText, unit = 'kg'] = batch.qty.trim().split(/\s+/, 2)
    await apiFetch('/inventory/lots', {
      method: 'POST',
      body: JSON.stringify({
        item: batch.item,
        category: batch.category,
        quantity: Number(quantityText),
        unit,
        receivedAt: batch.receiveDate,
        expiryDate: batch.expireDate,
        unitCost: batch.unitCost,
      }),
    })
    await refresh()
  }, [refresh])

  const fifoQueue = useMemo(
    () => [...batches].filter((batch) => batch.status !== 'Expired').sort((a, b) => a.expireDate.localeCompare(b.expireDate)),
    [batches],
  )

  return <InventoryContext.Provider value={{ batches, fifoQueue, loading, error, refresh, receiveBatch }}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory must be used inside InventoryProvider')
  return context
}
