"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/features/invoices/invoices-table"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { useUserRole } from "@/lib/hooks/use-user-role"

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole()
  const isExcel = false

  // Redirect admin to analytics page
  useEffect(() => {
    if (!roleLoading && isAdmin) {
      router.push("/admin/analytics")
    }
  }, [isAdmin, roleLoading, router])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        {
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
  }, [])

  const handleAddMockInvoice = async () => {
    try {
      // Load some data to build a mock invoice
      const [customers, products] = await Promise.all([
        db.customers.toArray(),
        db.products.toArray(),
      ])
      if (!customers.length || !products.length) {
        alert('Need at least 1 customer and 1 product to create a mock invoice')
        return
      }
      const customer = customers[Math.floor(Math.random()*customers.length)] as any
      const product = products[Math.floor(Math.random()*products.length)] as any
      const qty = Math.floor(Math.random()*5)+1
      const unit_price = product.price || 100
      const discount_percent = Math.floor(Math.random()*10)
      const gst_rate = product.gst_rate || 18
      // Compute totals (mirror of calculateLineItem)
      const subtotal = qty * unit_price
      const discountAmount = (subtotal * discount_percent)/100
      const taxableAmount = subtotal - discountAmount
      const gstAmount = (taxableAmount * gst_rate)/100
      const lineTotal = taxableAmount + gstAmount
      const invoiceId = crypto.randomUUID()
      const invoiceData: any = {
        id: invoiceId,
        customer_id: customer.id,
        invoice_number: `INV-${Math.floor(Math.random()*100000).toString().padStart(5,'0')}`,
        invoice_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        is_gst_invoice: true,
        subtotal: taxableAmount,
        cgst_amount: gst_rate ? gstAmount/2 : 0,
        sgst_amount: gst_rate ? gstAmount/2 : 0,
        igst_amount: 0,
        total_amount: lineTotal,
        notes: '',
        terms: '',
        created_at: new Date().toISOString(),
      }
      const items = [{
        id: crypto.randomUUID(),
        invoice_id: invoiceId,
        product_id: product.id,
        description: product.name,
        quantity: qty,
        unit_price,
        discount_percent,
        gst_rate,
        hsn_code: product.hsn_code || null,
        line_total: lineTotal,
        gst_amount: gstAmount,
        created_at: new Date().toISOString(),
      }]
      await storageManager.addInvoice(invoiceData, items)
      const list = await db.invoices.toArray()
      setInvoices(list)
    } catch {}
  }

  // Excel import removed

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-6 py-4 md:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage your invoices</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button type="button" variant="outline" onClick={handleAddMockInvoice} title="Add a mock invoice">
                <Sparkles className="mr-2 h-4 w-4" /> Add Mock Invoice
              </Button>
            </>
          )}
          {isEmployee && (
            <>
              <Button type="button" variant="outline" onClick={handleAddMockInvoice} title="Add a mock invoice">
                <Sparkles className="mr-2 h-4 w-4" /> Add Mock Invoice
              </Button>
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
      
      <InvoicesTable invoices={invoices || []} />
    </div>
  )
}
