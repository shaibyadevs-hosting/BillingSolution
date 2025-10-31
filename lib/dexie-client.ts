import Dexie, { type Table } from "dexie"

export interface Product { id: string; name: string; sku?: string; category?: string; price: number; cost_price?: number; stock_quantity?: number; unit?: string; hsn_code?: string; gst_rate?: number; is_active?: boolean }
export interface Bill { id: string; customer_id: string; total: number; created_at: string }
export interface StoreSettings { id: string; invoice_prefix?: string; next_invoice_number?: number }

export class AppDB extends Dexie {
  products!: Table<Product>
  bills!: Table<Bill>
  settings!: Table<StoreSettings>
  fsHandles!: Table<any>

  constructor() {
    super("AppDB_v1")
    this.version(1).stores({
      products: "id",
      bills: "id, created_at",
      settings: "id",
      fsHandles: "key",
    })
  }
}

export const db = new AppDB()


