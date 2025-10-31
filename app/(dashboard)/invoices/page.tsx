"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/features/invoices/invoices-table"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller";
import { fetchInvoices } from "@/lib/api/invoices"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isExcel = getDatabaseType() === 'excel'

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    (async () => {
      try {
        setLoading(true)
        if (isExcel) {
          try {
            const list = await fetchInvoices()
            console.log('[InvoicesPage][Excel] fetched', list?.length || 0)
            setInvoices(list || [])
          } catch (e) {
            console.error('[InvoicesPage][Excel] fetch failed:', e)
            setInvoices([...excelSheetManager.getList('invoices')])
          }
        } else {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { setInvoices([]); return }
          const { data } = await supabase
            .from('invoices')
            .select('*, customers(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          setInvoices(data || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [isExcel])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage your invoices</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>
      {isExcel && (!invoices || invoices.length === 0) && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          No invoices found in data/Invoices.xlsx
        </div>
      )}
      <InvoicesTable invoices={invoices || []} />
    </div>
  )
}
