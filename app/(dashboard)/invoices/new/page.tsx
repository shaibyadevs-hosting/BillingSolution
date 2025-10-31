"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    (async () => {
      if (isExcel) {
        try {
          const [cust, prod, inv] = await Promise.all([
            db.customers.toArray(),
            db.products.toArray(),
            db.invoices.toArray(),
          ])
          console.log('[NewInvoice][Dexie] customers:', cust.length, 'products:', prod.length)
          setCustomers(cust || [])
          setProducts(prod || [])
          setSettings({
            invoice_prefix: 'INV',
            next_invoice_number: (inv?.length || 0) + 1,
            default_gst_rate: 18,
            place_of_supply: null,
          })
        } catch (e) {
          console.error('[NewInvoice][Dexie] load failed', e)
          setCustomers([])
          setProducts([])
          setSettings({ invoice_prefix: 'INV', next_invoice_number: 1, default_gst_rate: 18, place_of_supply: null })
        }
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setCustomers([]); setProducts([]); setSettings(null); return }
        const [{ data: dbCustomers }, { data: dbProducts }, { data: dbSettings }] = await Promise.all([
          supabase.from('customers').select('id, name').eq('user_id', user.id),
          supabase.from('products').select('id, name, price, gst_rate, hsn_code, unit').eq('user_id', user.id).eq('is_active', true),
          supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
        ])
        console.log('[NewInvoice][Supabase] customers:', dbCustomers?.length || 0, 'products:', dbProducts?.length || 0)
        setCustomers(dbCustomers || [])
        setProducts(dbProducts || [])
        setSettings(dbSettings || null)
      }
    })()
  }, [isExcel])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Invoice</h1>
        <p className="text-muted-foreground">Generate a new invoice for your customer</p>
      </div>
      <InvoiceForm customers={customers || []} products={products || []} settings={settings} />
    </div>
  )
}
