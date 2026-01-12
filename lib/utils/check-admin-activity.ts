/**
 * Centralized Admin Activity Check
 * Checks if admin is_active === false and forces logout if needed
 * This is the SINGLE SOURCE OF TRUTH for admin activity validation
 */

import { createClient } from "@/lib/supabase/client"
import { clearAuthSession } from "./auth-session"
import { getActiveDbMode } from "./db-mode"

/**
 * Check admin activity and force logout if inactive
 * Returns true if admin is active, false if inactive (and logged out)
 */
export async function checkAdminActivity(adminId: string): Promise<boolean> {
  // Only check when online - offline mode allows continuation (but will check when online)
  if (typeof window === "undefined" || !navigator.onLine) {
    // Offline: Skip check, but don't allow for Supabase mode
    const dbMode = getActiveDbMode()
    if (dbMode === "supabase") {
      // Supabase mode requires online check
      console.warn("[AdminActivity] Offline in Supabase mode - cannot verify activity")
      return false
    }
    // IndexedDB mode: allow offline continuation
    return true
  }

  try {
    const supabase = createClient()
    
    // Check admin profile for is_active status
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("is_active, role")
      .eq("id", adminId)
      .single()

    if (error) {
      console.error("[AdminActivity] Error checking admin activity:", error)
      // On error, allow continuation (fail open)
      return true
    }

    // If admin is inactive, force logout
    if (profile && profile.is_active === false) {
      console.log("[AdminActivity] Admin is inactive - forcing logout")
      await forceLogoutAllSessions()
      return false
    }

    return true
  } catch (error) {
    console.error("[AdminActivity] Exception checking admin activity:", error)
    // On exception, allow continuation
    return true
  }
}

/**
 * Force logout: Clear ALL sessions (admin + employees)
 */
export async function forceLogoutAllSessions(): Promise<void> {
  console.log("[AdminActivity] Force logout: Clearing all sessions")
  
  // Clear IndexedDB session
  await clearAuthSession()
  
  // Clear localStorage sessions
  if (typeof window !== "undefined") {
    localStorage.removeItem("authType")
    localStorage.removeItem("employeeSession")
    localStorage.removeItem("offlineAdminSession")
    localStorage.removeItem("currentStoreId")
  }
  
  // Clear Supabase session (when online)
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      console.log("[AdminActivity] Supabase session cleared")
    } catch (error) {
      console.warn("[AdminActivity] Supabase logout failed (non-critical):", error)
    }
  }
  
  // Redirect to session expired page
  if (typeof window !== "undefined") {
    window.location.href = "/auth/session-expired"
  }
}

/**
 * Get admin ID from current session (works for both admin and employee)
 */
export async function getAdminIdFromSession(): Promise<string | null> {
  if (typeof window === "undefined") return null
  
  // Check employee session first (employees have admin_user_id in their session)
  const authType = localStorage.getItem("authType")
  if (authType === "employee") {
    const employeeSession = localStorage.getItem("employeeSession")
    if (employeeSession) {
      try {
        const parsed = JSON.parse(employeeSession)
        // Employee session should have storeId or adminUserId
        // For now, we need to get it from store lookup
        const storeId = parsed.storeId || localStorage.getItem("currentStoreId")
        if (storeId) {
          // Look up admin from store (if online)
          if (navigator.onLine) {
            try {
              const supabase = createClient()
              const { data: store } = await supabase
                .from("stores")
                .select("admin_user_id")
                .eq("id", storeId)
                .single()
              
              if (store?.admin_user_id) {
                return store.admin_user_id
              }
            } catch (error) {
              console.warn("[AdminActivity] Error looking up admin from store:", error)
            }
          }
        }
      } catch (e) {
        // Invalid session
      }
    }
  }
  
  // Check Supabase session (for admin)
  if (navigator.onLine) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        return user.id
      }
    } catch (error) {
      // Supabase unavailable
    }
  }
  
  // Check IndexedDB session
  try {
    const { getAuthSession } = await import("./auth-session")
    const session = await getAuthSession()
    if (session?.userId) {
      return session.userId
    }
  } catch (error) {
    // IndexedDB unavailable
  }
  
  return null
}
