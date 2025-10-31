'use client'

import { useEffect, useState } from 'react'
import { hasConnectedExcel } from '@/lib/excel-fs'
import { storageManager } from '@/lib/storage-manager'

export function SyncStatus() {
  const [connected, setConnected] = useState<boolean>(false)
  const [savedAt, setSavedAt] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const ok = await hasConnectedExcel()
      if (mounted) setConnected(ok)
    })()
    const onSaved = () => setSavedAt(new Date().toLocaleTimeString())
    window.addEventListener('sync:saved', onSaved)
    return () => { mounted = false; window.removeEventListener('sync:saved', onSaved) }
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={connected ? 'text-green-600' : 'text-yellow-600'}>
        {connected ? 'Excel Connected' : 'Excel Not Connected'}
      </span>
      {savedAt && <span className="text-muted-foreground">Last save: {savedAt}</span>}
    </div>
  )
}


