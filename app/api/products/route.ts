import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][products][GET] Unauthorized access")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[API][products][GET] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[API][products][GET] Returned ${products?.length || 0} products for user ${user.id}`)
  return NextResponse.json({ products })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][products][POST] Unauthorized access")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json()
  // Log incoming request for troubleshooting
  console.log(`[API][products][POST] Incoming:`, { body, user: user.id })
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      ...body,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) {
    console.error("[API][products][POST] DB error:", error, "Input:", body, "User:", user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[API][products][POST] Created product with id ${product?.id} for user ${user.id}`)
  return NextResponse.json({ product }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("[API][products][PUT] Unauthorized access")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json()
  // Log incoming request for troubleshooting
  console.log(`[API][products][PUT] Incoming:`, { body, user: user.id })
  const { id, ...updateFields } = body
  const { data: product, error } = await supabase
    .from("products")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    console.error("[API][products][PUT] DB error:", error, "Input:", body, "User:", user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[API][products][PUT] Updated product with id ${id} for user ${user.id}`)
  return NextResponse.json({ product }, { status: 200 })
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

  const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
