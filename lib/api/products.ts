import { createClient } from "@/lib/supabase/client"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

export async function fetchProducts() {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    return excelSheetManager.getList("products")
  }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createProduct(productData: any) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    const id = productData.id || crypto.randomUUID()
    excelSheetManager.add("products", { ...productData, id })
    return { ...productData, id }
  }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...productData,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(id: string, updates: any) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.update("products", id, updates)
    return { ...updates, id }
  }
  const supabase = createClient()

  const { data, error } = await supabase.from("products").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data
}

export async function deleteProduct(id: string) {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    excelSheetManager.remove("products", id)
    return
  }
  const supabase = createClient()

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) throw error
}
