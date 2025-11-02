"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { generateInvoicePDF } from "@/lib/utils/pdf-generator"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

interface InvoicePrintProps {
  invoiceId: string
  invoiceNumber: string
  invoiceData?: any // Optional: pass invoice data if already loaded
}

export function InvoicePrint({ invoiceId, invoiceNumber, invoiceData }: InvoicePrintProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const handlePrint = async () => {
    setIsGenerating(true)
    try {
      console.log("[InvoicePrint] Starting print process:", { invoiceId, invoiceNumber, hasInvoiceData: !!invoiceData })

      let invoice: any = null
      let items: any[] = []
      let customer: any = null
      let profile: any = null

      // If invoice data is already provided, use it (avoid API call)
      if (invoiceData) {
        console.log("[InvoicePrint] Using provided invoice data")
        invoice = invoiceData
        items = invoice.invoice_items || invoice.items || []
        customer = invoice.customers || invoice.customer || null
        profile = invoice.profile || null
        
        // Transform items to match PDF generator format (snake_case to camelCase)
        items = items.map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price || item.unitPrice) || 0,
          discountPercent: Number(item.discount_percent || item.discountPercent) || 0,
          gstRate: Number(item.gst_rate || item.gstRate) || 0,
          lineTotal: Number(item.line_total || item.lineTotal) || 0,
          gstAmount: Number(item.gst_amount || item.gstAmount) || 0,
        }))
        
        console.log("[InvoicePrint] Invoice data from props:", {
          invoiceNumber: invoice.invoice_number,
          itemsCount: items.length,
          hasCustomer: !!customer,
          hasProfile: !!profile,
          firstItem: items[0] ? {
            unitPrice: items[0].unitPrice,
            lineTotal: items[0].lineTotal,
            gstAmount: items[0].gstAmount
          } : null
        })
      } else {
        // Fallback: Fetch from API if data not provided
        console.log("[InvoicePrint] Fetching invoice from API (fallback)")
        
        // Determine if this is an employee session
        const authType = localStorage.getItem("authType")
        let apiUrl = `/api/invoices/${invoiceId}`
        
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            const session = JSON.parse(employeeSession)
            apiUrl += `?store_id=${encodeURIComponent(session.storeId)}`
            console.log("[InvoicePrint] Employee session detected, adding store_id:", session.storeId)
          }
        }

        console.log("[InvoicePrint] Fetching invoice from API:", apiUrl)

        // Fetch invoice data via API route
        const response = await fetch(apiUrl)
        const data = await response.json()

        console.log("[InvoicePrint] API response:", {
          ok: response.ok,
          status: response.status,
          hasInvoice: !!data.invoice,
          hasProfile: !!data.profile,
          error: data.error,
          invoiceItems: data.invoice?.invoice_items?.length || 0,
          hasCustomer: !!data.invoice?.customers
        })

        if (!response.ok || !data.invoice) {
          const errorMsg = data.error || data.hint || "Failed to fetch invoice"
          console.error("[InvoicePrint] API error:", {
            status: response.status,
            error: errorMsg,
            debug: data.debug
          })
          throw new Error(errorMsg)
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

      console.log("[InvoicePrint] Invoice data prepared:", {
        invoiceNumber: invoice.invoice_number,
        itemsCount: items.length,
        hasCustomer: !!customer,
        hasProfile: !!profile,
        customerName: customer?.name,
        businessName: profile?.business_name,
        firstItemSample: items[0] ? {
          unitPrice: items[0].unitPrice,
          lineTotal: items[0].lineTotal,
          gstAmount: items[0].gstAmount
        } : null
      })

      // Validate required data
      if (!items || items.length === 0) {
        console.warn("[InvoicePrint] Warning: No items found for invoice")
      }

      // Validate items have required numeric fields
      const invalidItems = items.filter((item: any) => 
        item.unitPrice === undefined || item.lineTotal === undefined
      )
      if (invalidItems.length > 0) {
        console.error("[InvoicePrint] Invalid items found:", invalidItems)
      }

      // Generate PDF
      console.log("[InvoicePrint] Generating PDF...")
      try {
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
        console.log("[InvoicePrint] PDF generated successfully")
      } catch (pdfError: any) {
        console.error("[InvoicePrint] PDF generation error:", pdfError)
        throw new Error(`PDF generation failed: ${pdfError?.message || pdfError}`)
      }

      toast({
        title: "Success",
        description: "Invoice PDF generated. Opening print dialog...",
      })

      // Trigger print dialog after a short delay
      setTimeout(() => {
        console.log("[InvoicePrint] Opening print dialog...")
        window.print()
      }, 500)
    } catch (error: any) {
      console.error("[InvoicePrint] Print process error:", {
        error: error,
        message: error?.message,
        stack: error?.stack
      })
      toast({
        title: "Error",
        description: error?.message || "Failed to generate invoice PDF. Check console for details.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button 
      onClick={handlePrint} 
      variant="outline" 
      disabled={isGenerating}
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      {isGenerating ? "Generating..." : "Print Invoice"}
    </Button>
  )
}

