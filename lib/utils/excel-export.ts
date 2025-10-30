import * as XLSX from "xlsx"

export interface ExportData {
  filename: string
  sheets: Array<{
    name: string
    data: any[]
    columns?: string[]
  }>
}

export function exportToExcel(data: ExportData): void {
  const workbook = XLSX.utils.book_new()

  data.sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  XLSX.writeFile(workbook, data.filename)
}

export function exportProductsToExcel(products: any[]): void {
  const data = products.map((p) => ({
    "Product Name": p.name,
    SKU: p.sku || "",
    Category: p.category || "",
    Price: p.price,
    "Cost Price": p.cost_price || "",
    "Stock Quantity": p.stock_quantity,
    Unit: p.unit,
    "HSN Code": p.hsn_code || "",
    "GST Rate": p.gst_rate,
    Active: p.is_active ? "Yes" : "No",
  }))

  exportToExcel({
    filename: `Products_${new Date().toISOString().split("T")[0]}.xlsx`,
    sheets: [{ name: "Products", data }],
  })
}

export function exportInvoicesToExcel(invoices: any[]): void {
  const data = invoices.map((inv) => ({
    "Invoice Number": inv.invoice_number,
    Date: new Date(inv.invoice_date).toLocaleDateString(),
    "Due Date": inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "",
    Customer: inv.customer_name || "",
    Subtotal: inv.subtotal,
    "CGST Amount": inv.cgst_amount,
    "SGST Amount": inv.sgst_amount,
    "IGST Amount": inv.igst_amount,
    "Total Amount": inv.total_amount,
    Status: inv.status,
    "GST Invoice": inv.is_gst_invoice ? "Yes" : "No",
  }))

  exportToExcel({
    filename: `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`,
    sheets: [{ name: "Invoices", data }],
  })
}

export function exportCustomersToExcel(customers: any[]): void {
  const data = customers.map((c) => ({
    Name: c.name,
    Email: c.email || "",
    Phone: c.phone || "",
    GSTIN: c.gstin || "",
    "Billing Address": c.billing_address || "",
    "Shipping Address": c.shipping_address || "",
    Notes: c.notes || "",
  }))

  exportToExcel({
    filename: `Customers_${new Date().toISOString().split("T")[0]}.xlsx`,
    sheets: [{ name: "Customers", data }],
  })
}

export function exportEmployeesToExcel(employees: any[]): void {
  const data = employees.map((e) => ({
    Name: e.name,
    Email: e.email || "",
    Phone: e.phone || "",
    Role: e.role,
    Salary: e.salary || 0,
    "Joining Date": e.joining_date || "",
    Active: e.is_active ? "Yes" : "No",
  }))

  exportToExcel({
    filename: `Employees_${new Date().toISOString().split("T")[0]}.xlsx`,
    sheets: [{ name: "Employees", data }],
  })
}
