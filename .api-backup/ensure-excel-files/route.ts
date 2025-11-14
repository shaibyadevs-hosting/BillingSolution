import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

const publicDir = path.join(process.cwd(), "public/excel-test");
const excelConfigs = [
  {
    filename: "Products.xlsx",
    sheet: "Products",
    data: [
      { id: "1", name: "Sample Product", sku: "SP-001", category: "QA", price: 100.0, cost_price: 60.0, stock_quantity: 10, unit: "piece", hsn_code: "9000", gst_rate: 18, is_active: true },
    ],
  },
  {
    filename: "Customers.xlsx",
    sheet: "Customers",
    data: [
      { id: "1", name: "Sample Customer", email: "sample@customer.com", phone: "9123456780", gstin: "", address: "Street 1" },
    ],
  },
  {
    filename: "Employees.xlsx",
    sheet: "Employees",
    data: [
      { id: "1", name: "Sample Employee", title: "Dev", salary: 50000 },
    ],
  },
  {
    filename: "Invoices.xlsx",
    sheet: "Invoices",
    data: [
      { id: "1", customer_id: "1", total: 200, created_at: new Date().toISOString(), items: '[{"product_id":"1","qty":2,"price":100}]' },
    ],
  },
];

export async function GET(request: NextRequest) {
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const result: Record<string, "created" | "exists" | "error"> = {};
  for (const cfg of excelConfigs) {
    const filePath = path.join(publicDir, cfg.filename);
    let status: "created" | "exists" | "error" = "exists";
    try {
      if (!fs.existsSync(filePath)) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cfg.data), cfg.sheet);
        XLSX.writeFile(wb, filePath);
        status = "created";
      }
    } catch (e) {
      status = "error";
    }
    result[cfg.filename] = status;
  }
  return NextResponse.json(result);
}
