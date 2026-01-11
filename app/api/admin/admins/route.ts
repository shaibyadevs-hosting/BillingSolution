import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if current user is admin
    const { data: currentProfile } = await supabase
      .from("user_profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single()

    if (currentProfile?.role !== "admin" || currentProfile?.is_active !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all admin profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false })

    if (profilesError) {
      throw profilesError
    }

    // Map profiles to admin objects
    // Email is stored in user_profiles.username field (set during signup)
    const adminsWithEmail = (profiles || []).map((profile) => {
      return {
        id: profile.id,
        email: profile.username || "N/A", // Username stores email
        full_name: profile.full_name || "",
        business_name: profile.business_name || "",
        business_phone: profile.business_phone || null,
        business_address: profile.business_address || null,
        database_mode: profile.database_mode || "indexeddb",
        billing_mode: profile.billing_mode || "b2c",
        allow_b2b_mode: profile.allow_b2b_mode || false,
        is_active: profile.is_active !== false,
        created_at: profile.created_at,
        created_by_admin_id: profile.created_by_admin_id || null,
      }
    })

    return NextResponse.json({ admins: adminsWithEmail })
  } catch (error: any) {
    console.error("[API /admin/admins] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch admins" },
      { status: 500 }
    )
  }
}
