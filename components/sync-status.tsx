'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

export function SyncStatus() {
  const [saveStatus, setSaveStatus] = useState<{ status: 'idle' | 'success' | 'error'; message: string; counts?: any; time?: string }>({ status: 'idle', message: '' })

  useEffect(() => {
    let mounted = true
    const onSaved = (e: any) => {
      const result = e.detail
      if (mounted) {
        const counts = result.counts || { products: 0, customers: 0, invoices: 0, invoice_items: 0 }
        setSaveStatus({
          status: result.ok ? 'success' : 'error',
          message: result.ok 
            ? `Saved: ${counts.products || 0}P, ${counts.customers || 0}C, ${counts.invoices || 0}I, ${counts.invoice_items || 0}Items`
            : result.error || 'Save failed',
          counts: counts,
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
    
    window.addEventListener('sync:saved', onSaved as any)
    window.addEventListener('sync:error', onError as any)
    
    return () => { 
      mounted = false
      window.removeEventListener('sync:saved', onSaved as any)
      window.removeEventListener('sync:error', onError as any)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs">
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


