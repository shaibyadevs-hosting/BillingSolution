"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string>("ADMN")
  const { currentStore } = useStore()
  const router = useRouter()
  const isExcel = getDatabaseType() === 'excel'
  
  // Check if user is employee - only employees can create invoices
  useEffect(() => {
    const checkAccess = async () => {
      const authType = localStorage.getItem("authType")
      if (authType !== "employee") {
        // Check if admin user
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single()
          const role = profile?.role || "admin"
          // Admin cannot create invoices - redirect to invoices list
          if (role === "admin") {
            router.push("/invoices")
            return
          }
        }
      }
    }
    checkAccess()
  }, [router])
  
  useEffect(() => {
    if (currentStore) {
      setStoreId(currentStore.id)
      // Get employee ID from session (to be set when employee logs in)
      const empSession = localStorage.getItem("employeeSession")
      if (empSession) {
        try {
          const session = JSON.parse(empSession)
          setEmployeeId(session.employeeId || "ADMN")
        } catch {}
      }
    }
  }, [currentStore])

  useEffect(() => {
    (async () => {
      if (isExcel) {
        try {
          const [cust, prod, inv] = await Promise.all([
            db.customers.toArray(),
            db.products.toArray(),
            db.invoices.toArray(),
          ])
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
        setCustomers(dbCustomers || [])
        setProducts(dbProducts || [])
        setSettings(dbSettings || null)
      }
    })()
  }, [isExcel])

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6 px-4 md:px-6 py-4 md:py-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Create New Invoice</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Generate a new invoice for your customer</p>
      </div>
      <InvoiceForm customers={customers || []} products={products || []} settings={settings} storeId={storeId} employeeId={employeeId} />
    </div>
  )
}
