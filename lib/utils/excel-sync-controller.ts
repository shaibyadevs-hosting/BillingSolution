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

  setExcelMode(active: boolean) {
    this.isExcelMode = active
    this.notify()
  }

  get isActive() { return this.isExcelMode }

  async initializeExcelMode() {
    // Prompt user to open or create a workbook file
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{
            description: "Excel Workbook",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
          }]
        })
        this.fh = fileHandle
        await this.loadAllFromExcel()
      } else {
        // fallback: prompt upload
        // UI should call loadAllFromExcel with user file
      }
      this.setExcelMode(true)
    } catch (e) {
      alert("Could not open Excel file. Excel mode not enabled.")
      this.setExcelMode(false)
      throw e
    }
  }

  async loadAllFromExcel(file?: File) {
    let arrayBuffer: ArrayBuffer
    if (file) {
      arrayBuffer = await file.arrayBuffer()
    } else if (this.fh) {
      const file = await this.fh.getFile()
      arrayBuffer = await file.arrayBuffer()
    } else {
      throw new Error("No Excel file to load")
    }
    this.workbook = XLSX.read(arrayBuffer, { type: "array" })
    this.products = XLSX.utils.sheet_to_json(this.workbook.Sheets["Products"] || [], { defval: "" })
    this.customers = XLSX.utils.sheet_to_json(this.workbook.Sheets["Customers"] || [], { defval: "" })
    this.employees = XLSX.utils.sheet_to_json(this.workbook.Sheets["Employees"] || [], { defval: "" })
    this.invoices = XLSX.utils.sheet_to_json(this.workbook.Sheets["Invoices"] || [], { defval: "" })
    this.notify()
  }

  async persistAllToExcel() {
    // Create workbook and sheets
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.products), "Products")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.customers), "Customers")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.employees), "Employees")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.invoices), "Invoices")
    this.workbook = wb

    // File System Access API save
    if (this.fh && 'createWritable' in this.fh) {
      const writable = await this.fh.createWritable()
      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" })
      await writable.write(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      await writable.close()
    } else {
      // fallback: trigger file download
      XLSX.writeFile(wb, "BillingData.xlsx")
    }
  }

  // CRUD Generic methods for each entity
  getList(type: "products" | "customers" | "employees" | "invoices") { return this[type] }
  add(type: "products" | "customers" | "employees" | "invoices", item: any) {
    this[type].push(item)
    this.persistAllToExcel()
    this.notify()
  }
  update(type: "products" | "customers" | "employees" | "invoices", id: any, patch: any) {
    const arr = this[type]
    const idx = arr.findIndex((x: any) => x.id === id)
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], ...patch }
      this.persistAllToExcel()
      this.notify()
    }
  }
  remove(type: "products" | "customers" | "employees" | "invoices", id: any) {
    const arr = this[type]
    const idx = arr.findIndex((x: any) => x.id === id)
    if (idx !== -1) {
      arr.splice(idx, 1)
      this.persistAllToExcel()
      this.notify()
    }
  }
  // For UI to check if we're in excel mode
  isExcelModeActive() {
    return this.isExcelMode
  }
}

export const excelSheetManager = new ExcelSheetManager()


