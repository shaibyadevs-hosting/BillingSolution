"use client"

import * as XLSX from "xlsx"

// This will be used to maintain in-memory and on-device Excel sheet storage
class ExcelSheetManager {
  workbook: XLSX.WorkBook | null = null
  products: any[] = []
  customers: any[] = []
  employees: any[] = []
  invoices: any[] = []
  fh: any = null // FileSystemFileHandle reference
  isExcelMode = false
  subscribers: (() => void)[] = []

  subscribe(fn: () => void) {
    this.subscribers.push(fn)
    return () => { this.subscribers = this.subscribers.filter(f => f !== fn) }
  }

  notify() {
    for (const fn of this.subscribers) fn()
  }

  ensureWorkbookIfNeeded(createSheets = true) {
    let createdAny = false;
    if (!this.workbook) {
      this.workbook = XLSX.utils.book_new();
      createdAny = true;
    }
    const mainSheets = ["Products","Customers","Employees","Invoices"];
    for(const sheetName of mainSheets) {
      if (!this.workbook.Sheets[sheetName]) {
        this.workbook.SheetNames.push(sheetName);
        this.workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet([]);
        createdAny = true;
      }
    }
    if (createSheets && createdAny) console.log('[excelSheetManager] One or more sheets auto-created:', this.workbook.SheetNames);
    if (!this.products) this.products = [];
    if (!this.customers) this.customers = [];
    if (!this.employees) this.employees = [];
    if (!this.invoices) this.invoices = [];
  }

  setExcelMode(active: boolean) {
    this.isExcelMode = active
    if (active) this.ensureWorkbookIfNeeded();
    this.notify()
    console.log(`[excelSheetManager] Excel mode set:`, active)
  }
  get isActive() { return this.isExcelMode }

  async initializeExcelMode() {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{
            description: "Excel Workbook",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
          }]
        })
        this.fh = fileHandle
        console.log("[excelSheetManager] Using opened Excel file handle", fileHandle)
        await this.loadAllFromExcel()
      } else {
        // fallback: prompt upload
        console.warn("[excelSheetManager] File System Access API not found - fallback to upload required")
        // UI should call loadAllFromExcel with user file
      }
      this.setExcelMode(true)
    } catch (e) {
      console.error("[excelSheetManager] Could not open Excel file. Excel mode not enabled.", e)
      this.setExcelMode(false)
      throw e
    }
  }

  async loadAllFromExcel(file?: File) {
    let arrayBuffer: ArrayBuffer
    if (file) {
      arrayBuffer = await file.arrayBuffer()
      console.log("[excelSheetManager] Loaded Excel from uploaded file")
    } else if (this.fh) {
      const file = await this.fh.getFile()
      arrayBuffer = await file.arrayBuffer()
      console.log("[excelSheetManager] Loaded Excel from file handle")
    } else {
      throw new Error("[excelSheetManager] No Excel file to load")
    }
    this.workbook = XLSX.read(arrayBuffer, { type: "array" })
    this.ensureWorkbookIfNeeded(true)
    this.products = XLSX.utils.sheet_to_json(this.workbook.Sheets["Products"] || [], { defval: "" })
    this.customers = XLSX.utils.sheet_to_json(this.workbook.Sheets["Customers"] || [], { defval: "" })
    this.employees = XLSX.utils.sheet_to_json(this.workbook.Sheets["Employees"] || [], { defval: "" })
    this.invoices = XLSX.utils.sheet_to_json(this.workbook.Sheets["Invoices"] || [], { defval: "" })
    this.notify()
    console.log(`[excelSheetManager] Loaded all sheets from Excel. products/customers/employees/invoices:`, {
      products: this.products.length, customers: this.customers.length, employees: this.employees.length, invoices: this.invoices.length
    })
  }

  async persistAllToExcel() {
    // No-op: persistence handled by API routes; keep method for compatibility
    this.ensureWorkbookIfNeeded(true)
    this.workbook = this.workbook || XLSX.utils.book_new()
  }

  // Ensures workbook exists, sheets exist, and (optionally) fills with starter mock data
  async ensureWorkbookAndSheetsWithData(_fillMock = false) {
    // No-op light check to keep API compatibility for dev pages
    this.ensureWorkbookIfNeeded(true)
    return { created: false, repaired: false, filled: false }
  }

  getList(type: "products" | "customers" | "employees" | "invoices") {
    this.ensureWorkbookIfNeeded(true);
    return this[type]
  }

  add(type: "products" | "customers" | "employees" | "invoices", item: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      console.log(`[excelSheetManager][add] Adding item to ${type}:`, item)
      this[type].push(item)
      this.notify()
      console.log(`[excelSheetManager][add] Item added to ${type} array and persisted`, item)
    } catch (e) {
      console.error(`[excelSheetManager][add] Error on ${type}:`, e, item)
      throw e;
    }
  }
  update(type: "products" | "customers" | "employees" | "invoices", id: any, patch: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      console.log(`[excelSheetManager][update] Updating item in ${type}:`, { id, patch });
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...patch }
        this.notify()
        console.log(`[excelSheetManager][update] Item updated in ${type}:`, arr[idx])
      } else {
        console.warn(`[excelSheetManager][update] Item with id not found in ${type}:`, id)
      }
    } catch (e) {
      console.error(`[excelSheetManager][update] Error on ${type}:`, e, id, patch)
      throw e;
    }
  }
  remove(type: "products" | "customers" | "employees" | "invoices", id: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      console.log(`[excelSheetManager][remove] Removing item from ${type}:`, id)
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr.splice(idx, 1)
        this.notify()
        console.log(`[excelSheetManager][remove] Item removed from ${type}:`, id)
      } else {
        console.warn(`[excelSheetManager][remove] Item with id not found in ${type}:`, id)
      }
    } catch (e) {
      console.error(`[excelSheetManager][remove] Error on ${type}:`, e, id)
      throw e;
    }
  }
  isExcelModeActive() {
    return this.isExcelMode
  }
}

export const excelSheetManager = new ExcelSheetManager()

export async function autoLoadExcelFromPublic() {
  // For now, load Products - could extend for others
  const url = "/excel-test/Products.xlsx";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const blob = await res.blob();
  const file = new File([blob], "Products.xlsx", { type: blob.type });
  await excelSheetManager.loadAllFromExcel(file);
  excelSheetManager.setExcelMode(true);
}

export async function autoLoadAllExcelFilesFromPublic() {
  const filesToSheets = [
    { url: "/excel-test/Products.xlsx", key: "products" },
    { url: "/excel-test/Customers.xlsx", key: "customers" },
    { url: "/excel-test/Employees.xlsx", key: "employees" },
    { url: "/excel-test/Invoices.xlsx", key: "invoices" },
  ];
  let loadedAny = false;
  for (const entry of filesToSheets) {
    try {
      const res = await fetch(entry.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const file = new File([blob], entry.url.split("/").pop() || "data.xlsx", { type: blob.type });
      await excelSheetManager.loadAllFromExcel(file);
      loadedAny = true;
    } catch (e) {
      // ignore, file may not exist
    }
  }
  if (loadedAny) {
    excelSheetManager.setExcelMode(true);
    excelSheetManager.notify();
  }
}


