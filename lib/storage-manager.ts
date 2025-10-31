"use client"

import { db, type Product, type StoreSettings } from "./dexie-client"
import { autoSaveExcel } from "./excel-auto"
import { hasConnectedExcel, saveToConnectedExcel } from "./excel-fs"

class StorageManager {
  private autoSaveTimer: any = null

  private scheduleAutoExport() {
    if (typeof window === "undefined") return
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer)
    this.autoSaveTimer = setTimeout(async () => {
      try {
        const [products, customers, invoices, employees, invoiceItems] = await Promise.all([
          db.products.toArray(),
          db.customers.toArray(),
          db.invoices.toArray(),
          db.employees?.toArray?.() ?? Promise.resolve([]),
          db.invoice_items?.toArray?.() ?? Promise.resolve([]),
        ])
        let result
        if (await hasConnectedExcel()) {
          result = await saveToConnectedExcel(products, customers, invoices, employees as any, invoiceItems as any)
        } else {
          const ok = await autoSaveExcel(products as any, invoices as any)
          result = { ok, counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: (employees as any[]).length, invoice_items: (invoiceItems as any[]).length } }
        }
        window.dispatchEvent(new CustomEvent('sync:saved', { detail: result }))
      } catch (error: any) {
        window.dispatchEvent(new CustomEvent('sync:error', { detail: { error: error?.message || 'Unknown error' } }))
      }
    }, 500)
  }

  async addProduct(product: Product) {
    await db.products.put(product)
    this.scheduleAutoExport()
  }
  async updateProduct(product: Product) {
    await db.products.put(product)
    this.scheduleAutoExport()
  }
  async deleteProduct(id: string) {
    await db.products.delete(id)
    this.scheduleAutoExport()
  }

  async addInvoice(invoice: any, items: any[]) {
    const invoiceId = invoice.id || crypto.randomUUID()
    await db.invoices.put({ ...invoice, id: invoiceId })
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
    this.scheduleAutoExport()
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
    this.scheduleAutoExport()
  }

  async deleteInvoice(id: string) {
    await db.invoices.delete(id)
    await db.invoice_items.where("invoice_id").equals(id).delete()
    this.scheduleAutoExport()
  }

  async saveNowToExcel() {
    const [products, customers, invoices, employees, invoiceItems] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.invoices.toArray(),
      db.employees?.toArray?.() ?? Promise.resolve([]),
      db.invoice_items?.toArray?.() ?? Promise.resolve([]),
    ])
    let result
    if (await hasConnectedExcel()) {
      result = await saveToConnectedExcel(products, customers, invoices, employees as any, invoiceItems as any)
    } else {
      const ok = await autoSaveExcel(products as any, invoices as any)
      result = { ok, counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: (employees as any[]).length, invoice_items: (invoiceItems as any[]).length } }
    }
    if (result.ok) {
      window.dispatchEvent(new CustomEvent('sync:saved', { detail: result }))
    } else {
      window.dispatchEvent(new CustomEvent('sync:error', { detail: result }))
    }
    return result
  }
}

export const storageManager = new StorageManager()


