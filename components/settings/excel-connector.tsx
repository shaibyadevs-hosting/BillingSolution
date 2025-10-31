'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { connectExcelFile, hasConnectedExcel } from '@/lib/excel-fs'
import { storageManager } from '@/lib/storage-manager'

export function ExcelConnector() {
  const [connected, setConnected] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<string>('')

  useEffect(() => {
    (async () => setConnected(await hasConnectedExcel()))()
    const onSaved = () => setLast(new Date().toLocaleTimeString())
    window.addEventListener('sync:saved', onSaved)
    return () => window.removeEventListener('sync:saved', onSaved)
  }, [])

  return (
    <div className="space-y-2">
      <div className="text-sm">
        Status: <span className={connected ? 'text-green-600' : 'text-yellow-600'}>{connected ? 'Connected' : 'Not connected'}</span>
        {last && <span className="ml-2 text-muted-foreground">Last save: {last}</span>}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={async () => { const ok = await connectExcelFile(); const state = ok || await hasConnectedExcel(); setConnected(state); window.dispatchEvent(new CustomEvent('sync:connected', { detail: state })); }}>Connect Excel…</Button>
        <Button type="button" variant="outline" className="bg-transparent" disabled={saving} onClick={async () => { setSaving(true); await storageManager.saveNowToExcel(); setSaving(false) }}>Save Now</Button>
      </div>
    </div>
  )
}


