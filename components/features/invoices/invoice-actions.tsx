"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Download, Edit2, Trash2, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { generateInvoicePDF } from "@/lib/utils/pdf-generator"

interface InvoiceActionsProps {
  invoiceId: string
  invoiceNumber: string
  invoiceData?: any // Optional: pass invoice data if already loaded
}

export function InvoiceActions({ invoiceId, invoiceNumber, invoiceData }: InvoiceActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleDownloadPDF = async () => {
    setIsLoading(true)
    try {
      let invoice: any = null
      let items: any[] = []
      let customer: any = null
      let profile: any = null

      // If invoice data is already provided, use it (avoid API call)
      if (invoiceData) {
        console.log("[InvoiceActions] Using provided invoice data for PDF")
        invoice = invoiceData
        const rawItems = invoice.invoice_items || invoice.items || []
        customer = invoice.customers || invoice.customer || null
        profile = invoice.profile || null
        
        // Transform items to match PDF generator format (snake_case to camelCase)
        items = rawItems.map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price || item.unitPrice) || 0,
          discountPercent: Number(item.discount_percent || item.discountPercent) || 0,
          gstRate: Number(item.gst_rate || item.gstRate) || 0,
          lineTotal: Number(item.line_total || item.lineTotal) || 0,
          gstAmount: Number(item.gst_amount || item.gstAmount) || 0,
        }))
      } else {
        // Fallback: Fetch from API if data not provided
        console.log("[InvoiceActions] Fetching invoice from API (fallback)")
        
        // Determine if this is an employee session
        const authType = localStorage.getItem("authType")
        let apiUrl = `/api/invoices/${invoiceId}`
        
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            const session = JSON.parse(employeeSession)
            apiUrl += `?store_id=${encodeURIComponent(session.storeId)}`
          }
        }

        // Fetch invoice data via API route
        const response = await fetch(apiUrl)
        const data = await response.json()

        if (!response.ok || !data.invoice) {
          throw new Error(data.error || "Failed to fetch invoice")
        }

        invoice = data.invoice
        const rawItems = invoice.invoice_items || []
        customer = invoice.customers || null
        profile = data.profile || null
        
        // Transform items to match PDF generator format (snake_case to camelCase)
        items = rawItems.map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price || item.unitPrice) || 0,
          discountPercent: Number(item.discount_percent || item.discountPercent) || 0,
          gstRate: Number(item.gst_rate || item.gstRate) || 0,
          lineTotal: Number(item.line_total || item.lineTotal) || 0,
          gstAmount: Number(item.gst_amount || item.gstAmount) || 0,
        }))
      }

      generateInvoicePDF({
        invoiceNumber: invoice.invoice_number || invoiceNumber,
        invoiceDate: invoice.invoice_date || invoice.invoiceDate || new Date().toISOString(),
        dueDate: invoice.due_date || invoice.dueDate,
        customerName: customer?.name,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        customerGSTIN: customer?.gstin,
        businessName: profile?.business_name || "Business",
        businessGSTIN: profile?.business_gstin,
        businessAddress: profile?.business_address,
        businessPhone: profile?.business_phone,
        items: items || [],
        subtotal: Number(invoice.subtotal) || 0,
        cgstAmount: Number(invoice.cgst_amount || invoice.cgstAmount) || 0,
        sgstAmount: Number(invoice.sgst_amount || invoice.sgstAmount) || 0,
        igstAmount: Number(invoice.igst_amount || invoice.igstAmount) || 0,
        totalAmount: Number(invoice.total_amount || invoice.totalAmount) || 0,
        notes: invoice.notes,
        terms: invoice.terms,
        isGstInvoice: invoice.is_gst_invoice || invoice.isGstInvoice || false,
      })

      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this invoice?")) return

    setIsLoading(true)
    try {
      // Use API route for deletion
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete invoice")
      }

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      })

      router.push("/invoices")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete invoice",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownloadPDF}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => {
          await handleDownloadPDF()
          setTimeout(() => window.print(), 500)
        }}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
