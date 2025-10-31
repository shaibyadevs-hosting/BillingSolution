"use client"

import { db, type Product, type Bill, type StoreSettings } from "./dexie-client"
import { autoSaveExcel } from "./excel-auto"
import { hasConnectedExcel, saveToConnectedExcel } from "./excel-fs"

class StorageManager {
  private autoSaveTimer: any = null

  private scheduleAutoExport() {
    if (typeof window === "undefined") return
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer)
    this.autoSaveTimer = setTimeout(async () => {
      try {
        const [products, customers, invoices, employees] = await Promise.all([
          db.products.toArray(),
          db.customers.toArray(),
          db.invoices.toArray(),
          db.employees?.toArray?.() ?? Promise.resolve([]),
        ])
        if (await hasConnectedExcel()) {
          await saveToConnectedExcel(products, customers, invoices, employees as any)
        } else {
          await autoSaveExcel(products as any, invoices as any)
        }
        window.dispatchEvent(new CustomEvent('sync:saved'))
      } catch {}
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

  async saveNowToExcel() {
    const [products, customers, invoices, employees] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.invoices.toArray(),
      db.employees?.toArray?.() ?? Promise.resolve([]),
    ])
    if (await hasConnectedExcel()) {
      return await saveToConnectedExcel(products, customers, invoices, employees as any)
    }
    const ok = await autoSaveExcel(products as any, invoices as any)
    return { ok, counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: (employees as any[]).length } }
  }
}

export const storageManager = new StorageManager()


