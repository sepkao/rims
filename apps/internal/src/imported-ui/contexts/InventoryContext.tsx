import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { inventoryBatches, type InventoryBatch } from '../mocks/inventory';

type NewBatch = Omit<InventoryBatch, 'id' | 'status' | 'unitValue'>;
type InventoryContextValue = {
  batches: InventoryBatch[];
  fifoQueue: InventoryBatch[];
  receiveBatch: (batch: NewBatch) => void;
  issueOldestBatch: () => InventoryBatch | undefined;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

function statusFor(expireDate: string): InventoryBatch['status'] {
  const now = new Date('2026-08-16');
  const expiry = new Date(expireDate);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return 'Expired';
  return days <= 3 ? 'Expiring Soon' : 'Fresh';
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [batches, setBatches] = useState(inventoryBatches);
  const fifoQueue = useMemo(() => batches.filter((batch) => batch.status !== 'Expired').sort((a, b) => a.receiveDate.localeCompare(b.receiveDate)), [batches]);

  const receiveBatch = (batch: NewBatch) => setBatches((current) => [{ ...batch, id: `LOG-${Date.now()}`, status: statusFor(batch.expireDate), unitValue: 0 }, ...current]);
  const issueOldestBatch = () => {
    const oldest = fifoQueue[0];
    if (oldest) setBatches((current) => current.filter((batch) => batch.id !== oldest.id));
    return oldest;
  };

  return <InventoryContext.Provider value={{ batches, fifoQueue, receiveBatch, issueOldestBatch }}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used inside InventoryProvider');
  return context;
}
