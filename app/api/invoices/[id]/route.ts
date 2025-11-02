import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id: invoiceId } = await Promise.resolve(params).then(p => typeof p === 'object' && 'then' in p ? p : Promise.resolve(p))
  const supabase = await createClient()

  // Get store_id from query params (for employee access)
  const storeId = request.nextUrl.searchParams.get("store_id")

  console.log("[API][invoices][GET] Request received:", {
    invoiceId,
    storeId,
    url: request.url,
    pathname: request.nextUrl.pathname,
    searchParams: Object.fromEntries(request.nextUrl.searchParams)
  })

  // Check for Supabase user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log("[API][invoices][GET] Auth check:", {
    hasUser: !!user,
    userId: user?.id,
    authError: authError?.message,
    authErrorCode: authError?.code
  })

  let invoice = null

  // Try fetching by user_id first (for admin users)
  if (user) {
    console.log("[API][invoices][GET] Attempting to fetch by user_id:", {
      invoiceId,
      userId: user.id
    })

    const { data, error: invError } = await supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*)")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single()

    console.log("[API][invoices][GET] User_id query result:", {
      found: !!data,
      error: invError?.message,
      errorCode: invError?.code,
      errorDetails: invError?.details,
      errorHint: invError?.hint,
      invoiceUserId: data?.user_id,
      invoiceStoreId: data?.store_id,
      invoiceId: data?.id
    })

    if (!invError && data) {
      invoice = data
      console.log("[API][invoices][GET] Invoice found by user_id")
    }
  }

  // If not found and store_id provided (employee access), try fetching by store_id
  if (!invoice && storeId) {
    console.log("[API][invoices][GET] Attempting to fetch by store_id:", {
      invoiceId,
      storeId
    })

    const { data, error: invError } = await supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*)")
      .eq("id", invoiceId)
      .eq("store_id", storeId)
      .single()

    console.log("[API][invoices][GET] Store_id query result:", {
      found: !!data,
      error: invError?.message,
      errorCode: invError?.code,
      errorDetails: invError?.details,
      errorHint: invError?.hint,
      invoiceStoreId: data?.store_id,
      invoiceUserId: data?.user_id,
      invoiceId: data?.id,
      requestedStoreId: storeId
    })

    // If query failed, try to check if invoice exists without store_id filter
    if (invError && (invError.code === 'PGRST116' || invError.message?.includes('No rows'))) {
      console.log("[API][invoices][GET] Invoice not found with store_id filter, checking if invoice exists at all...")
      
      const { data: invoiceCheck, error: checkError } = await supabase
        .from("invoices")
        .select("id, store_id, user_id, invoice_number")
        .eq("id", invoiceId)
        .single()

      console.log("[API][invoices][GET] Invoice existence check:", {
        exists: !!invoiceCheck,
        checkError: checkError?.message,
        checkErrorCode: checkError?.code,
        foundInvoiceStoreId: invoiceCheck?.store_id,
        foundInvoiceUserId: invoiceCheck?.user_id,
        requestedStoreId: storeId,
        match: invoiceCheck?.store_id === storeId
      })
    }

    if (!invError && data) {
      invoice = data
      console.log("[API][invoices][GET] Invoice found by store_id")
    }
  }

  // If still not found
  if (!invoice) {
    console.error("[API][invoices][GET] Invoice not found:", {
      invoiceId,
      storeId,
      hasUser: !!user,
      userId: user?.id
    })
    
    return NextResponse.json({ 
      error: "Invoice not found or access denied",
      hint: user ? "Invoice may not belong to your account" : storeId ? `Invoice may not belong to store ${storeId}` : "Authentication required",
      debug: {
        invoiceId,
        storeId,
        hasUser: !!user
      }
    }, { status: 404 })
  }

  console.log("[API][invoices][GET] Invoice found successfully:", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    storeId: invoice.store_id,
    userId: invoice.user_id,
    customerId: invoice.customer_id,
    itemsCount: invoice.invoice_items?.length || 0,
    hasCustomer: !!invoice.customers
  })

  // Fetch user profile for business info (if user is authenticated)
  let profile = null
  if (user) {
    console.log("[API][invoices][GET] Fetching profile for user:", user.id)
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    
    console.log("[API][invoices][GET] Profile fetch result:", {
      found: !!profileData,
      error: profileError?.message,
      businessName: profileData?.business_name
    })
    
    profile = profileData
  } else if (invoice.user_id) {
    // If no current user but invoice has user_id, try to get profile from invoice owner
    console.log("[API][invoices][GET] Fetching profile for invoice owner:", invoice.user_id)
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", invoice.user_id)
      .single()
    
    console.log("[API][invoices][GET] Profile fetch result (invoice owner):", {
      found: !!profileData,
      error: profileError?.message,
      businessName: profileData?.business_name
    })
    
    profile = profileData
  }

  console.log("[API][invoices][GET] Returning response:", {
    hasInvoice: !!invoice,
    hasProfile: !!profile,
    itemsCount: invoice.invoice_items?.length || 0
  })

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
