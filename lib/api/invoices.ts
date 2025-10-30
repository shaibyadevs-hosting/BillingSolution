import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
// import { createClient } from "@/lib/supabase/client"

export async function fetchInvoices() {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    return excelSheetManager.getList("invoices")
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customers(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function createInvoice(invoiceData: any, items: any[]) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    const id = invoiceData.id || crypto.randomUUID()
    excelSheetManager.add("invoices", { ...invoiceData, id, items });
    return { ...invoiceData, id }
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({ ...invoiceData, user_id: user.id })
    .select()
    .single()
  if (invoiceError) throw invoiceError
  // Create invoice items
  const itemsWithInvoiceId = items.map((item) => ({ ...item, invoice_id: invoice.id }))
  const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId)
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id)
    throw itemsError
  }
  return invoice
}

export async function updateInvoice(id: string, updates: any) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.update("invoices", id, updates)
    return { ...updates, id }
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const { data, error } = await supabase.from("invoices").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteInvoice(id: string) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.remove("invoices", id)
    return
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) throw error
}
