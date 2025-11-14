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

  const { type, data } = await request.json()

  try {
    if (type === "products") {
      const productsWithUserId = data.map((p: any) => ({
        ...p,
        user_id: user.id,
      }))

      const { error } = await supabase.from("products").insert(productsWithUserId)

      if (error) throw error

      return NextResponse.json({ success: true, count: data.length })
    }

    return NextResponse.json({ error: "Invalid import type" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 })
  }
}
