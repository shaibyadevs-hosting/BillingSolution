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
    try {
      this.ensureWorkbookIfNeeded(true);
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.products), "Products")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.customers), "Customers")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.employees), "Employees")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.invoices), "Invoices")
      this.workbook = wb
      if (this.fh && 'createWritable' in this.fh) {
        try {
          const writable = await this.fh.createWritable()
          const out = XLSX.write(wb, { type: "array", bookType: "xlsx" })
          await writable.write(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
          await writable.close()
          console.log("[excelSheetManager] Persisted Excel to file handle.")
        } catch (fe) {
          console.error("[excelSheetManager] File handle Excel write failed", fe)
          throw new Error('Failed to write Excel file via File System Access API: ' + (fe && fe.message ? fe.message : JSON.stringify(fe)))
        }
      } else {
        try {
          XLSX.writeFile(wb, "BillingData.xlsx")
          console.log("[excelSheetManager] Persisted Excel to download (fallback).")
        } catch (de) {
          console.error("[excelSheetManager] Excel download (writeFile) failed", de)
          throw new Error('Failed to trigger Excel file download: ' + (de && de.message ? de.message : JSON.stringify(de)))
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        throw e
      } else {
        throw new Error('[excelSheetManager] persistAllToExcel unknown error: ' + JSON.stringify(e))
      }
    }
  }

  getList(type: "products" | "customers" | "employees" | "invoices") {
    this.ensureWorkbookIfNeeded(true);
    return this[type]
  }

  add(type: "products" | "customers" | "employees" | "invoices", item: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      this[type].push(item)
      this.persistAllToExcel()
      this.notify()
      console.log(`[excelSheetManager] Added item to ${type}:`, item)
    } catch (e) {
      console.error(`[excelSheetManager] Add error on ${type}:`, e)
    }
  }
  update(type: "products" | "customers" | "employees" | "invoices", id: any, patch: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...patch }
        this.persistAllToExcel()
        this.notify()
        console.log(`[excelSheetManager] Updated item in ${type}:`, { id, patch })
      }
    } catch (e) {
      console.error(`[excelSheetManager] Update error on ${type}:`, e)
    }
  }
  remove(type: "products" | "customers" | "employees" | "invoices", id: any) {
    try {
      this.ensureWorkbookIfNeeded(true);
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr.splice(idx, 1)
        this.persistAllToExcel()
        this.notify()
        console.log(`[excelSheetManager] Removed item from ${type}:`, id)
      }
    } catch (e) {
      console.error(`[excelSheetManager] Remove error on ${type}:`, e)
    }
  }
  isExcelModeActive() {
    return this.isExcelMode
  }
}

export const excelSheetManager = new ExcelSheetManager()


