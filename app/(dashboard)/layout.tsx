"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StoreProvider } from "@/lib/utils/store-context"
import { FullscreenProvider, useFullscreen } from "@/lib/utils/fullscreen-context"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getOfflineSession, isOfflineLoginEnabled, saveOfflineSession } from "@/lib/utils/offline-auth"
import { startSessionExpiryChecker } from "@/lib/utils/session-expiry-checker"
import { checkAdminActivity, getAdminIdFromSession } from "@/lib/utils/check-admin-activity"
import { getActiveDbModeAsync } from "@/lib/utils/db-mode"

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isFullscreen } = useFullscreen()
  
  // License seed pages and secret admin pages should not use the dashboard layout (no sidebar/header)
  // These pages should bypass ALL auth checks - they only need PIN authentication
  if (pathname?.startsWith("/admin/license-seed") || pathname?.startsWith("/admin/ckejwngw242r1")) {
    return <>{children}</>
  }
  
  useEffect(() => {
    // Skip auth check for license seed pages
    if (pathname?.startsWith("/admin/license-seed")) {
      return
    }
    
    const checkAuthAndStore = async () => {
      // STEP 1: Get database mode FIRST (enforces separation)
      const dbMode = typeof window !== "undefined" ? await getActiveDbModeAsync() : "indexeddb"
      
      // STEP 2: Check admin activity ONLY if online AND Supabase mode
      // Skip in IndexedDB mode when offline (offline is first-class)
      if (dbMode === "supabase" && typeof window !== "undefined" && navigator.onLine) {
        const adminId = await getAdminIdFromSession()
        if (adminId) {
          const isActive = await checkAdminActivity(adminId)
          if (!isActive) {
            // Admin inactive - forceLogoutAllSessions already called, just return
            return
          }
        }
      }
      
      // Check auth on client side
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // In IndexedDB mode, check IndexedDB session FIRST (works offline)
        if (dbMode === "indexeddb") {
          // Check IndexedDB session (works offline)
          const { getAuthSession } = await import("@/lib/utils/auth-session")
          const indexedDbSession = await getAuthSession()
          
          if (indexedDbSession) {
            console.log("[DashboardLayout] IndexedDB session found, allowing access (IndexedDB mode)")
            // Continue with IndexedDB session - skip Supabase checks entirely in IndexedDB mode
            return
          }
          
          // Check offline session as fallback
          const offlineSession = getOfflineSession()
          if (offlineSession) {
            console.log("[DashboardLayout] Offline session found, allowing access (IndexedDB mode)")
            // Continue with offline session - skip Supabase checks
            return
          }
          
          // Offline but no session - still allow (IndexedDB mode works offline)
          if (typeof window !== "undefined" && !navigator.onLine) {
            console.log("[DashboardLayout] Offline without session (IndexedDB mode); allowing access")
            // Continue - IndexedDB mode works offline
            return
          }
          
          // Online but no session - redirect to login
          console.log("[DashboardLayout] No session found (IndexedDB mode); redirecting to login")
          router.push("/auth/login")
          return
        }
        
        // Supabase mode: Check Supabase auth (requires internet)
        // Only check when online (Supabase mode requires internet)
        if (typeof window !== "undefined" && !navigator.onLine) {
          console.warn("[DashboardLayout] Offline in Supabase mode - redirecting to login")
          router.push("/auth/login")
          return
        }
        
        const supabase = createClient()
        let user = null
        try {
          const { data } = await supabase.auth.getUser()
          user = data.user
        } catch (error: any) {
          // Handle Supabase auth errors gracefully
          const errorMsg = error?.message || String(error)
          const isNetworkError = errorMsg.includes('fetch failed') || 
                                errorMsg.includes('network') ||
                                errorMsg.includes('timeout')
          
          // Only log non-network errors
          if (!isNetworkError && process.env.NODE_ENV === 'development') {
            console.warn("[DashboardLayout] Supabase auth error (non-network):", errorMsg)
          }
          
          router.push("/auth/login")
          return
        }
        if (!user) {
          router.push("/auth/login")
          return
        }
        
        // For admin users in Supabase mode, check if they have a store
        // (Skip in IndexedDB mode - already handled above)
        if (dbMode === "supabase") {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single()
          const userRole = profile?.role || "admin"
          
          // Only check store for admin users (not employees, they handle it differently)
          if ((userRole === "admin" || !profile) && authType !== "employee") {
            // Supabase mode: ONLY check Supabase, never Dexie
            const { data: supabaseStores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            if (supabaseStores && supabaseStores.length > 0) {
              const storeId = supabaseStores[0].id
              if (storeId) {
                localStorage.setItem("currentStoreId", storeId)
              }
            }
          }
        } else {
          // IndexedDB mode: Check Dexie stores (works offline)
          if (authType !== "employee") {
            try {
              const { db } = await import("@/lib/dexie-client")
              const dexieStores = await db.stores.toArray()
              if (dexieStores && dexieStores.length > 0) {
                const storeId = dexieStores[0].id
                localStorage.setItem("currentStoreId", storeId)
              }
            } catch (dexieError) {
              console.warn("[DashboardLayout] Error checking Dexie stores:", dexieError)
            }
          }
        }
      }
    }
    
    checkAuthAndStore()
  }, [router, pathname])

  // Start session expiry checker (runs every hour for Supabase mode)
  useEffect(() => {
    const cleanup = startSessionExpiryChecker(() => {
      // On expiry, redirect to session expired page
      router.push("/auth/session-expired")
    })
    
    return cleanup
  }, [router])

  return (
    <StoreProvider>
      <div className={`flex h-screen overflow-hidden ${isFullscreen ? 'fixed inset-0 z-9999 bg-background' : ''}`}>
        {!isFullscreen && <Sidebar />}
        <div className={`flex flex-1 flex-col ${isFullscreen ? '' : 'lg:ml-64'} min-w-0`}>
          {!isFullscreen && <Header />}
          <main className={`flex-1 overflow-y-auto bg-muted/40 ${isFullscreen ? 'p-0' : 'p-1 sm:p-2'}`}>
            <div className={`max-w-full overflow-x-hidden ${isFullscreen ? 'h-screen' : 'h-full'}`}>{children}</div>
          </main>
        </div>
      </div>
    </StoreProvider>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FullscreenProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </FullscreenProvider>
  )
}
