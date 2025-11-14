import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][employees][GET] Unauthorized access")
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
    console.error("[API][employees][GET] Non-admin access attempted")
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { data: employees, error } = await supabase
    .from("employees")
    .select("*, stores(name, store_code)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[API][employees][GET] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[API][employees][GET] Returned ${employees?.length || 0} employees for user ${user.id}`)
  return NextResponse.json({ employees })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][employees][POST] Unauthorized access")
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
    console.error("[API][employees][POST] Non-admin access attempted")
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  console.log("[API][employees][POST] Received request:", {
    employeeId: body.employee_id,
    name: body.name,
    storeId: body.store_id,
    hasStoreId: !!body.store_id,
    userId: user.id,
  })
  
  // Verify store belongs to this admin and exists
  if (body.store_id) {
    console.log("[API][employees][POST] Checking if store exists:", body.store_id)
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, admin_user_id")
      .eq("id", body.store_id)
      .single()
    
    if (storeError) {
      console.error("[API][employees][POST] Error fetching store:", {
        error: storeError,
        storeId: body.store_id,
        errorCode: storeError.code,
        errorMessage: storeError.message,
      })
      return NextResponse.json({ 
        error: `Store not found: ${storeError.message}` 
      }, { status: 404 })
    }
    
    if (!store) {
      console.error("[API][employees][POST] Store does not exist:", body.store_id)
      return NextResponse.json({ 
        error: `Store with ID ${body.store_id} does not exist` 
      }, { status: 404 })
    }
    
    if (store.admin_user_id !== user.id) {
      console.error("[API][employees][POST] Store does not belong to user:", {
        storeAdminUserId: store.admin_user_id,
        currentUserId: user.id,
        storeId: body.store_id,
      })
      return NextResponse.json({ 
        error: "Forbidden: Store does not belong to this admin" 
      }, { status: 403 })
    }
    
    console.log("[API][employees][POST] Store verified:", {
      storeId: store.id,
      storeName: store.name,
      adminUserId: store.admin_user_id,
    })
  } else {
    console.warn("[API][employees][POST] No store_id provided in request")
  }

  // Prepare insert data with proper formatting
  const insertData: any = {
    id: body.id || undefined, // Let Supabase generate if not provided
    user_id: user.id,
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    role: body.role || 'employee',
    salary: body.salary ?? null,
    joining_date: body.joining_date 
      ? (typeof body.joining_date === 'string' && body.joining_date.includes('T')
          ? body.joining_date.split('T')[0]
          : body.joining_date)
      : null,
    is_active: body.is_active ?? true,
    employee_id: body.employee_id || null,
    password: body.password || null,
    store_id: body.store_id || null,
  }

  // Check for unique constraint violation (store_id + employee_id)
  if (insertData.store_id && insertData.employee_id) {
    const { data: duplicate } = await supabase
      .from("employees")
      .select("id, employee_id")
      .eq("store_id", insertData.store_id)
      .eq("employee_id", insertData.employee_id)
      .maybeSingle()
    
    if (duplicate) {
      console.error("[API][employees][POST] Employee with same employee_id already exists in this store:", duplicate)
      return NextResponse.json({ error: `Employee ID ${insertData.employee_id} already exists in this store` }, { status: 400 })
    }
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .insert(insertData)
    .select()
    .single()
  if (error) {
    console.error("[API][employees][POST] DB error:", {
      error,
      errorDetails: {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      insertData: {
        ...insertData,
        password: insertData.password ? '[REDACTED]' : null,
      },
      userId: user.id
    })
    return NextResponse.json({ 
      error: error.message || error.details || "Failed to create employee" 
    }, { status: 500 })
  }
  console.log(`[API][employees][POST] Created employee with id ${employee?.id} for user ${user.id}`)
  return NextResponse.json({ employee }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][employees][PUT] Unauthorized access")
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
    console.error("[API][employees][PUT] Non-admin access attempted")
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) {
    return NextResponse.json({ error: "Employee ID required" }, { status: 400 })
  }

  // Verify employee belongs to this admin
  const { data: existingEmployee } = await supabase
    .from("employees")
    .select("store_id, user_id")
    .eq("id", id)
    .single()

  if (!existingEmployee || existingEmployee.user_id !== user.id) {
    return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 })
  }

  // Verify store belongs to this admin if store_id is being updated
  if (updateData.store_id && updateData.store_id !== existingEmployee.store_id) {
    const { data: store } = await supabase
      .from("stores")
      .select("admin_user_id")
      .eq("id", updateData.store_id)
      .single()
    
    if (!store || store.admin_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden: Store does not belong to this admin" }, { status: 403 })
    }
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("[API][employees][PUT] DB error:", error, "Input:", body, "User:", user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[API][employees][PUT] Updated employee with id ${id} for user ${user.id}`)
  return NextResponse.json({ employee }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
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
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 })
  }

  const { error } = await supabase.from("employees").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
