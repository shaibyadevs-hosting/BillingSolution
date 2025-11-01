import { createClient } from "@/lib/supabase/client"

/**
 * Generates invoice number in format: STORE4-EMP4-YYYYMMDDHHmmss-SEQ
 * STORE4: First 4 chars of store code
 * EMP4: Employee ID (4-char)
 * YYYYMMDDHHmmss: Current timestamp
 * SEQ: 3-digit daily sequence (000-999) per store, resets at midnight
 */
export async function generateInvoiceNumberSupabase(storeId: string, employeeId: string): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: store } = await supabase.from("stores").select("store_code").eq("id", storeId).single()
  if (!store) throw new Error("Store not found")
  
  const storeCode = store.store_code.toUpperCase().slice(0, 4).padEnd(4, "X")
  const empId = (employeeId || "ADMN").toUpperCase().slice(0, 4).padEnd(4, "X")
  
  // Get current date in YYYYMMDD format
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "") // HHmmss
  
  // Get or create sequence for today
  const sequenceKey = `${storeId}-${dateStr}`
  
  // Check if sequence exists
  const { data: existingSequence } = await supabase
    .from("invoice_sequences")
    .select("*")
    .eq("id", sequenceKey)
    .single()
  
  let sequence = existingSequence
  
  if (!sequence) {
    // First invoice of the day - create sequence
    const { data: newSequence, error } = await supabase
      .from("invoice_sequences")
      .insert({
        id: sequenceKey,
        store_id: storeId,
        date: dateStr,
        sequence: 0,
      })
      .select()
      .single()
    
    if (error) throw error
    sequence = newSequence
  }
  
  // Increment sequence
  const newSequence = (sequence.sequence || 0) + 1
  if (newSequence > 999) {
    throw new Error("Daily invoice limit reached (999)")
  }
  
  // Update sequence
  const { error: updateError } = await supabase
    .from("invoice_sequences")
    .update({ sequence: newSequence })
    .eq("id", sequenceKey)
  
  if (updateError) throw updateError
  
  const seqStr = String(newSequence).padStart(3, "0")
  
  return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
}

