"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getAuthSession, clearAuthSession, isSessionExpired } from "@/lib/utils/auth-session"
import { createClient } from "@/lib/supabase/client"
import { startSessionExpiryChecker } from "@/lib/utils/session-expiry-checker"
import type { AuthSession } from "@/lib/db/dexie"

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * AuthGuard component that validates session on app startup and blocks navigation if expired
 * Works completely offline - only checks IndexedDB session
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Public routes that don't require authentication
  // License seed pages should bypass ALL auth checks - they only need PIN
  // Signup is publicly accessible (PIN check happens on page)
  // Secret admin route uses PIN auth (no Supabase auth required)
  const publicRoutes = ["/auth/login", "/auth/signup", "/auth/employee-login", "/auth/customer-login", "/auth/session-expired", "/license", "/"]
  const isPublicRoute = publicRoutes.includes(pathname || "") || 
    (pathname?.startsWith("/i/") ?? false) || 
    (pathname?.startsWith("/admin/license-seed") ?? false) ||
    (pathname?.startsWith("/admin/ckejwngw242r1") ?? false)
  const isAuthRoot = pathname === "/auth"

  useEffect(() => {
    const checkAuth = async () => {
      // Handle /auth root - redirect handled by middleware, just allow through
      if (isAuthRoot) {
        setIsChecking(false)
        setIsAuthorized(true)
        return
      }

      // Allow public routes through (including signup)
      if (isPublicRoute) {
        setIsChecking(false)
        setIsAuthorized(true)
        return
      }

      // Prevent redirect if already on login page
      if (pathname === "/auth/login") {
        setIsChecking(false)
        setIsAuthorized(false)
        return
      }

      try {
        // Check IndexedDB session first (works offline)
        const session = await getAuthSession()

        if (!session || await isSessionExpired(session)) {
          // Check if user has employee session (localStorage-based)
          const authType = typeof window !== "undefined" ? localStorage.getItem("authType") : null
          const employeeSession = typeof window !== "undefined" ? localStorage.getItem("employeeSession") : null
          
          if (authType === "employee" && employeeSession) {
            // Employee session exists, but check if IndexedDB session is expired
            // If IndexedDB session exists but expired, employee session should also be considered expired
            if (session && await isSessionExpired(session)) {
              // IndexedDB session expired, clear employee session too
              console.log("[AuthGuard] Session expired, clearing employee session")
              if (typeof window !== "undefined") {
                localStorage.removeItem("authType")
                localStorage.removeItem("employeeSession")
                localStorage.removeItem("offlineAdminSession")
              }
              // Auto-logout from Supabase only if online
              if (typeof window !== "undefined" && navigator.onLine) {
                try {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  console.log("[AuthGuard] Supabase logout successful (employee session expired)")
                } catch (error) {
                  console.error("[AuthGuard] Supabase logout failed:", error)
                }
              }
              
              await clearAuthSession()
              if (pathname !== "/auth/session-expired" && pathname !== "/auth/login") {
                router.push("/auth/session-expired")
              }
              setIsChecking(false)
              setIsAuthorized(false)
              return
            }
            // Employee session exists and IndexedDB session is valid, allow through
            console.log("[AuthGuard] Employee session found, allowing access")
            setIsAuthorized(true)
            setIsChecking(false)
            return
          }

          // Check for offline admin session
          const offlineAdminSession = typeof window !== "undefined" ? localStorage.getItem("offlineAdminSession") : null
          if (offlineAdminSession) {
            try {
              const parsed = JSON.parse(offlineAdminSession)
              if (parsed.email && parsed.role) {
                // Still check IndexedDB session expiry
                if (session && await isSessionExpired(session)) {
                  // Session expired, clear everything
                  console.log("[AuthGuard] Session expired, clearing offline admin session")
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("authType")
                    localStorage.removeItem("employeeSession")
                    localStorage.removeItem("offlineAdminSession")
                  }
                  // Auto-logout from Supabase
                  try {
                    const supabase = createClient()
                    await supabase.auth.signOut()
                  } catch (error) {
                    console.log("[AuthGuard] Supabase logout queued")
                  }
                  
                  await clearAuthSession()
                  if (pathname !== "/auth/session-expired" && pathname !== "/auth/login") {
                    router.push("/auth/session-expired")
                  }
                  setIsChecking(false)
                  setIsAuthorized(false)
                  return
                }
                console.log("[AuthGuard] Offline admin session found, allowing access")
                setIsAuthorized(true)
                setIsChecking(false)
                return
              }
            } catch (e) {
              // Invalid offline session, continue to redirect
            }
          }

          console.log("[AuthGuard] No valid session found, redirecting to session expired page")
          
          // Auto-logout from Supabase only if online
          if (typeof window !== "undefined" && navigator.onLine) {
            try {
              const supabase = createClient()
              await supabase.auth.signOut()
              console.log("[AuthGuard] Supabase logout successful")
            } catch (error) {
              console.error("[AuthGuard] Supabase logout failed:", error)
              // Continue anyway - local sessions will be cleared
            }
          } else {
            console.log("[AuthGuard] Offline - Supabase logout will be attempted when online")
          }
          
          await clearAuthSession()
          // Also clear localStorage auth data
          if (typeof window !== "undefined") {
            localStorage.removeItem("authType")
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("offlineAdminSession")
            localStorage.removeItem("currentStoreId")
          }
          
          // Redirect to session expired page instead of login
          if (pathname !== "/auth/session-expired" && pathname !== "/auth/login") {
            router.push("/auth/session-expired")
          }
          setIsChecking(false)
          setIsAuthorized(false)
          return
        }

        // Session is valid
        console.log("[AuthGuard] Valid session found, allowing access")
        setIsAuthorized(true)

        // Optional: Try to refresh Supabase session if online (non-blocking)
        if (typeof window !== "undefined" && navigator.onLine) {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              // Supabase session expired but IndexedDB session is valid
              // This is fine for offline mode - continue with IndexedDB session
              console.log("[AuthGuard] Supabase session expired but IndexedDB session valid - continuing offline")
            }
          } catch (error) {
            // Supabase unavailable - that's fine, we have IndexedDB session
            console.log("[AuthGuard] Supabase unavailable, using IndexedDB session")
          }
        }
      } catch (error) {
        console.error("[AuthGuard] Error checking auth:", error)
        // On error, redirect to session expired page
        // Auto-logout from Supabase only if online
        if (typeof window !== "undefined" && navigator.onLine) {
          try {
            const supabase = createClient()
            await supabase.auth.signOut()
            console.log("[AuthGuard] Supabase logout successful (error case)")
          } catch (error) {
            console.error("[AuthGuard] Supabase logout failed:", error)
          }
        }
        await clearAuthSession()
        if (pathname !== "/auth/session-expired" && pathname !== "/auth/login") {
          router.push("/auth/session-expired")
        }
        setIsAuthorized(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()

    // Start session expiry checker for Supabase mode (runs every hour)
    // This checks if 24 hours have passed since last_login_time
    let expiryCheckerCleanup: (() => void) | null = null
    if (!isPublicRoute && pathname !== "/auth/login") {
      expiryCheckerCleanup = startSessionExpiryChecker(() => {
        router.push("/auth/session-expired")
      })
    }

    // Set up periodic check every 5 minutes to catch session expiry
    // Reduced frequency significantly to minimize API calls - we use client time for expiry checks
    // Server time API is cached for 30 minutes, so this won't cause excessive API calls
    const interval = setInterval(() => {
      if (!isPublicRoute && pathname !== "/auth/login") {
        checkAuth()
      }
    }, 300000) // Check every 5 minutes (300000ms) - much less frequent to reduce API calls

    return () => {
      clearInterval(interval)
      if (expiryCheckerCleanup) {
        expiryCheckerCleanup()
      }
    }
  }, [pathname, router, isPublicRoute])

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Only render children if authorized or on public route
  if (!isAuthorized && !isPublicRoute) {
    return null // Will redirect to login
  }

  return <>{children}</>
}

