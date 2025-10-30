import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
// Only import Supabase when needed
// import { createClient } from "@/lib/supabase/client"

export async function fetchCustomers() {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    return excelSheetManager.getList("customers")
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}
export async function createCustomer(customerData: any) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    const id = customerData.id || crypto.randomUUID()
    excelSheetManager.add("customers", { ...customerData, id })
    return { ...customerData, id }
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...customerData, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}
export async function updateCustomer(id: string, updates: any) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.update("customers", id, updates)
    return { ...updates, id }
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}
export async function deleteCustomer(id: string) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.remove("customers", id)
    return
  }
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) throw error
}
