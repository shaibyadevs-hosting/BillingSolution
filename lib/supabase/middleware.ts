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
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    role = (profile as any)?.role || null
  }

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ["/dashboard", "/products", "/invoices", "/customers", "/reports", "/settings"]
  const isProtectedRoute = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  
  // Customer routes
  const isCustomerRoute = request.nextUrl.pathname.startsWith("/customer/")
  // Employee routes (same as admin routes for now)
  const isEmployeeRoute = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/products") || request.nextUrl.pathname.startsWith("/invoices") || request.nextUrl.pathname.startsWith("/customers")

  // Check customer session for customer routes
  if (isCustomerRoute) {
    // Customer routes are handled client-side, middleware just allows through
    // Actual auth check happens in the page component
    return supabaseResponse
  }

  if (isProtectedRoute && !user) {
    // Check for employee session in cookies/localStorage (handled client-side)
    // For now, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Role-based protections
  const adminOnlyPaths = ["/admin"]
  const isAdminOnlyRoute = adminOnlyPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (user && isAdminOnlyRoute && role !== "admin") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
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
