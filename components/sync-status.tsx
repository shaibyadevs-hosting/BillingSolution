'use client'

import { useEffect, useState } from 'react'
import { hasConnectedExcel } from '@/lib/excel-fs'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

export function SyncStatus() {
  const [connected, setConnected] = useState<boolean>(false)
  const [saveStatus, setSaveStatus] = useState<{ status: 'idle' | 'success' | 'error'; message: string; counts?: any; time?: string }>({ status: 'idle', message: '' })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const ok = await hasConnectedExcel()
      if (mounted) setConnected(ok)
    })()
    
    const onSaved = (e: any) => {
      const result = e.detail
      if (mounted) {
        setSaveStatus({
          status: result.ok ? 'success' : 'error',
          message: result.ok 
            ? `Saved: ${result.counts.products}P, ${result.counts.customers}C, ${result.counts.invoices}I, ${result.counts.invoice_items || 0}Items`
            : result.error || 'Save failed',
          counts: result.counts,
          time: new Date().toLocaleTimeString()
        })
        // Clear success message after 5 seconds
        if (result.ok) {
          setTimeout(() => {
            if (mounted) setSaveStatus(prev => prev.status === 'success' ? { ...prev, status: 'idle', message: '' } : prev)
          }, 5000)
        }
      }
    }
    
    const onError = (e: any) => {
      if (mounted) {
        setSaveStatus({
          status: 'error',
          message: e.detail?.error || 'Sync error',
          time: new Date().toLocaleTimeString()
        })
      }
    }
    
    const onConnected = async () => {
      if (mounted) setConnected(await hasConnectedExcel())
    }
    
    window.addEventListener('sync:saved', onSaved as any)
    window.addEventListener('sync:error', onError as any)
    window.addEventListener('sync:connected', onConnected as any)
    
    return () => { 
      mounted = false
      window.removeEventListener('sync:saved', onSaved as any)
      window.removeEventListener('sync:error', onError as any)
      window.removeEventListener('sync:connected', onConnected as any)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={connected ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
        {connected ? '✓ Excel' : '⚠ Excel'}
      </span>
      {saveStatus.status !== 'idle' && (
        <div className="flex items-center gap-1">
          {saveStatus.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
          {saveStatus.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
          <span className={saveStatus.status === 'success' ? 'text-green-600' : 'text-red-600'}>
            {saveStatus.message}
          </span>
          {saveStatus.time && (
            <span className="text-muted-foreground">({saveStatus.time})</span>
          )}
        </div>
      )}
    </div>
  )
}


