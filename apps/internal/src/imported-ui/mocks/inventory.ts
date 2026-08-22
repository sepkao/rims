export type InventoryStatus = 'Fresh' | 'Expiring Soon' | 'Expired';

export type InventoryBatch = {
  id: string;
  item: string;
  category: 'Meat' | 'Vegetable' | 'Others';
  batch: string;
  qty: string;
  receiveDate: string;
  expireDate: string;
  status: InventoryStatus;
  unitValue: number;
};

// Temporary frontend data. Replace this module with calls to the backend later.
export const inventoryBatches: InventoryBatch[] = [
  { id: 'LOG-1042', item: 'หมูสามชั้นสไลด์', category: 'Meat', batch: 'B-0811', qty: '20 kg', receiveDate: '2026-08-11', expireDate: '2026-08-18', status: 'Fresh', unitValue: 3200 },
  { id: 'LOG-1041', item: 'เนื้อวากิว A4', category: 'Meat', batch: 'B-0810', qty: '15 kg', receiveDate: '2026-08-10', expireDate: '2026-08-17', status: 'Expiring Soon', unitValue: 8500 },
  { id: 'LOG-1040', item: 'ผักกาดขาว', category: 'Vegetable', batch: 'V-0808', qty: '10 kg', receiveDate: '2026-08-08', expireDate: '2026-08-12', status: 'Expired', unitValue: 450 },
  { id: 'LOG-1039', item: 'เห็ดเข็มทอง', category: 'Vegetable', batch: 'V-0805', qty: '5 kg', receiveDate: '2026-08-05', expireDate: '2026-08-10', status: 'Expired', unitValue: 300 },
  { id: 'LOG-1038', item: 'ลูกชิ้นปลา', category: 'Others', batch: 'O-0809', qty: '30 packs', receiveDate: '2026-08-09', expireDate: '2026-08-23', status: 'Fresh', unitValue: 1200 },
  { id: 'LOG-1037', item: 'น้ำซุปดำ', category: 'Others', batch: 'O-0801', qty: '50 liters', receiveDate: '2026-08-01', expireDate: '2026-09-01', status: 'Fresh', unitValue: 950 },
];

export const fifoQueue = [...inventoryBatches]
  .filter((batch) => batch.status !== 'Expired')
  .sort((a, b) => a.receiveDate.localeCompare(b.receiveDate));
