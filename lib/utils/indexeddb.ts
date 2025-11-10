import { db } from "@/lib/db/dexie"
import { v4 as uuidv4 } from "uuid"

// Generic helpers
export async function listAll<T>(table: Dexie.Table<T, any>): Promise<T[]> {
  const rows = await table.toArray()
  // eslint-disable-next-line no-console
  console.log("[IndexedDB] listAll", { table: (table as any).name, count: rows.length })
  return rows
}

export async function getById<T>(table: Dexie.Table<T, any>, id: string): Promise<T | undefined> {
  // @ts-ignore
  const row = await table.get(id)
  // eslint-disable-next-line no-console
  console.log("[IndexedDB] getById", { table: (table as any).name, id, found: !!row })
  return row
}

export async function putWithId<T extends { id: string }>(table: Dexie.Table<T, any>, entity: Partial<T>): Promise<string> {
  const id = entity.id || uuidv4()
  const now = new Date().toISOString()
  const record = { ...entity, id, updated_at: now, created_at: (entity as any)?.created_at || now } as T
  await table.put(record)
  // eslint-disable-next-line no-console
  console.log("[IndexedDB] upsert", { table: (table as any).name, id })
  return id as string
}

export async function deleteById<T>(table: Dexie.Table<T, any>, id: string): Promise<void> {
  // @ts-ignore
  await table.delete(id)
  // eslint-disable-next-line no-console
  console.log("[IndexedDB] delete", { table: (table as any).name, id })
}

// Domain services
export const ProductsStore = {
  list: () => listAll(db.products),
  get: (id: string) => getById(db.products, id),
  upsert: (p: any) => putWithId(db.products, p),
  remove: (id: string) => deleteById(db.products, id),
}

export const CustomersStore = {
  list: () => listAll(db.customers),
  get: (id: string) => getById(db.customers, id),
  upsert: (c: any) => putWithId(db.customers, c),
  remove: (id: string) => deleteById(db.customers, id),
}

export const InvoicesStore = {
  list: () => listAll(db.invoices),
  get: (id: string) => getById(db.invoices, id),
  upsert: (inv: any) => putWithId(db.invoices, inv),
  remove: (id: string) => deleteById(db.invoices, id),
}

export const SettingsStore = {
  async get() {
    const all = await db.settings.toArray()
    return all[0]
  },
  async upsert(s: any) {
    const now = new Date().toISOString()
    const existing = await SettingsStore.get()
    if (existing?.id) {
      await db.settings.update(existing.id, { ...existing, ...s, updated_at: now })
      return existing.id
    }
    const id = await db.settings.add({ ...s, created_at: now, updated_at: now })
    return id
  },
}

// Developer helpers
declare global {
  interface Window {
    showLocalData?: (table: keyof typeof db) => Promise<void>
    listTables?: () => string[]
  }
}

if (typeof window !== "undefined") {
  window.listTables = () => Object.keys(db) as any
  window.showLocalData = async (name: keyof typeof db) => {
    const t: any = (db as any)[name]
    if (!t?.toArray) {
      // eslint-disable-next-line no-console
      console.log(`[IndexedDB] Table not found: ${String(name)}`)
      return
    }
    const rows = await t.toArray()
    // eslint-disable-next-line no-console
    console.table(rows)
  }

  // Quick smoke test helper
  // window.testLocalDB() -> writes/reads a product
  ;(window as any).testLocalDB = async () => {
    try {
      const id = await ProductsStore.upsert({
        name: "Test Product",
        id: undefined as any,
        user_id: "local",
        price: 1,
        stock_quantity: 1,
        unit: "pcs",
        gst_rate: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        deleted: false,
      } as any)
      // eslint-disable-next-line no-console
      console.log("[IndexedDB][testLocalDB] wrote product", id)
      const p = await ProductsStore.get(id)
      // eslint-disable-next-line no-console
      console.log("[IndexedDB][testLocalDB] read product", p)
      const all = await ProductsStore.list()
      // eslint-disable-next-line no-console
      console.log("[IndexedDB][testLocalDB] total products", all.length)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[IndexedDB][testLocalDB] failed", e)
    }
  }
}


