import * as XLSX from "xlsx"

export interface ImportResult {
  success: boolean
  data: any[]
  errors: string[]
}

export async function importProductsFromExcel(file: File): Promise<ImportResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    const errors: string[] = []
    const products = data
      .map((row: any, index: number) => {
        try {
          return {
            name: row["Product Name"] || row.name,
            sku: row.SKU || row.sku || "",
            category: row.Category || row.category || "",
            price: Number.parseFloat(row.Price || row.price || 0),
            cost_price: Number.parseFloat(row["Cost Price"] || row.cost_price || 0),
            stock_quantity: Number.parseInt(row["Stock Quantity"] || row.stock_quantity || 0),
            unit: row.Unit || row.unit || "piece",
            hsn_code: row["HSN Code"] || row.hsn_code || "",
            gst_rate: Number.parseFloat(row["GST Rate"] || row.gst_rate || 18),
            is_active: (row.Active || row.is_active || "Yes").toLowerCase() === "yes",
          }
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid data"}`)
          return null
        }
      })
      .filter((p) => p !== null)

    return {
      success: errors.length === 0,
      data: products,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [error instanceof Error ? error.message : "Failed to import file"],
    }
  }
}

export async function importCustomersFromExcel(file: File): Promise<ImportResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    const errors: string[] = []
    const customers = data
      .map((row: any, index: number) => {
        try {
          return {
            name: row["Name"] || row.name,
            email: row.Email || row.email || "",
            phone: row.Phone || row.phone || "",
            gstin: row.GSTIN || row.gstin || "",
            billing_address: row["Billing Address"] || row.billing_address || "",
            shipping_address: row["Shipping Address"] || row.shipping_address || "",
            notes: row.Notes || row.notes || "",
          }
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid data"}`)
          return null
        }
      })
      .filter((c) => c !== null)

    return {
      success: errors.length === 0,
      data: customers,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [error instanceof Error ? error.message : "Failed to import file"],
    }
  }
}

export async function importEmployeesFromExcel(file: File): Promise<ImportResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    const errors: string[] = []
    const employees = data
      .map((row: any, index: number) => {
        try {
          const role = (row.Role || row.role || "employee").toString().toLowerCase()
          if (!["admin", "employee"].includes(role)) throw new Error("Invalid role")
          return {
            name: row["Name"] || row.name,
            email: row.Email || row.email || "",
            phone: row.Phone || row.phone || "",
            role,
            salary: Number.parseFloat(row.Salary || row.salary || 0),
            joining_date: row["Joining Date"] || row.joining_date || null,
            is_active: (row.Active || row.is_active || "Yes").toString().toLowerCase() === "yes",
          }
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid data"}`)
          return null
        }
      })
      .filter((e) => e !== null)

    return {
      success: errors.length === 0,
      data: employees,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [error instanceof Error ? error.message : "Failed to import file"],
    }
  }
}
