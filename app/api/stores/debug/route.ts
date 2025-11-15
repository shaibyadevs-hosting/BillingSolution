import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/stores/debug - Diagnostic endpoint for employee login
 * Shows all stores and their details for debugging login issues
 */
export async function GET(request: NextRequest) {
  console.log("[API][stores][debug] Diagnostic request received")
  
  const supabase = await createClient()
  
  try {
    // Get all stores
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (storesError) {
      console.error("[API][stores][debug] Error fetching stores:", storesError)
      return NextResponse.json({ 
        error: storesError.message,
        errorCode: storesError.code,
        errorDetails: storesError.details,
        hint: storesError.hint
      }, { status: 500 })
    }
    
    // Get employee counts for each store
    const storeDetails = await Promise.all(
      (stores || []).map(async (store) => {
        const { data: employees, error: empError } = await supabase
          .from("employees")
          .select("employee_id, name")
          .eq("store_id", store.id)
        
        return {
          id: store.id,
          name: store.name,
          store_code: store.store_code,
          admin_user_id: store.admin_user_id,
          employee_count: employees?.length || 0,
          employees: employees?.map(e => ({
            employee_id: e.employee_id,
            name: e.name
          })) || [],
          error: empError?.message
        }
      })
    )
    
    console.log("[API][stores][debug] Diagnostic data:", {
      totalStores: storeDetails.length,
      storesWithEmployees: storeDetails.filter(s => s.employee_count > 0).length
    })
    
    return NextResponse.json({
      success: true,
      total_stores: storeDetails.length,
      stores: storeDetails,
      message: "Use this endpoint to debug employee login issues"
    })
  } catch (error: any) {
    console.error("[API][stores][debug] Exception:", error)
    return NextResponse.json({ 
      error: error?.message || "Failed to fetch diagnostic data" 
    }, { status: 500 })
  }
}

