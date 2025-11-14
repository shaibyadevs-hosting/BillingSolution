import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/employees/lookup - Lookup employee for login (no auth required)
 * This endpoint allows employee login by looking up employees with employee_id and store_id
 */
export async function POST(request: NextRequest) {
  console.log("[API][employees][lookup] Request received")
  
  try {
    const body = await request.json()
    const { employee_id, store_id } = body
    
    if (!employee_id || !store_id) {
      return NextResponse.json({ 
        error: "employee_id and store_id are required" 
      }, { status: 400 })
    }
    
    console.log("[API][employees][lookup] Looking up employee:", {
      employee_id,
      store_id
    })
    
    const supabase = await createClient()
    
    // Query employees - RLS policy "Employees can be read for login" should allow this
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", employee_id.toUpperCase().trim())
      .eq("store_id", store_id)
      .limit(1)
    
    console.log("[API][employees][lookup] Query result:", {
      found: employees?.length || 0,
      error: empError?.message,
      errorCode: empError?.code,
      employeeId: employee_id,
      storeId: store_id
    })
    
    if (empError) {
      console.error("[API][employees][lookup] Error:", {
        error: empError,
        errorCode: empError.code,
        errorMessage: empError.message,
        errorDetails: empError.details,
        errorHint: empError.hint,
      })
      return NextResponse.json({ 
        error: empError.message,
        errorCode: empError.code,
        errorDetails: empError.details,
        hint: empError.hint
      }, { status: 500 })
    }
    
    if (!employees || employees.length === 0) {
      console.log("[API][employees][lookup] Employee not found")
      return NextResponse.json({ 
        error: "Employee not found",
        employee: null
      }, { status: 404 })
    }
    
    const employee = employees[0]
    
    console.log("[API][employees][lookup] Employee found:", {
      id: employee.id,
      employee_id: employee.employee_id,
      name: employee.name,
      hasPassword: !!employee.password
    })
    
    // Return employee data (password included for login verification)
    return NextResponse.json({ 
      employee: {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        store_id: employee.store_id,
        password: employee.password,
        email: employee.email,
        role: employee.role
      }
    })
  } catch (error: any) {
    console.error("[API][employees][lookup] Exception:", error)
    return NextResponse.json({ 
      error: error?.message || "Failed to lookup employee" 
    }, { status: 500 })
  }
}

