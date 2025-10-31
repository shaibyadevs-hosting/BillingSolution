"use client"

export function getDatabaseType(): 'excel' | 'supabase' {
  if (typeof window === 'undefined') return 'excel'
  const v = window.localStorage.getItem('databaseType')
  return v === 'supabase' ? 'supabase' : 'excel'
}

export function ensureExcelModeFromSetting() {
  // No-op in new Dexie+Excel FS architecture
}

export function isExcelMode() {
  const type = getDatabaseType()
  return type === 'excel'
}


