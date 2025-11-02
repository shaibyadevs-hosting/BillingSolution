import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // IMPORTANT: Do not run code between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch role if authenticated
  let role: string | null = null
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle() // Use maybeSingle() to avoid errors when profile doesn't exist
    
    // Default to "admin" if profile doesn't exist, role is null, or query fails
    // This is consistent with other parts of the codebase where admin is the default role
    if (profileError) {
      // Only log non-404 errors (profile missing is expected for new users)
      const isNotFoundError = profileError.code === 'PGRST116' || 
                              profileError.message?.includes('No rows') ||
                              profileError.message?.includes('not found')
      
      if (!isNotFoundError) {
        console.warn("[Middleware] Error fetching user profile:", profileError.message)
      }
      role = "admin" // Default to admin if profile query fails
    } else {
      role = (profile as any)?.role || "admin"
    }
  }

  // Admin-only routes - require Supabase auth with admin role
  const adminOnlyPaths = ["/admin", "/employees"]
  const isAdminOnlyRoute = adminOnlyPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  
  // Customer routes
  const isCustomerRoute = request.nextUrl.pathname.startsWith("/customer/")
  
  // Employee-accessible routes (employees use localStorage sessions, checked client-side)
  const employeeAccessiblePaths = ["/dashboard", "/products", "/invoices", "/customers", "/reports"]
  const isEmployeeAccessibleRoute = employeeAccessiblePaths.some((path) => request.nextUrl.pathname.startsWith(path))
  
  // Settings routes - require authentication but can be accessed by both admin and employees
  const isSettingsRoute = request.nextUrl.pathname.startsWith("/settings")

  // Check customer session for customer routes
  if (isCustomerRoute) {
    // Customer routes are handled client-side, middleware just allows through
    // Actual auth check happens in the page component
    return supabaseResponse
  }

  // Admin-only routes require Supabase authentication with admin role
  // BUT: In Excel mode, users may not have Supabase auth, so allow through
  // Client-side components will handle the actual access control
  if (isAdminOnlyRoute) {
    if (!user) {
      // No Supabase user - could be Excel mode
      // Allow through, client-side will check admin status
      // For Excel mode, admin check happens client-side via useUserRole hook
      return supabaseResponse
    }
    
    // User exists, check if they're admin
    if (role !== "admin") {
      // Not an admin - redirect to dashboard
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
    
    // Admin user accessing admin routes - allow through
    return supabaseResponse
  }

  // For employee-accessible routes and settings, allow through without strict Supabase auth check
  // Client-side components will check for employee sessions (localStorage) or Supabase auth
  // This allows employees with localStorage sessions to access these routes
  if (isEmployeeAccessibleRoute || isSettingsRoute) {
    // Allow through - client-side will handle auth checks (Supabase or employee session)
    return supabaseResponse
  }

  // Auth routes - allow access to login page even if authenticated (user can see their status)
  // Only redirect if explicitly trying to access signup while logged in
  const isSignupRoute = request.nextUrl.pathname.startsWith("/auth/signup")
  
  if (isSignupRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = role === "admin" ? "/admin/analytics" : "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
