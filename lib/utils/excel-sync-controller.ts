"use client"

import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/db/dexie"
import { exportProductsToExcel, exportCustomersToExcel, exportInvoicesToExcel } from "@/lib/utils/excel-export"
import { exportEmployeesToExcel } from "@/lib/utils/excel-export-utils"
import { syncManager } from "@/lib/sync/sync-manager"

export async function syncExcelWithDexieAndSupabase(mode: "database" | "excel"): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (mode === "database") {
    // Push/Pull with remote as usual
    await syncManager.syncAll()
    return
  }

  // Excel mode: export snapshots to Excel files (download)
  // Prefer remote if online; otherwise fallback to local Dexie cache
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true

  if (isOnline && user) {
    const { data: products } = await supabase.from("products").select("*").eq("user_id", user.id)
    const { data: customers } = await supabase.from("customers").select("*").eq("user_id", user.id)
    const { data: invoices } = await supabase.from("invoices").select("*").eq("user_id", user.id)
    const { data: employees } = await supabase.from("employees").select("*").eq("user_id", user.id)

    exportProductsToExcel(products || [])
    exportCustomersToExcel(customers || [])
    exportInvoicesToExcel(invoices || [])
    exportEmployeesToExcel(employees || [])
  } else {
    const products = await db.products.toArray()
    const customers = await db.customers.toArray()
    const invoices = await db.invoices.toArray()
    const employees = (await (db as any).employees?.toArray?.()) || []

    exportProductsToExcel(products)
    exportCustomersToExcel(customers)
    exportInvoicesToExcel(invoices)
    exportEmployeesToExcel(employees)
  }
}


