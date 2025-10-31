## Offline Sync (Dexie) and Excel Connector: Architecture, Flow, and Integration Guide

This document explains how SmartBill handles offline persistence with Dexie (IndexedDB) and how it synchronizes/export data to Excel in two offline-friendly ways:

- Connected Excel file via the File System Access API (user grants a file handle once; subsequent saves are silent).
- Automatic background save to the Origin Private File System (OPFS) for a local Excel file when no external file is connected.

It also includes instructions and code you can reuse to implement the same features in another app.

### Data Model and Dexie Setup

Dexie stores the working data locally in the browser. SmartBill defines `products`, `bills`, `settings`, and an extra table `fsHandles` for persisting the connected Excel file handle.

```1:24:lib/dexie-client.ts
import Dexie, { type Table } from "dexie"
import type { Product, Bill, StoreSettings } from "./types"
import { v4 as uuidv4 } from "uuid"

export class SmartBillDB extends Dexie {
  products!: Table<Product>
  bills!: Table<Bill>
  settings!: Table<StoreSettings>
  fsHandles!: Table<any>

  constructor() {
    // Bump DB name to avoid Dexie primary key change migration issues
    super("SmartBillDB_v2")
    this.version(1)
      .stores({
        products: "id",
        bills: "id, date",
        settings: "id",
        fsHandles: "key",
      })
  }
}

export const db = new SmartBillDB()
```

The file also includes a one-time best-effort migration from an older DB name. You can omit that in a new app.

### Storage Orchestration (single source of truth: Dexie)

All CRUD goes through a `StorageManager` that writes to Dexie first, then schedules an automatic Excel export (either to the connected Excel file or OPFS) with a short debounce.

```1:23:lib/storage-manager.ts
import type { Product, Bill, StorageMode, StoreSettings } from "./types"
import { db } from "./dexie-client"
import { autoSaveExcel } from "./excel-auto"
import { hasConnectedExcel, saveToConnectedExcel, connectExcelFile } from "./excel-fs"

class StorageManager {
  private mode: StorageMode = "dexie"
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
      } catch {}
    }, 500)
  }
```

CRUD operations call `scheduleAutoExport()` after each write:

```38:66:lib/storage-manager.ts
async addProduct(product: Product): Promise<void> {
  const mode = this.getMode()
  if (mode === "dexie" || mode === "excel") {
    try {
      await db.products.put(product)
      console.log("[StorageManager] Product added:", product.id)
    } catch (e) {
      console.error("[StorageManager] addProduct failed:", e)
      throw e
    }
    this.scheduleAutoExport()
  }
}
```

Manual trigger to save now (used by UI buttons):

```147:159:lib/storage-manager.ts
async saveNowToExcel(): Promise<{ ok: boolean; products: number; bills: number }> {
  const [products, bills] = await Promise.all([db.products.toArray(), db.bills.toArray()])
  if (await hasConnectedExcel()) {
    const res = await saveToConnectedExcel(products, bills)
    return { ok: res.ok, products: res.counts.products, bills: res.counts.bills }
  }
  const ok = await autoSaveExcel(products, bills)
  return { ok, products: products.length, bills: bills.length }
}
```

### Option A: Connected Excel file via File System Access API

Users can connect a real `.xlsx` file once; we store the granted file handle in Dexie (`fsHandles`). Later saves write silently to that file without prompting.

```1:22:lib/excel-fs.ts
import * as XLSX from "xlsx"
import { db } from "./dexie-client"
import type { Product, Bill } from "./types"

export async function connectExcelFile(suggestedName = "smartbill-data.xlsx"): Promise<boolean> {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return false
  try {
    // @ts-ignore
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "Excel Workbook",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
        },
      ],
    })
    await db.fsHandles.put({ key: "excelHandle", handle })
    return true
  } catch {
    return false
  }
}
```

Checking and saving to the connected file:

```25:45:lib/excel-fs.ts
export async function hasConnectedExcel(): Promise<boolean> {
  const rec = await db.fsHandles.get("excelHandle")
  return !!rec?.handle
}

export async function saveToConnectedExcel(products: Product[], bills: Bill[]): Promise<{ ok: boolean; counts: { products: number; bills: number } }> {
  const rec = await db.fsHandles.get("excelHandle")
  const handle = rec?.handle
  if (!handle) return { ok: false, counts: { products: products.length, bills: bills.length } }
  try {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills), "Bills")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const writable = await handle.createWritable()
    await writable.write(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    await writable.close()
    return { ok: true, counts: { products: products.length, bills: bills.length } }
  } catch {
    return { ok: false, counts: { products: products.length, bills: bills.length } }
  }
}
```

### Option B: Automatic background save to OPFS

If no external file is connected, the app silently writes an Excel workbook into the Origin Private File System. Browsers store this per-origin; it’s great for offline.

```1:17:lib/excel-auto.ts
import * as XLSX from "xlsx"
import type { Product, Bill } from "./types"

async function writeToOPFS(filename: string, data: ArrayBuffer): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("storage" in navigator)) return false
    const anyNavigator: any = navigator as any
    const root = await anyNavigator.storage.getDirectory()
    const fileHandle = await root.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    await writable.close()
    return true
  } catch {
    return false
  }
}
```

```19:32:lib/excel-auto.ts
export async function autoSaveExcel(products: Product[], bills: Bill[], filename = "smartbill-data.xlsx") {
  try {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills), "Bills")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })

    // Try Origin Private File System for silent background save
    const saved = await writeToOPFS(filename, buf)
    return saved
  } catch {
    return false
  }
}
```

### Manual Export and Import Utilities

Used by UI to export a workbook via download or File System Access picker, and to parse imports.

```1:14:lib/excel-utils.ts
import * as XLSX from "xlsx"
import type { Product, Bill } from "./types"

export function exportToExcel(products: Product[], bills: Bill[], filename = "smartbill-data.xlsx") {
  const wb = XLSX.utils.book_new()
  const productsSheet = XLSX.utils.json_to_sheet(products)
  XLSX.utils.book_append_sheet(wb, productsSheet, "Products")
  const billsSheet = XLSX.utils.json_to_sheet(bills)
  XLSX.utils.book_append_sheet(wb, billsSheet, "Bills")
  XLSX.writeFile(wb, filename)
}
```

```16:50:lib/excel-utils.ts
export async function exportToExcelFS(products: Product[], bills: Bill[], suggestedName = "smartbill-data.xlsx") {
  const wb = XLSX.utils.book_new()
  const productsSheet = XLSX.utils.json_to_sheet(products)
  XLSX.utils.book_append_sheet(wb, productsSheet, "Products")
  const billsSheet = XLSX.utils.json_to_sheet(bills)
  XLSX.utils.book_append_sheet(wb, billsSheet, "Bills")

  const supportsFS = typeof window !== "undefined" && "showSaveFilePicker" in window
  if (!supportsFS) {
    XLSX.writeFile(wb, suggestedName)
    return { saved: true, method: "download" as const }
  }

  try {
    // @ts-expect-error File System Access API typing
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "Excel Workbook",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
        },
      ],
    })
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const writable = await handle.createWritable()
    await writable.write(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    await writable.close()
    return { saved: true, method: "fs" as const }
  } catch (e) {
    // Fallback to download if user cancels or API fails
    XLSX.writeFile(wb, suggestedName)
    return { saved: true, method: "download" as const }
  }
}
```

```52:70:lib/excel-utils.ts
export function parseExcelFile(file: File): Promise<{ products: Product[]; bills: Bill[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: "array" })

        const products = XLSX.utils.sheet_to_json<Product>(wb.Sheets["Products"] || {})
        const bills = XLSX.utils.sheet_to_json<Bill>(wb.Sheets["Bills"] || {})

        resolve({ products, bills })
      } catch (error) {
        reject(error)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
```

### UI Hooks: Where the app calls these

Example: Import/Export page uses `storageManager` and utilities.

```16:43:app/import-export/page.tsx
export default function ImportExportPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  //...
  useEffect(() => { loadData() }, [])
  const loadData = async () => {
    const [prods, billsList] = await Promise.all([
      storageManager.getProducts(),
      storageManager.getBills(),
    ])
    setProducts(prods)
    setBills(billsList)
  }
}
```

Saving to connected Excel or OPFS on demand:

```56:73:app/import-export/page.tsx
const handleSaveToExcelOffline = async () => {
  try {
    const [prods, billsList] = await Promise.all([
      storageManager.getProducts(),
      storageManager.getBills(),
    ])
    const res = await storageManager.saveNowToExcel()
    // UI feedback …
  } catch (error) {
    // UI error …
  }
}
```

### End-to-End Flow Summary

- User interacts with the app (add/update/delete products or bills).
- `StorageManager` writes to Dexie tables then debounces a background export.
- If a connected Excel file handle exists (via File System Access), data is written into that file; otherwise it writes a workbook into OPFS.
- Users can also manually export for download, or import a workbook to update Dexie.

### How to Integrate This in Another App

1) Add Dexie and data tables
- Install: `npm i dexie uuid xlsx`
- Create a Dexie client mirroring `products`, `bills`, `settings`, and `fsHandles` (see `lib/dexie-client.ts`).

2) Implement a storage manager
- Port `lib/storage-manager.ts` and restrict to your needs.
- Ensure all writes go through it and call `scheduleAutoExport()` after writes.

3) Implement Excel connectors
- Connected file: copy `connectExcelFile`, `hasConnectedExcel`, `saveToConnectedExcel` from `lib/excel-fs.ts`.
- OPFS background save: copy `autoSaveExcel` and helper from `lib/excel-auto.ts`.
- Manual utilities: copy from `lib/excel-utils.ts` for export/import via UI.

4) Wire the UI
- Add a button to “Connect Excel file” → `storageManager.connectExternalExcel()`.
- On save actions or after writes, call `storageManager.saveNowToExcel()` or rely on the auto-debounce.
- Use `exportToExcel`/`exportToExcelFS` for on-demand downloads.
- For import, read a user-chosen file with `parseExcelFile(file)` and then upsert into Dexie via the manager.

5) Browser/API requirements
- File System Access API and OPFS are available in Chromium-based browsers. Provide fallbacks (download) elsewhere.
- Permissions: the user must grant access once for connected-file saves.

### Common Pitfalls and Fixes
- No silent saves? Ensure you called `connectExcelFile()` and persisted `handle` in Dexie (`fsHandles`).
- OPFS not writing? Check browser support for `navigator.storage.getDirectory()` and run over HTTPS or localhost.
- Sheets missing? Ensure sheet names match (`Products`, `Bills`) and object shapes align with your TypeScript models.


