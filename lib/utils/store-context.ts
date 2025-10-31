"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"
import { db, type Store } from "@/lib/dexie-client"

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
    // Load store from localStorage on mount
    const storedStoreId = localStorage.getItem("currentStoreId")
    if (storedStoreId) {
      db.stores.get(storedStoreId).then(store => {
        if (store) setCurrentStoreState(store)
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const setCurrentStore = (store: Store | null) => {
    setCurrentStoreState(store)
    if (store) {
      localStorage.setItem("currentStoreId", store.id)
    } else {
      localStorage.removeItem("currentStoreId")
    }
  }

  return (
    <StoreContext.Provider value={{ currentStore, setCurrentStore, loading }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}

