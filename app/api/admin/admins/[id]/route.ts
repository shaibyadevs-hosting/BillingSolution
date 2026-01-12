import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js App Router
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    // Check for PIN-based auth (for secret admin page)
    const pinAuthHeader = request.headers.get("x-pin-auth")
    const isPinAuth = pinAuthHeader === "true"
    
    let supabase
    
    // For PIN auth, use service role key to bypass RLS
    if (isPinAuth) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Service role key not configured" }, { status: 500 })
      }
      
      const cookieStore = await cookies()
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {
              // No-op for API routes
            },
          },
        }
      )
    } else {
      // For normal auth, use regular client and check admin status
      supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { data: currentProfile } = await supabase
        .from("user_profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single()

      if (currentProfile?.role !== "admin" || currentProfile?.is_active !== true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await request.json()
    const { database_mode, billing_mode, allow_b2b_mode, is_active } = body

    // Build update object - only include defined fields (exclude undefined/null)
    const profileUpdate: Record<string, any> = {}
    if (database_mode !== undefined && database_mode !== null) profileUpdate.database_mode = database_mode
    if (billing_mode !== undefined && billing_mode !== null) profileUpdate.billing_mode = billing_mode
    if (allow_b2b_mode !== undefined && allow_b2b_mode !== null) profileUpdate.allow_b2b_mode = allow_b2b_mode
    if (is_active !== undefined && is_active !== null) profileUpdate.is_active = is_active

    // Update user profile (only if there are fields to update)
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update(profileUpdate)
        .eq("id", id)

      if (profileError) {
        throw profileError
      }
    }

    // Update business_settings (only if relevant fields are provided)
    if (database_mode !== undefined || allow_b2b_mode !== undefined || billing_mode !== undefined) {
      const settingsUpdate: Record<string, any> = {
        user_id: id,
      }
      if (database_mode !== undefined && database_mode !== null) settingsUpdate.database_mode = database_mode
      if (allow_b2b_mode !== undefined && allow_b2b_mode !== null) settingsUpdate.allow_b2b_mode = allow_b2b_mode
      if (billing_mode !== undefined && billing_mode !== null) {
        settingsUpdate.is_b2b_enabled = billing_mode === "b2b" || billing_mode === "both"
      }

      const { error: settingsError } = await supabase
        .from("business_settings")
        .upsert(settingsUpdate, { onConflict: "user_id" })

      if (settingsError) {
        throw settingsError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API /admin/admins/[id]] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update admin" },
      { status: 500 }
    )
  }
}
