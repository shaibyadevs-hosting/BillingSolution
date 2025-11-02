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
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as string
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      setError(null)

      if (isExcel) {
        // Excel mode - fetch from Dexie
        const inv = await db.invoices.get(invoiceId)
        if (!inv) {
          setError("Invoice not found")
          return
        }

        // Check employee access
        const authType = localStorage.getItem("authType")
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            const session = JSON.parse(employeeSession)
            // Check if invoice belongs to this employee's store or was created by this employee
            if (inv.store_id && inv.store_id !== session.storeId) {
              setError("Access denied: Invoice does not belong to your store")
              return
            }
          }
        }

        setInvoice(inv)

        // Fetch items
        const invoiceItems = await db.invoice_items
          .where("invoice_id")
          .equals(invoiceId)
          .toArray()
        setItems(invoiceItems || [])

        // Fetch customer
        if (inv.customer_id) {
          const cust = await db.customers.get(inv.customer_id)
          setCustomer(cust)
        }
      } else {
        // Supabase mode - use API route to avoid RLS issues
        try {
          // Determine if this is an employee session
          const authType = localStorage.getItem("authType")
          let apiUrl = `/api/invoices/${invoiceId}`
          
          if (authType === "employee") {
            const employeeSession = localStorage.getItem("employeeSession")
            if (employeeSession) {
              const session = JSON.parse(employeeSession)
              // Add store_id to query params for employee access
              apiUrl += `?store_id=${encodeURIComponent(session.storeId)}`
            }
          }

          // Use API route to bypass RLS issues
          const response = await fetch(apiUrl)
          const data = await response.json()

          if (!response.ok || !data.invoice) {
            setError(data.error || "Invoice not found")
            return
          }

          fetchedInvoice = data.invoice
          setInvoice(data.invoice)
          setItems(data.invoice.invoice_items || [])
          
          if (data.invoice.customers) {
            setCustomer(data.invoice.customers)
          }

          // Set business settings if returned by API
          if (data.profile) {
            setSettings(data.profile)
          }
        } catch (apiError: any) {
          console.error("API fetch error:", apiError)
          setError(apiError.message || "Failed to fetch invoice")
        }
      }
    } catch (err: any) {
      console.error("Error fetching invoice:", err)
      setError(err.message || "Failed to fetch invoice")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || "Invoice not found"}</p>
          <Button asChild>
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Invoice {invoice.invoice_number}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Created on {new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Badge className={statusColors[invoice.status]}>{invoice.status.toUpperCase()}</Badge>
          <InvoicePrint 
            invoiceId={invoiceId} 
            invoiceNumber={invoice.invoice_number}
            invoiceData={{
              ...invoice,
              invoice_items: items,
              customers: customer,
              profile: settings
            }}
          />
          <InvoiceActions 
            invoiceId={invoiceId} 
            invoiceNumber={invoice.invoice_number}
            invoiceData={{
              ...invoice,
              invoice_items: items,
              customers: customer,
              profile: settings
            }}
          />
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date:</span>
              <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{invoice.is_gst_invoice ? "GST Invoice" : "Non-GST Invoice"}</span>
            </div>
          </CardContent>
        </Card>

        {customer && (
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{customer.name}</span>
              </div>
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.gstin && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GSTIN:</span>
                  <span>{customer.gstin}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Discount %</TableHead>
                  {invoice.is_gst_invoice && <TableHead>GST %</TableHead>}
                  {invoice.is_gst_invoice && <TableHead>GST Amount</TableHead>}
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{item.discount_percent}%</TableCell>
                    {invoice.is_gst_invoice && <TableCell>{item.gst_rate}%</TableCell>}
                    {invoice.is_gst_invoice && <TableCell>₹{item.gst_amount.toFixed(2)}</TableCell>}
                    <TableCell>₹{item.line_total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="ml-auto w-full sm:max-w-sm space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.is_gst_invoice && (
              <>
                {invoice.cgst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span className="font-medium">₹{invoice.cgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.sgst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span className="font-medium">₹{invoice.sgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.igst_amount > 0 && (
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span className="font-medium">₹{invoice.igst_amount.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total:</span>
              <span>₹{invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
          {invoice.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.terms}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
