/*
  Node test script for Excel CRUD using xlsx
  - Creates ./tmp/TestBillingData.xlsx
  - Ensures sheets exist (Products, Customers, Employees, Invoices)
  - Adds, reads, updates, deletes a product row
  - Verifies persistence to disk after each operation
  Usage: node scripts/test-excel-products.js
*/

const fs = require("fs")
const path = require("path")
const XLSX = require("xlsx")

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed")
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function saveWorkbook(wb, filePath) {
  XLSX.writeFile(wb, filePath)
  assert(fs.existsSync(filePath), `Expected Excel file to exist after write: ${filePath}`)
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath)
}

function sheetToArray(wb, name) {
  const ws = wb.Sheets[name]
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : []
}

function arrayToSheet(wb, name, arr) {
  if (wb.SheetNames.indexOf(name) === -1) wb.SheetNames.push(name)
  wb.Sheets[name] = XLSX.utils.json_to_sheet(arr)
}

async function main() {
  const outDir = path.join(process.cwd(), "tmp")
  ensureDir(outDir)
  const filePath = path.join(outDir, "TestBillingData.xlsx")

  console.log("[excel-node-test] Starting test...", { filePath })

  // 1) Create workbook and base sheets
  let wb = XLSX.utils.book_new()
  const base = { Products: [], Customers: [], Employees: [], Invoices: [] }
  for (const [name, data] of Object.entries(base)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name)
  }
  saveWorkbook(wb, filePath)
  console.log("[excel-node-test] Workbook created with base sheets")

  // 2) Add a product
  wb = readWorkbook(filePath)
  let products = sheetToArray(wb, "Products")
  const id = crypto.randomUUID()
  const newProduct = {
    id,
    name: "Test Product",
    sku: "TP-001",
    category: "Tests",
    price: 123.45,
    cost_price: 100,
    stock_quantity: 5,
    unit: "piece",
    hsn_code: "0000",
    gst_rate: 18,
    is_active: true,
  }
  products.push(newProduct)
  arrayToSheet(wb, "Products", products)
  saveWorkbook(wb, filePath)
  console.log("[excel-node-test] Product added and persisted", { id })

  // 3) Read and verify
  wb = readWorkbook(filePath)
  products = sheetToArray(wb, "Products")
  const found = products.find((p) => p.id === id)
  assert(found, "Product not found after save")
  assert(found.name === "Test Product", "Unexpected product name")
  console.log("[excel-node-test] Verified add")

  // 4) Update product
  found.name = "Test Product Updated"
  const idx = products.findIndex((p) => p.id === id)
  products[idx] = found
  arrayToSheet(wb, "Products", products)
  saveWorkbook(wb, filePath)
  console.log("[excel-node-test] Product updated and persisted")

  wb = readWorkbook(filePath)
  products = sheetToArray(wb, "Products")
  const updated = products.find((p) => p.id === id)
  assert(updated && updated.name === "Test Product Updated", "Update not reflected in file")
  console.log("[excel-node-test] Verified update")

  // 5) Delete product
  products = products.filter((p) => p.id !== id)
  wb = readWorkbook(filePath)
  arrayToSheet(wb, "Products", products)
  saveWorkbook(wb, filePath)
  console.log("[excel-node-test] Product deleted and persisted")

  wb = readWorkbook(filePath)
  products = sheetToArray(wb, "Products")
  const removed = products.find((p) => p.id === id)
  assert(!removed, "Product still present after delete")
  console.log("[excel-node-test] Verified delete")

  console.log("[excel-node-test] SUCCESS")
}

main().catch((e) => {
  console.error("[excel-node-test] FAILURE", e)
  process.exit(1)
})


