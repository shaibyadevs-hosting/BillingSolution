"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"
import { db, type Store } from "@/lib/dexie-client"
import { createClient } from "@/lib/supabase/client"
import { getActiveDbModeAsync } from "@/lib/utils/db-mode"

interface StoreContextType {
  currentStore: Store | null
  setCurrentStore: (store: Store | null) => void
  loading: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStore = async () => {
      try {
        // Get database mode (works offline - falls back to localStorage)
        const dbMode = await getActiveDbModeAsync()
        const isIndexedDb = dbMode === 'indexeddb'
        
        // Check for employee session first (employees already have store in session)
        const authType = localStorage.getItem("authType")
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            try {
              const session = JSON.parse(employeeSession)
              const storedStoreId = session.storeId || localStorage.getItem("currentStoreId")
              if (storedStoreId) {
                if (isIndexedDb) {
                  // IndexedDB mode - load from Dexie (works offline)
                  const store = await db.stores.get(storedStoreId)
                  if (store) {
                    setCurrentStoreState(store)
                    setLoading(false)
                    return
                  }
                } else {
                  // Supabase mode - only load when online
                  if (typeof window !== "undefined" && navigator.onLine) {
                    const supabase = createClient()
                    const { data } = await supabase.from("stores").select("*").eq("id", storedStoreId).single()
                    if (data) {
                      setCurrentStoreState(data as any)
                      setLoading(false)
                      return
                    }
                  }
                }
              }
            } catch (e) {
              // Fall through
            }
          }
        }

        // For admin users, load store from database
        if (isIndexedDb) {
          // IndexedDB mode - load from Dexie (works offline)
          const storedStoreId = localStorage.getItem("currentStoreId")
          if (storedStoreId) {
            try {
              const store = await db.stores.get(storedStoreId)
              if (store) {
                setCurrentStoreState(store)
              }
            } catch (e) {
              // Store not found
            }
          }
          setLoading(false)
        } else {
          // Supabase mode - load from Supabase (requires internet)
          // Only check when online
          if (typeof window !== "undefined" && !navigator.onLine) {
            // Offline in Supabase mode - can't load store
            setLoading(false)
            return
          }
          
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            // Try to load from localStorage first
            const storedStoreId = localStorage.getItem("currentStoreId")
            if (storedStoreId) {
              const { data } = await supabase.from("stores").select("*").eq("id", storedStoreId).eq("admin_user_id", user.id).single()
              if (data) {
                setCurrentStoreState(data as any)
                setLoading(false)
                return
              }
            }
            
            // If no store in localStorage, try to find admin's store
            const { data: stores } = await supabase.from("stores").select("*").eq("admin_user_id", user.id).limit(1)
            if (stores && stores.length > 0) {
              const store = stores[0]
              setCurrentStoreState(store as any)
              localStorage.setItem("currentStoreId", store.id)
            }
          }
          setLoading(false)
        }
      } catch (error) {
        console.error("[StoreProvider] Error loading store:", error)
        setLoading(false)
      }
    }

    loadStore()
  }, [])

  const setCurrentStore = (store: Store | null) => {
    setCurrentStoreState(store)
    if (store) {
      localStorage.setItem("currentStoreId", store.id)
    } else {
      localStorage.removeItem("currentStoreId")
    }
  }

  return React.createElement(
    StoreContext.Provider,
    { value: { currentStore, setCurrentStore, loading } },
    children
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}

