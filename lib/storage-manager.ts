"use client"

// IndexedDB-only storage manager (Excel export removed)
import { db, type Product } from "./dexie-client"

class StorageManager {
  private notifySaved(ok = true, counts?: { products?: number; customers?: number; invoices?: number; invoice_items?: number }) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent('sync:saved', { 
        detail: { 
          ok, 
          counts: counts || { products: 0, customers: 0, invoices: 0, invoice_items: 0 }
        } 
      }))
    }
  }

  async addProduct(product: Product) {
    await db.products.put(product)
    this.notifySaved(true)
  }
  async updateProduct(product: Product) {
    await db.products.put(product)
    this.notifySaved(true)
  }
  async deleteProduct(id: string) {
    await db.products.delete(id)
    this.notifySaved(true)
  }

  async addCustomer(customer: any) {
    await db.customers.put(customer)
    this.notifySaved(true)
  }
  async updateCustomer(customer: any) {
    await db.customers.put(customer)
    this.notifySaved(true)
  }
  async deleteCustomer(id: string) {
    await db.customers.delete(id)
    this.notifySaved(true)
  }

  async addEmployee(employee: any) {
    await db.employees?.put?.(employee)
    this.notifySaved(true)
  }
  async updateEmployee(employee: any) {
    await db.employees?.put?.(employee)
    this.notifySaved(true)
  }
  async deleteEmployee(id: string) {
    await db.employees?.delete?.(id)
    this.notifySaved(true)
  }

  async addInvoice(invoice: any, items: any[]) {
    const invoiceId = invoice.id || crypto.randomUUID()
    // Generate invoice number if not provided and we have store/employee context
    let invoiceNumber = invoice.invoice_number
    if (!invoiceNumber && invoice.store_id && invoice.employee_id) {
      const { generateInvoiceNumber } = await import("@/lib/utils/invoice-number")
      invoiceNumber = await generateInvoiceNumber(invoice.store_id, invoice.employee_id)
    }
    await db.invoices.put({ ...invoice, id: invoiceId, invoice_number: invoiceNumber || invoice.invoice_number })
    // Save invoice items
    if (items && items.length > 0) {
      const invoiceItems = items.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        invoice_id: invoiceId,
        created_at: item.created_at || new Date().toISOString(),
      }))
      await db.invoice_items.bulkPut(invoiceItems)
    }
    this.notifySaved(true)
  }

  async updateInvoice(invoice: any, items: any[]) {
    await db.invoices.put(invoice)
    // Update invoice items: delete old ones and add new ones
    if (items && items.length > 0) {
      await db.invoice_items.where("invoice_id").equals(invoice.id).delete()
      const invoiceItems = items.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        invoice_id: invoice.id,
        created_at: item.created_at || new Date().toISOString(),
      }))
      await db.invoice_items.bulkPut(invoiceItems)
    }
    this.notifySaved(true)
  }

  async deleteInvoice(id: string) {
    await db.invoices.delete(id)
    await db.invoice_items.where("invoice_id").equals(id).delete()
    this.notifySaved(true)
  }

  // Deprecated no-op retained for compatibility with UI buttons
  async saveNowToExcel() {
    return { ok: true, counts: {} }
  }
}

export const storageManager = new StorageManager()


