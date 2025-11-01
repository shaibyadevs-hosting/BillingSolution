"use client"

import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StoreProvider } from "@/lib/utils/store-context"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    const checkAuthAndStore = async () => {
      // Check auth on client side
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // Check Supabase auth
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
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
          const isExcel = typeof window !== 'undefined' && localStorage.getItem('databaseType') !== 'supabase'
          
          let hasStore = false
          if (isExcel) {
            // Excel mode - check Dexie
            const { db } = await import("@/lib/dexie-client")
            const stores = await db.stores.toArray()
            hasStore = stores && stores.length > 0
            if (hasStore) {
              localStorage.setItem("currentStoreId", stores[0].id)
            }
          } else {
            // Supabase mode
            const { data: stores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            hasStore = stores && stores.length > 0
            if (hasStore) {
              localStorage.setItem("currentStoreId", stores[0].id)
            }
          }
          
          // Only redirect to store setup if:
          // 1. No store exists
          // 2. Not already on the store setup page or settings pages
          // 3. Trying to access main dashboard or other non-settings pages
          if (!hasStore) {
            // Allow access to store setup and settings pages
            if (pathname?.includes("/settings/store") || pathname?.includes("/settings")) {
              // Already on store setup page, allow it
              return
            }
            // Redirect to store setup if on any other page
            router.push("/settings/store")
            return
          }
          
          // Store exists - ensure currentStoreId is set in localStorage
          // This is already done above, but just to be sure
        }
      }
    }
    
    checkAuthAndStore()
  }, [router, pathname])

  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:ml-64">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/40 p-6">{children}</main>
        </div>
      </div>
    </StoreProvider>
  )
}
