import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const invoicesFile = path.join(process.cwd(), "public/excel-test/Invoices.xlsx");
const SHEET = "Invoices";

function log(...args: any[]) { console.log("[EXCEL:invoices]", ...args); }
function loadInvoices(): any[] {
  if (!fs.existsSync(invoicesFile)) {
    log("Invoices file missing at", invoicesFile);
    return [];
  }
  const wb = XLSX.readFile(invoicesFile);
  const ws = wb.Sheets[SHEET];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
}
function saveInvoices(invoices: any[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices), SHEET);
  XLSX.writeFile(wb, invoicesFile);
  log('Invoices saved:', invoices.length, 'total');
}
export async function GET() {
  const invoices = loadInvoices();
  log('Fetched invoices:', invoices.length);
  return NextResponse.json({ invoices });
}
export async function POST(request: NextRequest) {
  const data = await request.json();
  log('POST body:', data);
  let invoices = loadInvoices();
  if (!data.customer_id || !data.invoice_number) return NextResponse.json({ error: 'customer_id and invoice_number are required' }, { status: 400 });
  const id = data.id || crypto.randomUUID();
  const newInv = { ...data, id };
  invoices.push(newInv);
  saveInvoices(invoices);
  log('Invoice added:', id);
  return NextResponse.json({ invoice: newInv, invoices });
}
export async function PUT(request: NextRequest) {
  const data = await request.json();
  log('PUT body:', data);
  let invoices = loadInvoices();
  if (!data.id) return NextResponse.json({ error: 'Invoice id required for update' }, { status: 400 });
  const idx = invoices.findIndex((i: any) => i.id === data.id);
  if (idx === -1) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  invoices[idx] = { ...invoices[idx], ...data };
  saveInvoices(invoices);
  log('Invoice updated:', data.id);
  return NextResponse.json({ invoice: invoices[idx], invoices });
}
export async function DELETE(request: NextRequest) {
  const data = await request.json();
  log('DELETE body:', data);
  let invoices = loadInvoices();
  if (!data.id) return NextResponse.json({ error: 'Invoice id required for delete' }, { status: 400 });
  const before = invoices.length;
  invoices = invoices.filter((i: any) => i.id !== data.id);
  saveInvoices(invoices);
  log('Invoice deleted:', data.id, 'remaining:', invoices.length);
  return NextResponse.json({ success: true, deleted: data.id, count: before - invoices.length, invoices });
}
