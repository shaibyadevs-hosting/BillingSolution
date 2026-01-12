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

  private async getCounts() {
    try {
      const [products, customers, invoices, invoiceItems] = await Promise.all([
        db.products.count(),
        db.customers.count(),
        db.invoices.count(),
        db.invoice_items.count(),
      ])
      return {
        products,
        customers,
        invoices,
        invoice_items: invoiceItems,
      }
    } catch (error) {
      console.warn("[StorageManager] Failed to compute counts:", error)
      return { products: 0, customers: 0, invoices: 0, invoice_items: 0 }
    }
  }

  private async notifySavedWithCounts(ok = true) {
    const counts = await this.getCounts()
    this.notifySaved(ok, counts)
  }

  async addProduct(product: Product) {
    await db.products.put(product)
    await this.notifySavedWithCounts(true)
  }
  async updateProduct(product: Product) {
    await db.products.put(product)
    await this.notifySavedWithCounts(true)
  }
  async deleteProduct(id: string) {
    await db.products.delete(id)
    await this.notifySavedWithCounts(true)
  }

  async addCustomer(customer: any) {
    await db.customers.put(customer)
    await this.notifySavedWithCounts(true)
  }
  async updateCustomer(customer: any) {
    await db.customers.put(customer)
    await this.notifySavedWithCounts(true)
  }
  async deleteCustomer(id: string) {
    await db.customers.delete(id)
    await this.notifySavedWithCounts(true)
  }

  async addEmployee(employee: any) {
    try {
      console.log("[StorageManager] Adding employee to IndexedDB:", employee.id)
      await db.employees.put(employee)
      console.log("[StorageManager] Employee added successfully")
      
      // Verify it was saved
      const saved = await db.employees.get(employee.id)
      if (saved) {
        console.log("[StorageManager] Verified employee saved:", saved.id, saved.name)
      } else {
        console.error("[StorageManager] Employee NOT found after save!")
      }
      
      await this.notifySavedWithCounts(true)
    } catch (error) {
      console.error("[StorageManager] Error adding employee:", error)
      throw error
    }
  }
  async updateEmployee(employee: any) {
    try {
      console.log("[StorageManager] Updating employee in IndexedDB:", employee.id)
      await db.employees.put(employee)
      console.log("[StorageManager] Employee updated successfully")
      await this.notifySavedWithCounts(true)
    } catch (error) {
      console.error("[StorageManager] Error updating employee:", error)
      throw error
    }
  }
  async deleteEmployee(id: string) {
    await db.employees?.delete?.(id)
    await this.notifySavedWithCounts(true)
  }

  async addInvoice(invoice: any, items: any[]) {
    const invoiceId = invoice.id || crypto.randomUUID()
    // Generate invoice number if not provided and we have store/employee context
    let invoiceNumber = invoice.invoice_number
    if (!invoiceNumber && invoice.store_id && invoice.employee_id) {
      const { generateInvoiceNumber } = await import("@/lib/utils/invoice-number")
      invoiceNumber = await generateInvoiceNumber(invoice.store_id, invoice.employee_id)
    }
    
    // Use Dexie transaction for atomicity (invoice + items must save together or not at all)
    await db.transaction('rw', db.invoices, db.invoice_items, async () => {
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
    })
    
    await this.notifySavedWithCounts(true)
  }

  async updateInvoice(invoice: any, items: any[]) {
    // Use Dexie transaction for atomicity (invoice + items must update together or not at all)
    await db.transaction('rw', db.invoices, db.invoice_items, async () => {
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
    })
    await this.notifySavedWithCounts(true)
  }

  async deleteInvoice(id: string) {
    // Use Dexie transaction for atomicity (invoice + items must delete together or not at all)
    await db.transaction('rw', db.invoices, db.invoice_items, async () => {
      await db.invoices.delete(id)
      await db.invoice_items.where("invoice_id").equals(id).delete()
    })
    await this.notifySavedWithCounts(true)
  }

  // Deprecated no-op retained for compatibility with UI buttons
  async saveNowToExcel() {
    return { ok: true, counts: {} }
  }
}

export const storageManager = new StorageManager()


