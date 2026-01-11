import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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

    // Update user profile
    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({
        database_mode,
        billing_mode,
        allow_b2b_mode,
        is_active,
      })
      .eq("id", params.id)

    if (profileError) {
      throw profileError
    }

    // Update business_settings
    await supabase
      .from("business_settings")
      .upsert({
        user_id: params.id,
        database_mode,
        allow_b2b_mode,
        is_b2b_enabled: billing_mode === "b2b" || billing_mode === "both",
      }, { onConflict: "user_id" })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API /admin/admins/[id]] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update admin" },
      { status: 500 }
    )
  }
}
