import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/stores - List stores (for debugging employee login)
 * This endpoint helps debug store lookup issues
 */
export async function GET(request: NextRequest) {
  console.log("[API][stores][GET] Request received")
  
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  
  // For debugging, we'll allow unauthenticated requests to see stores
  // This helps debug employee login issues
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get("all") === "true"
  
  try {
    let query = supabase.from("stores").select("*")
    
    if (!authError && user && !includeAll) {
      // If authenticated and not requesting all, filter by admin
      query = query.eq("admin_user_id", user.id)
      console.log("[API][stores][GET] Filtering by admin_user_id:", user.id)
    } else {
      console.log("[API][stores][GET] Getting all stores (for debugging):", {
        hasUser: !!user,
        authError: authError?.message,
        includeAll,
      })
    }
    
    const { data: stores, error, count } = await query
    
    console.log("[API][stores][GET] Query result:", {
      found: stores?.length || 0,
      count,
      error: error?.message,
      errorCode: error?.code,
      stores: stores?.map(s => ({
        id: s.id,
        name: s.name,
        store_code: s.store_code,
        admin_user_id: s.admin_user_id,
      }))
    })
    
    if (error) {
      console.error("[API][stores][GET] Error:", {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      })
      return NextResponse.json({ 
        error: error.message,
        errorDetails: {
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      stores: stores || [],
      count: stores?.length || 0,
      message: "Use ?all=true to see all stores (for debugging)"
    })
  } catch (error: any) {
    console.error("[API][stores][GET] Exception:", error)
    return NextResponse.json({ 
      error: error?.message || "Failed to fetch stores" 
    }, { status: 500 })
  }
}

/**
 * POST /api/stores - Create store (admin only)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  
  if (authError || !user) {
    console.error("[API][stores][POST] Unauthorized access")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "admin"
  if (role !== "admin") {
    console.error("[API][stores][POST] Non-admin access attempted")
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  console.log("[API][stores][POST] Creating store:", {
    name: body.name,
    store_code: body.store_code,
    adminUserId: user.id,
  })

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      ...body,
      admin_user_id: user.id,
    })
    .select()
    .single()
  
  if (error) {
    console.error("[API][stores][POST] Error creating store:", {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      body,
    })
    return NextResponse.json({ 
      error: error.message || error.details || "Failed to create store" 
    }, { status: 500 })
  }
  
  console.log("[API][stores][POST] Store created successfully:", store?.id)
  return NextResponse.json({ store }, { status: 201 })
}

