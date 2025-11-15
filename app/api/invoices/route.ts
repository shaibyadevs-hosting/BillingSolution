import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoices })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { invoice, items } = await request.json()

  const { data: newInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      ...invoice,
      user_id: user.id,
    })
    .select()
    .single()

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  const itemsWithInvoiceId = items.map((item: any) => ({
    ...item,
    invoice_id: newInvoice.id,
  }))

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId)

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", newInvoice.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ invoice: newInvoice }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, ...body } = await request.json()

  const { data: invoice, error } = await supabase
    .from("invoices")
    .update(body)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoice })
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

  // Delete invoice items first
  await supabase.from("invoice_items").delete().eq("invoice_id", id)

  // Then delete invoice
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
