import * as XLSX from "xlsx"

export function exportProductsToExcel(products: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    products.map((p) => ({
      Name: p.name,
      SKU: p.sku,
      Category: p.category,
      Price: p.price,
      "Cost Price": p.cost_price,
      "Stock Quantity": p.stock_quantity,
      Unit: p.unit,
      "HSN Code": p.hsn_code,
      "GST Rate": p.gst_rate,
      Active: p.is_active ? "Yes" : "No",
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
  XLSX.writeFile(workbook, "products.xlsx")
}

export function exportCustomersToExcel(customers: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    customers.map((c) => ({
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      GSTIN: c.gstin,
      "Billing Address": c.billing_address,
      "Shipping Address": c.shipping_address,
      Notes: c.notes,
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
  XLSX.writeFile(workbook, "customers.xlsx")
}

export function exportInvoicesToExcel(invoices: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    invoices.map((i) => ({
      "Invoice #": i.invoice_number,
      Date: i.invoice_date,
      "Due Date": i.due_date,
      Customer: i.customer_name,
      Subtotal: i.subtotal,
      Discount: i.discount_amount,
      CGST: i.cgst_amount,
      SGST: i.sgst_amount,
      IGST: i.igst_amount,
      Total: i.total_amount,
      Status: i.status,
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices")
  XLSX.writeFile(workbook, "invoices.xlsx")
}

export function exportEmployeesToExcel(employees: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    employees.map((e) => ({
      Name: e.name,
      Email: e.email,
      Phone: e.phone,
      Role: e.role,
      Salary: e.salary,
      "Joining Date": e.joining_date,
      Active: e.is_active ? "Yes" : "No",
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees")
  XLSX.writeFile(workbook, "employees.xlsx")
}

export async function parseExcelProducts(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const products = XLSX.utils.sheet_to_json(worksheet)
        resolve(products)
      } catch (error) {
        reject(error)
      }
    }
    reader.readAsBinaryString(file)
  })
}
