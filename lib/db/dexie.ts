import Dexie, { type EntityTable } from "dexie"

// Database interfaces matching Supabase schema
export interface Product {
  id: string
  user_id: string
  name: string
  description?: string | null
  sku?: string | null
  category?: string | null
  price: number
  cost_price?: number | null
  stock_quantity: number
  unit: string
  hsn_code?: string | null
  gst_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface Customer {
  id: string
  user_id: string
  name: string
  email?: string | null
  phone?: string | null
  gstin?: string | null
  billing_address?: string | null
  shipping_address?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface Invoice {
  id: string
  user_id: string
  customer_id?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  status: string
  is_gst_invoice: boolean
  subtotal: number
  discount_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  notes?: string | null
  terms?: string | null
  created_at: string
  updated_at: string
  is_synced: boolean
  deleted: boolean
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id?: string | null
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  gst_rate: number
  hsn_code?: string | null
  line_total: number
  gst_amount: number
  created_at: string
}

export interface SyncQueue {
  id?: number
  entity_type: "product" | "customer" | "invoice"
  entity_id: string
  action: "create" | "update" | "delete"
  data: any
  created_at: string
  retry_count: number
}

// New interfaces for offline-first functionality
export interface Settings {
  id?: number
  shop_name?: string
  shop_address?: string
  gstin?: string
  phone?: string
  email?: string
  lastAnalyticsSync?: string // ISO date string
  created_at: string
  updated_at: string
}

export interface LocalUser {
  id: string
  name: string
  email?: string
  role: "admin" | "cashier"
  password_hash?: string // For local auth
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Inventory {
  id: string
  product_id: string
  quantity: number
  unit: string
  last_updated: string
  notes?: string
}

export interface Employee {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  employee_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  employee_id: string
  date: string // ISO date string
  check_in?: string // ISO datetime string
  check_out?: string // ISO datetime string
  status: "present" | "absent" | "leave"
  notes?: string
  created_at: string
}

export interface SalesHeader {
  id: string
  invoice_number: string
  customer_id?: string
  customer_name?: string
  sale_date: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method?: string
  status: "completed" | "pending" | "cancelled"
  created_by: string
  created_at: string
  updated_at: string
}

export interface SalesItem {
  id: string
  sale_id: string
  product_id?: string
  product_name: string
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
  line_total: number
  created_at: string
}

export interface License {
  id?: number
  licenseKey: string
  macAddress: string
  clientName: string
  activatedOn: string
  expiresOn: string
  status: "active" | "expired" | "revoked"
  encryptedData?: string // Encrypted license data
  created_at: string
  updated_at: string
}

// Dexie database class
class BillingDatabase extends Dexie {
  products!: EntityTable<Product, "id">
  customers!: EntityTable<Customer, "id">
  invoices!: EntityTable<Invoice, "id">
  invoice_items!: EntityTable<InvoiceItem, "id">
  sync_queue!: EntityTable<SyncQueue, "id">
  settings!: EntityTable<Settings, "id">
  users!: EntityTable<LocalUser, "id">
  inventory!: EntityTable<Inventory, "id">
  employees!: EntityTable<Employee, "id">
  attendance!: EntityTable<Attendance, "id">
  sales_header!: EntityTable<SalesHeader, "id">
  sales_items!: EntityTable<SalesItem, "id">
  license!: EntityTable<License, "id">

  constructor() {
    super("BillingDatabase")

    this.version(1).stores({
      products: "id, user_id, name, is_synced, deleted",
      customers: "id, user_id, name, is_synced, deleted",
      invoices: "id, user_id, customer_id, invoice_number, invoice_date, is_synced, deleted",
      invoice_items: "id, invoice_id, product_id",
      sync_queue: "++id, entity_type, entity_id, created_at",
    })

    // Version 2: Add new offline-first tables
    this.version(2).stores({
      products: "id, user_id, name, is_synced, deleted",
      customers: "id, user_id, name, is_synced, deleted",
      invoices: "id, user_id, customer_id, invoice_number, invoice_date, is_synced, deleted",
      invoice_items: "id, invoice_id, product_id",
      sync_queue: "++id, entity_type, entity_id, created_at",
      settings: "++id",
      users: "id, email, role",
      inventory: "id, product_id",
      employees: "id, employee_id, is_active",
      attendance: "id, employee_id, date",
      sales_header: "id, invoice_number, customer_id, sale_date, status",
      sales_items: "id, sale_id, product_id",
      license: "++id, licenseKey, macAddress, status",
    })

    // Version 3: Add index for updated_at on license store
    this.version(3).stores({
      products: "id, user_id, name, is_synced, deleted",
      customers: "id, user_id, name, is_synced, deleted",
      invoices: "id, user_id, customer_id, invoice_number, invoice_date, is_synced, deleted",
      invoice_items: "id, invoice_id, product_id",
      sync_queue: "++id, entity_type, entity_id, created_at",
      settings: "++id",
      users: "id, email, role",
      inventory: "id, product_id",
      employees: "id, employee_id, is_active",
      attendance: "id, employee_id, date",
      sales_header: "id, invoice_number, customer_id, sale_date, status",
      sales_items: "id, sale_id, product_id",
      license: "++id, licenseKey, macAddress, status, updated_at",
    })
  }
}

export const db = new BillingDatabase()
