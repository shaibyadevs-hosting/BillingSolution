"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { InvoiceActions } from "@/components/features/invoices/invoice-actions"
import { InvoicePrint } from "@/components/features/invoices/invoice-print"
import { db } from "@/lib/dexie-client"

export default function InvoiceDetailPageClient() {
  const params = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchInvoice()
  }, [params.id])

  const fetchInvoice = async () => {
    try {
      setIsLoading(true)
      const inv = await db.invoices?.get?.(params.id as string)
      if (inv) {
        setInvoice(inv)
        const invoiceItems = await db.invoice_items?.where("invoice_id").equals(params.id as string).toArray()
        setItems(invoiceItems || [])
        if (inv.customer_id) {
          const cust = await db.customers?.get?.(inv.customer_id)
          setCustomer(cust || null)
        }
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!invoice) {
    return <div className="text-center py-8">Invoice not found</div>
  }

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.18 // 18% GST
  const total = subtotal + tax

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Link href="/invoices">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
        <div className="flex gap-2">
          <InvoicePrint invoice={invoice} items={items} customer={customer} />
          <InvoiceActions invoice={invoice} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoice {invoice.invoice_number}</CardTitle>
            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
              {invoice.status || 'pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Customer</h3>
              <p className="text-sm text-muted-foreground">
                {customer?.name || invoice.customer_id}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Date</h3>
              <p className="text-sm text-muted-foreground">
                {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Line Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product_name || item.product_id}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>₹{item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%):</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

