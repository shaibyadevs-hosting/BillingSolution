import Dexie, { type Table } from "dexie"

export interface Product { id: string; name: string; sku?: string; category?: string; price: number; cost_price?: number; stock_quantity?: number; unit?: string; hsn_code?: string; gst_rate?: number; is_active?: boolean }
export interface Customer { id: string; name: string; email?: string|null; phone?: string|null; gstin?: string|null; billing_address?: string|null; shipping_address?: string|null; notes?: string|null }
export interface Invoice { id: string; customer_id: string; invoice_number: string; invoice_date: string; status: string; is_gst_invoice: boolean; subtotal: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number; notes?: string; terms?: string; created_at: string; store_id?: string; employee_id?: string; created_by_employee_id?: string }
export interface InvoiceItem { id: string; invoice_id: string; product_id?: string | null; description: string; quantity: number; unit_price: number; discount_percent: number; gst_rate: number; hsn_code?: string | null; line_total?: number; gst_amount?: number; created_at?: string }
export interface Employee { id: string; name: string; email: string; phone: string; role: string; salary: number; joining_date: string; is_active: boolean; employee_id?: string; password?: string; store_id?: string }
export interface Store { id: string; name: string; admin_user_id?: string; store_code: string; address?: string; gstin?: string; phone?: string; created_at?: string }
export interface StoreSettings { id: string; invoice_prefix?: string; next_invoice_number?: number }
export interface CustomerAuth { customer_id: string; email: string; phone?: string | null; magic_link_token?: string; token_expires_at?: string }
export interface InvoiceSequence { id: string; store_id: string; date: string; sequence: number }

export class AppDB extends Dexie {
  products!: Table<Product>
  customers!: Table<Customer>
  invoices!: Table<Invoice>
  invoice_items!: Table<InvoiceItem>
  employees!: Table<Employee>
  stores!: Table<Store>
  settings!: Table<StoreSettings>
  customer_auth!: Table<CustomerAuth>
  invoice_sequences!: Table<InvoiceSequence>
  fsHandles!: Table<any>

  constructor() {
    super("AppDB_v1")
    this.version(1).stores({
      products: "id",
      customers: "id",
      invoices: "id, created_at",
      settings: "id",
      fsHandles: "key",
    })
    this.version(2).stores({
      products: "id",
      customers: "id",
      invoices: "id, created_at",
      employees: "id, created_at",
      settings: "id",
      fsHandles: "key",
    })
    this.version(3).stores({
      products: "id",
      customers: "id",
      invoices: "id, created_at",
      invoice_items: "id, invoice_id",
      employees: "id, created_at",
      settings: "id",
      fsHandles: "key",
    })
    this.version(4).stores({
      products: "id",
      customers: "id, email, phone",
      invoices: "id, created_at, store_id",
      invoice_items: "id, invoice_id",
      employees: "id, created_at, employee_id, store_id",
      stores: "id, store_code",
      settings: "id",
      customer_auth: "customer_id, email",
      invoice_sequences: "id, store_id",
      fsHandles: "key",
    })
    this.version(5).stores({
      products: "id",
      customers: "id, email, phone",
      invoices: "id, created_at, store_id",
      invoice_items: "id, invoice_id",
      employees: "id, created_at, employee_id, store_id",
      stores: "id, store_code, name", // Added "name" index to fix KeyPath error
      settings: "id",
      customer_auth: "customer_id, email",
      invoice_sequences: "id, store_id",
      fsHandles: "key",
    })
  }
}

export const db = new AppDB()


