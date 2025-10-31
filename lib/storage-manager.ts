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
        const [products, bills] = await Promise.all([db.products.toArray(), db.bills.toArray()])
        if (await hasConnectedExcel()) {
          await saveToConnectedExcel(products, bills)
        } else {
          await autoSaveExcel(products, bills)
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
    const [products, bills] = await Promise.all([db.products.toArray(), db.bills.toArray()])
    if (await hasConnectedExcel()) {
      return await saveToConnectedExcel(products, bills)
    }
    const ok = await autoSaveExcel(products, bills)
    return { ok, counts: { products: products.length, bills: bills.length } }
  }
}

export const storageManager = new StorageManager()


