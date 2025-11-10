"use client"

// Single primary local DB: IndexedDB (Dexie)
export type DatabaseMode = 'indexeddb' | 'supabase'

export function getDatabaseType(): DatabaseMode {
  if (typeof window === 'undefined') return 'indexeddb'
  const v = window.localStorage.getItem('databaseType')
  return v === 'supabase' ? 'supabase' : 'indexeddb'
}

export function isIndexedDbMode() {
  return getDatabaseType() === 'indexeddb'
}

export function isCloudMode() {
  return getDatabaseType() === 'supabase'
}

export function forceIndexedDbMode() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('databaseType', 'indexeddb')
}

// Backward-compatible alias for legacy checks (`=== 'excel'`)
export function isExcelMode() {
  return isIndexedDbMode()
}
