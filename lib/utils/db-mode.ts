"use client"

// Single primary local DB: IndexedDB (Dexie)
export type DatabaseMode = 'indexeddb' | 'supabase'

// Cache for admin's database mode (for employees)
let cachedAdminDbMode: DatabaseMode | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 2000 // 2 seconds (shorter for real-time sync)

/**
 * Clear the database mode cache (call when admin switches modes)
 */
export function clearDatabaseModeCache(): void {
  cachedAdminDbMode = null
  cacheTimestamp = 0
}

/**
 * Get admin's database mode from database (user_profiles.database_mode or business_settings.database_mode)
 * Database is the source of truth
 * 
 * CRITICAL: In IndexedDB mode when offline, immediately fallback to localStorage
 * to avoid blocking UI with network requests
 */
async function getAdminDatabaseMode(): Promise<DatabaseMode> {
  // Use cache if recent
  const now = Date.now()
  if (cachedAdminDbMode && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedAdminDbMode
  }

  // CRITICAL: If offline, immediately fallback to localStorage (IndexedDB mode works offline)
  // This prevents blocking UI with failed network requests
  if (typeof window !== "undefined" && !navigator.onLine) {
    const v = window.localStorage.getItem('databaseType')
    const mode = v === 'supabase' ? 'supabase' : 'indexeddb'
    // Cache the result
    cachedAdminDbMode = mode
    cacheTimestamp = now
    return mode
  }

  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    // Check if employee session
    const authType = typeof window !== 'undefined' ? localStorage.getItem("authType") : null
    if (authType === "employee") {
      const employeeSession = typeof window !== 'undefined' ? localStorage.getItem("employeeSession") : null
      if (employeeSession) {
        try {
          const session = JSON.parse(employeeSession)
          const storeId = session.storeId || (typeof window !== 'undefined' ? localStorage.getItem("currentStoreId") : null)
          if (storeId) {
            // Get admin_user_id from store
            const { data: store } = await supabase
              .from("stores")
              .select("admin_user_id")
              .eq("id", storeId)
              .single()

            if (store?.admin_user_id) {
              // Get admin's database_mode from business_settings (source of truth)
              const { data: settings, error: settingsError } = await supabase
                .from("business_settings")
                .select("database_mode")
                .eq("user_id", store.admin_user_id)
                .maybeSingle()

              if (settingsError) {
                console.error("[getAdminDatabaseMode] Error fetching admin settings:", settingsError)
              }

              const mode = (settings?.database_mode as DatabaseMode) || 'indexeddb'
              cachedAdminDbMode = mode
              cacheTimestamp = now
              return mode
            }
          }
        } catch (e) {
          console.error("[getAdminDatabaseMode] Error:", e)
        }
      }
    }

    // For admin users, check database (user_profiles.database_mode first, then business_settings)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Try user_profiles.database_mode first (preferred source)
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("database_mode")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("[getAdminDatabaseMode] Error fetching user profile:", profileError)
      }

      if (profile?.database_mode) {
        const mode = profile.database_mode as DatabaseMode
        cachedAdminDbMode = mode
        cacheTimestamp = now
        return mode
      }

      // Fallback to business_settings.database_mode
      const { data: settings, error: settingsError } = await supabase
        .from("business_settings")
        .select("database_mode")
        .eq("user_id", user.id)
        .maybeSingle()

      if (settingsError) {
        console.error("[getAdminDatabaseMode] Error fetching admin settings:", settingsError)
      }

      if (settings?.database_mode) {
        const mode = settings.database_mode as DatabaseMode
        cachedAdminDbMode = mode
        cacheTimestamp = now
        return mode
      }
    }
  } catch (error) {
    console.error("[getAdminDatabaseMode] Error fetching admin DB mode:", error)
    // On error (network failure, etc.), fallback to localStorage immediately
    // This ensures IndexedDB mode continues working offline
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem('databaseType')
      const mode = v === 'supabase' ? 'supabase' : 'indexeddb'
      // Cache the fallback result
      cachedAdminDbMode = mode
      cacheTimestamp = now
      return mode
    }
  }

  // Fallback to localStorage or default
  if (typeof window !== 'undefined') {
    const v = window.localStorage.getItem('databaseType')
    const mode = v === 'supabase' ? 'supabase' : 'indexeddb'
    // Cache the fallback result
    cachedAdminDbMode = mode
    cacheTimestamp = now
    return mode
  }
  return 'indexeddb'
}

/**
 * CENTRALIZED DATABASE MODE DETECTION
 * 
 * This is the SINGLE SOURCE OF TRUTH for database mode.
 * All components must use this function to determine which database to use.
 * 
 * Rules:
 * - Supabase mode: NEVER access IndexedDB
 * - IndexedDB mode: NEVER access Supabase
 * - Hybrid operations are FORBIDDEN
 * - Employees inherit database mode from admin (via business_settings)
 * - Database (user_profiles.database_mode or business_settings.database_mode) is the source of truth
 */
export async function getActiveDbModeAsync(): Promise<DatabaseMode> {
  if (typeof window === 'undefined') return 'indexeddb'
  
  // Check if employee session
  const authType = localStorage.getItem("authType")
  if (authType === "employee") {
    // Employee: inherit from admin (reads from business_settings)
    return await getAdminDatabaseMode()
  }

  // Admin: read from database (user_profiles.database_mode or business_settings.database_mode)
  // Database is the source of truth, not localStorage
  const mode = await getAdminDatabaseMode()
  
  // Sync to localStorage for backward compatibility (non-blocking)
  if (typeof window !== 'undefined') {
    localStorage.setItem('databaseType', mode)
  }
  
  return mode
}

/**
 * Sync database mode to business_settings (for admin)
 */
async function syncDatabaseModeToSettings(mode: DatabaseMode): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Update business_settings
      await supabase
        .from("business_settings")
        .update({ database_mode: mode })
        .eq("user_id", user.id)
      
      // Clear cache
      cachedAdminDbMode = null
      cacheTimestamp = 0
    }
  } catch (error) {
    // Silently fail - not critical
    console.warn("[syncDatabaseModeToSettings] Error:", error)
  }
}

/**
 * Synchronous version (for compatibility)
 * Falls back to localStorage check if employee (may be stale)
 */
export function getActiveDbMode(): DatabaseMode {
  if (typeof window === 'undefined') return 'indexeddb'
  
  // Check if employee - use cached admin mode if available
  const authType = localStorage.getItem("authType")
  if (authType === "employee" && cachedAdminDbMode) {
    return cachedAdminDbMode
  }
  
  // For admin or if cache not available, use localStorage
  const v = localStorage.getItem('databaseType')
  return v === 'supabase' ? 'supabase' : 'indexeddb'
}

// Backward-compatible alias
export function getDatabaseType(): DatabaseMode {
  return getActiveDbMode()
}

export function isIndexedDbMode() {
  return getActiveDbMode() === 'indexeddb'
}

export function isCloudMode() {
  return getActiveDbMode() === 'supabase'
}

export function forceIndexedDbMode() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('databaseType', 'indexeddb')
}

// Backward-compatible alias for legacy checks (`=== 'excel'`)
export function isExcelMode() {
  return isIndexedDbMode()
}
