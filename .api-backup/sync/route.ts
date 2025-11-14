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

  const { entity_type, entity_id, action, data } = await request.json()

  try {
    switch (entity_type) {
      case "product":
        if (action === "create" || action === "update") {
          await supabase.from("products").upsert({ ...data, user_id: user.id })
        } else if (action === "delete") {
          await supabase.from("products").delete().eq("id", entity_id).eq("user_id", user.id)
        }
        break

      case "customer":
        if (action === "create" || action === "update") {
          await supabase.from("customers").upsert({ ...data, user_id: user.id })
        } else if (action === "delete") {
          await supabase.from("customers").delete().eq("id", entity_id).eq("user_id", user.id)
        }
        break

      case "invoice":
        if (action === "create" || action === "update") {
          await supabase.from("invoices").upsert({ ...data, user_id: user.id })
        } else if (action === "delete") {
          await supabase.from("invoices").delete().eq("id", entity_id).eq("user_id", user.id)
        }
        break

      default:
        return NextResponse.json({ error: "Invalid entity type" }, { status: 400 })
    }

    // Log sync action
    await supabase.from("sync_log").insert({
      user_id: user.id,
      entity_type,
      entity_id,
      action,
      data,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
