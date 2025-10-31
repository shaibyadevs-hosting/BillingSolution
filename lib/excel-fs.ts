import * as XLSX from "xlsx"
import { db, type Product, type Invoice, type Customer, type Employee, type InvoiceItem } from "./dexie-client"

export async function connectExcelFile(suggestedName = "smartbill-data.xlsx"): Promise<boolean> {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return false
  try {
    // @ts-ignore
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "Excel Workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    })
    await db.fsHandles.put({ key: "excelHandle", handle })
    window.dispatchEvent(new CustomEvent('sync:connected'))
    return true
  } catch {
    return false
  }
}

export async function hasConnectedExcel(): Promise<boolean> {
  const rec = await db.fsHandles.get("excelHandle")
  return !!rec?.handle
}

export async function saveToConnectedExcel(products: Product[], customers: Customer[], invoices: Invoice[], employees: Employee[], invoiceItems: InvoiceItem[] = []): Promise<{ ok: boolean; error?: string; counts: { products: number; customers: number; invoices: number; employees: number; invoice_items: number } }> {
  const rec = await db.fsHandles.get("excelHandle")
  const handle = rec?.handle
  if (!handle) {
    return { 
      ok: false, 
      error: "No Excel file connected", 
      counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: employees.length, invoice_items: invoiceItems.length } 
    }
  }
  try {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), "Customers")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices), "Invoices")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceItems), "InvoiceItems")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees), "Employees")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const writable = await handle.createWritable()
    await writable.write(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    await writable.close()
    return { ok: true, counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: employees.length, invoice_items: invoiceItems.length } }
  } catch (error: any) {
    return { 
      ok: false, 
      error: error?.message || "Failed to save to Excel", 
      counts: { products: products.length, customers: customers.length, invoices: invoices.length, employees: employees.length, invoice_items: invoiceItems.length } 
    }
  }
}


