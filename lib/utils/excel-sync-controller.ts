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
        } catch (fe: any) {
          console.error("[excelSheetManager] File handle Excel write failed", fe)
          throw new Error('Failed to write Excel file via File System Access API: ' + (fe && typeof fe === 'object' && 'message' in fe ? (fe as any).message : JSON.stringify(fe)))
        }
      } else {
        try {
          XLSX.writeFile(wb, "BillingData.xlsx")
          console.log("[excelSheetManager] Persisted Excel to download (fallback).")
        } catch (de) {
          console.error("[excelSheetManager] Excel download (writeFile) failed", de)
          throw new Error(
            'Failed to trigger Excel file download: ' +
            (de && typeof de === 'object' && 'message' in de
              ? (de as any).message
              : JSON.stringify(de))
          )
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

  // Ensures workbook exists, sheets exist, and (optionally) fills with starter mock data
  async ensureWorkbookAndSheetsWithData(fillMock = false) {
    // If no workbook or file handle, optionally prompt/auto-create
    if (!this.workbook || !this.fh) {
      // Try to create and prompt user to save a file
      if ('showSaveFilePicker' in window) {
        const defaultSheetNames = ["Products","Customers","Employees","Invoices"];
        const options = {
          suggestedName: "BillingData.xlsx",
          types: [{ description: "Excel Workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }]
        };
        const fileHandle = await (window as any).showSaveFilePicker(options);
        this.fh = fileHandle;
        this.workbook = XLSX.utils.book_new();
        // Add empty or mock sheets, if required
        for (const sheetName of defaultSheetNames) {
          let data: any[] = [];
          if (fillMock) {
            if (sheetName === "Products") data = [{ id: crypto.randomUUID(), name: "Demo Widget", sku: "WM-1", category: "Demo", price: 45.5, cost_price: 20, stock_quantity: 10, unit: "piece", hsn_code: "9999", gst_rate: 18, is_active: true }];
            if (sheetName === "Customers") data = [{ id: crypto.randomUUID(), name: "Demo Customer", email: "demo@example.com", phone: "1234567890", gstin: "", address: "123 Main Road" }];
            if (sheetName === "Employees") data = [{ id: crypto.randomUUID(), name: "Demo Employee", title: "Owner", salary: 10000 }];
            if (sheetName === "Invoices") data = [{ id: crypto.randomUUID(), customer_id: "", total: 90.5, created_at: new Date().toISOString(), items: "[]" }];
          }
          XLSX.utils.book_append_sheet(this.workbook, XLSX.utils.json_to_sheet(data), sheetName);
        }
        await this.persistAllToExcel();
        await this.loadAllFromExcel();
        this.setExcelMode(true);
        this.notify();
        return { created: true, repaired: false, filled: fillMock };
      } else {
        // fallback: user must import/upload
        alert("File System Access API not available. Please use Upload/Import.");
        return { created: false, repaired: false, filled: false };
      }
    }
    // If workbook open, ensure all standard sheets exist with mock/filler if desired
    let repaired = false, filled = false;
    const sheetNames = ["Products","Customers","Employees","Invoices"];
    for (const sheetName of sheetNames) {
      if (!this.workbook.Sheets[sheetName]) {
        XLSX.utils.book_append_sheet(this.workbook, XLSX.utils.json_to_sheet([]), sheetName);
        repaired = true;
      }
      // Optionally add mock data if sheet empty
      const rows = XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName]);
      if (fillMock && (!rows || rows.length === 0)) {
        let data: any[] = [];
        if (sheetName === "Products") data = [{ id: crypto.randomUUID(), name: "Demo Widget", sku: "WM-1", category: "Demo", price: 45.5, cost_price: 20, stock_quantity: 10, unit: "piece", hsn_code: "9999", gst_rate: 18, is_active: true }];
        if (sheetName === "Customers") data = [{ id: crypto.randomUUID(), name: "Demo Customer", email: "demo@example.com", phone: "1234567890", gstin: "", address: "123 Main Road" }];
        if (sheetName === "Employees") data = [{ id: crypto.randomUUID(), name: "Demo Employee", title: "Owner", salary: 10000 }];
        if (sheetName === "Invoices") data = [{ id: crypto.randomUUID(), customer_id: "", total: 90.5, created_at: new Date().toISOString(), items: "[]" }];
        XLSX.utils.book_append_sheet(this.workbook, XLSX.utils.json_to_sheet(data), sheetName);
        filled = true;
      }
    }
    await this.persistAllToExcel();
    await this.loadAllFromExcel();
    this.notify();
    return { created: false, repaired, filled };
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
      this.persistAllToExcel()
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
        this.persistAllToExcel()
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
        this.persistAllToExcel()
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


