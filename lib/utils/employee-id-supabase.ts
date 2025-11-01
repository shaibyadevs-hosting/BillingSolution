import { createClient } from "@/lib/supabase/client"

/**
 * Generates a unique 4-character employee ID for Supabase mode
 * Format: First 2 chars of store_code + 2-digit sequential number (01-99)
 * Or: First 3 chars of employee name + 1 digit if sequential unavailable
 */
export async function generateEmployeeIdSupabase(storeId: string, employeeName: string): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: store } = await supabase.from("stores").select("store_code").eq("id", storeId).single()
  if (!store) {
    throw new Error("Store not found")
  }

  const storeCode = store.store_code.toUpperCase().slice(0, 2).padEnd(2, "X")
  
  // Try sequential IDs: STORE_CODE + 01, 02, ... 99
  let candidate: string | null = null
  for (let i = 1; i <= 99; i++) {
    const candidateId = `${storeCode}${String(i).padStart(2, "0")}`
    // Check if this ID already exists for this store
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("store_id", storeId)
      .eq("employee_id", candidateId)
      .limit(1)
    
    if (!existing || existing.length === 0) {
      candidate = candidateId
      break
    }
  }
  
  if (!candidate) {
    // Fallback: First 3 chars of name + 1 digit
    const namePart = employeeName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "X")
    for (let i = 0; i <= 9; i++) {
      const candidateId = `${namePart}${i}`
      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .eq("store_id", storeId)
        .eq("employee_id", candidateId)
        .limit(1)
      
      if (!existing || existing.length === 0) {
        candidate = candidateId
        break
      }
    }
  }
  
  if (!candidate) {
    // Last resort: random 4-char alphanumeric
    candidate = Math.random().toString(36).substring(2, 6).toUpperCase()
  }
  
  return candidate
}

