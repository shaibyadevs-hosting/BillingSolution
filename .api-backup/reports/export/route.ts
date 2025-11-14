import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, startDate, endDate } = await request.json()

  try {
    if (type === "invoices") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)

      return NextResponse.json({ data: invoices })
    }

    if (type === "products") {
      const { data: products } = await supabase.from("products").select("*").eq("user_id", user.id)

      return NextResponse.json({ data: products })
    }

    if (type === "customers") {
      const { data: customers } = await supabase.from("customers").select("*").eq("user_id", user.id)

      return NextResponse.json({ data: customers })
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 })
  }
}
