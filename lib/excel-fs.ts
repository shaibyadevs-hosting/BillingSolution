import * as XLSX from "xlsx"
import { db, type Product, type Bill } from "./dexie-client"

export async function connectExcelFile(suggestedName = "smartbill-data.xlsx"): Promise<boolean> {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return false
  try {
    // @ts-ignore
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "Excel Workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    })
    await db.fsHandles.put({ key: "excelHandle", handle })
    return true
  } catch {
    return false
  }
}

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


