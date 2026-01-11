import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Suppress expected Supabase session refresh errors
 * These errors occur when network is unavailable or refresh tokens are expired/invalid.
 * They're harmless and the app continues to work normally.
 */
function suppressExpectedSupabaseErrors() {
  // In Edge runtime, we can't override console methods, but errors are already handled gracefully
  // The errors are logged by Supabase internally but don't crash the app
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Wrap entire middleware in try-catch to prevent errors from crashing the app
  try {
    // Check if Supabase is configured - if not, skip auth and continue
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return supabaseResponse
    }

    // Create Supabase client
    // Note: Supabase automatically tries to refresh sessions when client is created.
    // If refresh fails (network error, expired token), errors are logged but handled gracefully.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    // Note: Supabase automatically tries to refresh sessions when client is created.
    // Network errors during refresh are handled gracefully - they're logged but don't crash the app.
    let user = null
    try {
      // Add timeout wrapper to prevent hanging on slow/unavailable Supabase
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user: null }, error: { message: 'timeout' } }>((resolve) => 
        setTimeout(() => resolve({ data: { user: null }, error: { message: 'timeout' } }), 5000)
      )
      
      const result = await Promise.race([getUserPromise, timeoutPromise])
      
      // Handle result - check for both timeout and actual result
      if (result && 'data' in result && result.data && result.data.user) {
        user = result.data.user
      } else if (result && 'error' in result && result.error && result.error.message === 'timeout') {
        // Timeout occurred - silently continue without user (allows request through)
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SupabaseMiddleware] getUser() timeout - Supabase may be slow or unavailable')
        }
        user = null
      }
    } catch (error: any) {
      // Silently handle all errors - allow request to continue
      // Network errors (fetch failed) from Supabase session refresh are expected when:
      // - Supabase service is temporarily unavailable
      // - Network connectivity issues
      // - Expired/invalid refresh tokens (causes refresh to fail)
      // These are already logged by Supabase internally, so we don't need to log them again
      user = null
      // Don't log here - Supabase's internal error handling already logs these appropriately
    }

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
    // EXCEPT: /admin/license-seed routes use simple key-based auth
    const isLicenseSeedRoute = request.nextUrl.pathname.startsWith("/admin/license-seed")
    const adminOnlyPaths = ["/admin", "/employees"]
    const isAdminOnlyRoute = adminOnlyPaths.some((path) => request.nextUrl.pathname.startsWith(path)) && !isLicenseSeedRoute
    
    // Customer routes
    const isCustomerRoute = request.nextUrl.pathname.startsWith("/customer/")
    
    // Employee-accessible routes (employees use localStorage sessions, checked client-side)
    const employeeAccessiblePaths = ["/dashboard", "/products", "/invoices", "/customers", "/reports"]
    const isEmployeeAccessibleRoute = employeeAccessiblePaths.some((path) => request.nextUrl.pathname.startsWith(path))
    
    // Settings routes - require authentication but can be accessed by both admin and employees
    const isSettingsRoute = request.nextUrl.pathname.startsWith("/settings")

    // Public routes - allow without authentication
    const isPublicInvoiceRoute = request.nextUrl.pathname.startsWith("/i/")
    const isPublicAPI = request.nextUrl.pathname.startsWith("/api/public/")
    const isLicenseRoute = request.nextUrl.pathname === "/license"
    const isRootRoute = request.nextUrl.pathname === "/"
    
    // License seed route - allow without authentication (separate from app environment)
    if (isLicenseSeedRoute) {
      return supabaseResponse
    }

    // Public invoice viewing route - allow without authentication
    if (isPublicInvoiceRoute || isPublicAPI || isLicenseRoute || isRootRoute) {
      return supabaseResponse
    }

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

    // Auth routes - signup is publicly accessible (with PIN security)
    // Other auth routes (login, etc.) are public
    const isSignupRoute = request.nextUrl.pathname.startsWith("/auth/signup")
    const isAuthRoute = request.nextUrl.pathname.startsWith("/auth/")
    const isAuthRoot = request.nextUrl.pathname === "/auth"
    
    // Handle /auth root path - redirect to login
    if (isAuthRoot) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }
    
    // Signup route is publicly accessible (PIN check happens on page)
    if (isSignupRoute) {
      return supabaseResponse
    }

    // Other auth routes (login, employee-login, customer-login, etc.) - allow without authentication
    if (isAuthRoute) {
      return supabaseResponse
    }

    return supabaseResponse
  } catch (error: any) {
    // Catch any unexpected errors in middleware and allow request to continue
    // This prevents middleware errors from breaking the entire app
    // Note: Supabase session refresh errors (fetch failed) are expected when:
    // - Network is unavailable
    // - Supabase service is temporarily down
    // - Refresh tokens are expired/invalid
    // These errors are logged by Supabase internally but don't need additional logging here
    const errorMsg = error?.message || String(error)
    const isSupabaseNetworkError = errorMsg.includes('fetch failed') || 
                                  errorMsg.includes('ECONNREFUSED') ||
                                  errorMsg.includes('ENOTFOUND') ||
                                  errorMsg.includes('timeout') ||
                                  error?.name === 'FetchError'
    
    // Only log truly unexpected errors (not Supabase network errors)
    if (!isSupabaseNetworkError && process.env.NODE_ENV === 'development') {
      console.warn('[SupabaseMiddleware] Unexpected non-network error:', errorMsg)
    }
    
    // Always return response to allow request through - app continues to work
    return supabaseResponse
  }
}
