import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id: invoiceId } = await Promise.resolve(params).then(p => typeof p === 'object' && 'then' in p ? p : Promise.resolve(p))
  const supabase = await createClient()

  // Get store_id from query params (for employee access)
  const storeId = request.nextUrl.searchParams.get("store_id")

  // Check for Supabase user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let invoice = null

  // Try fetching by user_id first (for admin users)
  if (user) {
    const { data, error: invError } = await supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*)")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single()

    if (!invError && data) {
      invoice = data
    }
  }

  // If not found and store_id provided (employee access), try fetching by store_id
  if (!invoice && storeId) {
    const { data, error: invError } = await supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*)")
      .eq("id", invoiceId)
      .eq("store_id", storeId)
      .single()

    if (!invError && data) {
      invoice = data
    }
  }

  // If still not found
  if (!invoice) {
    return NextResponse.json({ 
      error: "Invoice not found or access denied"
    }, { status: 404 })
  }

  // Fetch user profile for business info (if user is authenticated)
  let profile = null
  if (user) {
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    
    profile = profileData
  } else if (invoice.user_id) {
    // If no current user but invoice has user_id, try to get profile from invoice owner
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", invoice.user_id)
      .single()
    
    profile = profileData
  }

  return NextResponse.json({ invoice, profile })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id: invoiceId } = await Promise.resolve(params).then(p => typeof p === 'object' && 'then' in p ? p : Promise.resolve(p))
  const supabase = await createClient()

  // Get store_id from query params (for employee access)
  const storeId = request.nextUrl.searchParams.get("store_id")

  // Check for Supabase user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // First verify invoice exists and user has access
  let invoice = null

  if (user) {
    const { data } = await supabase
      .from("invoices")
      .select("id, user_id")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single()
    
    if (data) {
      invoice = data
    }
  }

  // If not found by user_id, check store_id for employees
  if (!invoice && storeId) {
    const { data } = await supabase
      .from("invoices")
      .select("id, store_id")
      .eq("id", invoiceId)
      .eq("store_id", storeId)
      .single()
    
    if (data) {
      invoice = data
    }
  }

  if (!invoice) {
    return NextResponse.json({ 
      error: "Invoice not found or access denied"
    }, { status: 404 })
  }

  // Delete invoice
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
