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

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isFullscreen } = useFullscreen()
  
  // License seed pages should not use the dashboard layout (no sidebar/header)
  // This includes both the login and the main license seed page
  // IMPORTANT: These pages should bypass ALL auth checks - they only need PIN authentication
  if (pathname?.startsWith("/admin/license-seed")) {
    return <>{children}</>
  }
  
  useEffect(() => {
    // Skip auth check for license seed pages
    if (pathname?.startsWith("/admin/license-seed")) {
      return
    }
    
    const checkAuthAndStore = async () => {
      // Check auth on client side
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // Check Supabase auth
        const supabase = createClient()
        let user = null
        try {
          const { data } = await supabase.auth.getUser()
          user = data.user
        } catch (error: any) {
          // Handle Supabase auth errors gracefully
          // Network errors (fetch failed) are expected when Supabase is unavailable
          const errorMsg = error?.message || String(error)
          const isNetworkError = errorMsg.includes('fetch failed') || 
                                errorMsg.includes('network') ||
                                errorMsg.includes('timeout')
          
          // Only log non-network errors (network errors are expected during outages)
          if (!isNetworkError && process.env.NODE_ENV === 'development') {
            console.warn("[DashboardLayout] Supabase auth error (non-network):", errorMsg)
          }
          
          // Check for offline session or offline mode
          const offlineSession = getOfflineSession()
          if (offlineSession) {
            console.log("[DashboardLayout] Continuing with offline session")
            return
          }
          if (typeof window !== "undefined" && !navigator.onLine) {
            console.log("[DashboardLayout] Offline detected; skipping redirect")
            return
          }
          router.push("/auth/login")
          return
        }
        if (!user) {
          const offlineSession = getOfflineSession()
          if (offlineSession) {
            console.log("[DashboardLayout] No Supabase user but offline session active")
            return
          }
          if (typeof window !== "undefined" && !navigator.onLine) {
            console.log("[DashboardLayout] Offline without session; keeping user on page")
            return
          }
          router.push("/auth/login")
          return
        }
        
        // For admin users, check if they have a store
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        const userRole = profile?.role || "admin"
        
          // Only check store for admin users (not employees, they handle it differently)
        if ((userRole === "admin" || !profile) && authType !== "employee") {
          // Check Dexie (local database) FIRST - default storage
          let hasStore = false
          let storeId: string | null = null
          
          try {
            const { db } = await import("@/lib/dexie-client")
            const dexieStores = await db.stores.toArray()
            if (dexieStores && dexieStores.length > 0) {
              hasStore = true
              storeId = dexieStores[0].id
              localStorage.setItem("currentStoreId", storeId)
            }
          } catch (dexieError) {
            console.warn("[DashboardLayout] Error checking Dexie stores:", dexieError)
          }
          
          // Only check Supabase if database type is set to Supabase
          const dbType = typeof window !== 'undefined' ? localStorage.getItem('databaseType') : null
          if (dbType === 'supabase') {
            const { data: supabaseStores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            if (supabaseStores && supabaseStores.length > 0) {
              hasStore = true
              storeId = supabaseStores[0].id
              localStorage.setItem("currentStoreId", storeId)
            }
          }
          
          // Don't redirect to store setup on every page load
          // Store setup should only happen on first signup, not on every navigation
          // Users can manually navigate to settings/store if they need to set up a store
          
          // Store exists - ensure currentStoreId is set in localStorage
          if (hasStore && storeId) {
            localStorage.setItem("currentStoreId", storeId)
          }
          
          // Store exists - ensure currentStoreId is set in localStorage
          if (hasStore && storeId) {
            localStorage.setItem("currentStoreId", storeId)
          }
        }
        if (isOfflineLoginEnabled() && user.email) {
          const storedStoreId = localStorage.getItem("currentStoreId")
          saveOfflineSession({
            email: user.email,
            role: userRole,
            storeId: storedStoreId,
          })
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
      <div className={`flex h-screen overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[9999] bg-background' : ''}`}>
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
