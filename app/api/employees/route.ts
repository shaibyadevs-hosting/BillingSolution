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
  
  // Verify store belongs to this admin
  if (body.store_id) {
    const { data: store } = await supabase
      .from("stores")
      .select("admin_user_id")
      .eq("id", body.store_id)
      .single()
    
    if (!store || store.admin_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden: Store does not belong to this admin" }, { status: 403 })
    }
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .insert({
      ...body,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) {
    console.error("[API][employees][POST] DB error:", error, "Input:", body, "User:", user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[API][employees][POST] Created employee with id ${employee?.id} for user ${user.id}`)
  return NextResponse.json({ employee }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  // Implement logic and logs as above if present
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
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
