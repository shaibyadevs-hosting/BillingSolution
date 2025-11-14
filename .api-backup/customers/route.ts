import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][customers][GET] Unauthorized access")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[API][customers][GET] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ customers })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  
  // Get user_id - can come from body (for employees) or from auth (for admins)
  let userId: string | null = null
  
  // Check if user_id is provided in body (for employee access)
  if (body.user_id) {
    userId = body.user_id
  } else {
    // For admin users, get from Supabase auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("[API][customers][POST] Unauthorized access")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    userId = user.id
  }
  
  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 })
  }
  
  // Remove user_id from body if present (we'll use our resolved userId)
  const { user_id: _, ...customerData } = body
  
  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      ...customerData,
      user_id: userId,
    })
    .select()
    .single()
  if (error) {
    console.error("[API][customers][POST] DB error:", error, "Input:", customerData, "User:", userId)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ customer }, { status: 201 })
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

  const { id } = await request.json()

  const { error } = await supabase.from("customers").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
