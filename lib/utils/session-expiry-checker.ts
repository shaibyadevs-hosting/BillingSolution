"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveDbModeAsync } from "./db-mode"
import { clearAuthSession } from "./auth-session"

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // Check every hour

/**
 * Check if Supabase mode session has expired (24 hours since last login)
 */
async function checkSupabaseSessionExpiry(): Promise<{ expired: boolean; shouldLogout: boolean }> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { expired: false, shouldLogout: false }
    }

    // Get user profile with last_login_time
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("last_login_time, database_mode")
      .eq("id", user.id)
      .single()

    if (!profile || profile.database_mode !== "supabase") {
      return { expired: false, shouldLogout: false }
    }

    // If no last_login_time, set it to now (first login)
    if (!profile.last_login_time) {
      await supabase
        .from("user_profiles")
        .update({ last_login_time: new Date().toISOString() })
        .eq("id", user.id)
      return { expired: false, shouldLogout: false }
    }

    // Check if 24 hours have passed
    const lastLoginTime = new Date(profile.last_login_time).getTime()
    const now = Date.now()
    const timeSinceLogin = now - lastLoginTime

    if (timeSinceLogin >= SESSION_DURATION_MS) {
      // Session expired - logout
      return { expired: true, shouldLogout: true }
    }

    return { expired: false, shouldLogout: false }
  } catch (error) {
    console.error("[SessionExpiryChecker] Error checking Supabase session:", error)
    return { expired: false, shouldLogout: false }
  }
}

/**
 * Start session expiry checker (runs every hour)
 * Returns cleanup function to stop the checker
 */
export function startSessionExpiryChecker(onExpiry?: () => void): () => void {
  let intervalId: NodeJS.Timeout | null = null

  const checkSession = async () => {
    try {
      const dbMode = await getActiveDbModeAsync()
      
      if (dbMode === "supabase") {
        const { expired, shouldLogout } = await checkSupabaseSessionExpiry()
        
        if (expired && shouldLogout) {
          console.log("[SessionExpiryChecker] Supabase session expired (24 hours), logging out")
          
          // Clear session
          await clearAuthSession()
          
          // Clear localStorage
          if (typeof window !== "undefined") {
            localStorage.removeItem("authType")
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("offlineAdminSession")
            localStorage.removeItem("currentStoreId")
            
            // Logout from Supabase
            const supabase = createClient()
            await supabase.auth.signOut()
            
            // Call expiry callback
            if (onExpiry) {
              onExpiry()
            } else {
              // Default: redirect to session expired page
              window.location.href = "/auth/session-expired"
            }
          }
        }
      }
      // IndexedDB mode uses its own session expiry mechanism (already implemented)
    } catch (error) {
      console.error("[SessionExpiryChecker] Error in check:", error)
    }
  }

  // Initial check
  checkSession()

  // Set up interval to check every hour
  intervalId = setInterval(checkSession, CHECK_INTERVAL_MS)

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

/**
 * Get remaining session time for Supabase mode (based on last_login_time)
 */
export async function getSupabaseSessionRemaining(): Promise<number | null> {
  try {
    const dbMode = await getActiveDbModeAsync()
    
    if (dbMode !== "supabase") {
      return null // Not Supabase mode
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return null
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("last_login_time")
      .eq("id", user.id)
      .single()

    if (!profile || !profile.last_login_time) {
      return SESSION_DURATION_MS // No login time yet, assume full duration
    }

    const lastLoginTime = new Date(profile.last_login_time).getTime()
    const now = Date.now()
    const elapsed = now - lastLoginTime
    const remaining = SESSION_DURATION_MS - elapsed

    return Math.max(0, remaining) // Return 0 if expired
  } catch (error) {
    console.error("[SessionExpiryChecker] Error getting remaining time:", error)
    return null
  }
}
