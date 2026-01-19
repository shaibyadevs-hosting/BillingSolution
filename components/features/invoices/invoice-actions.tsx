"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Download, Edit2, Trash2, Printer, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { executeInvoiceAction } from "@/lib/invoice-document-engine"

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
      // Prepare source data if provided
      const source = invoiceData
        ? {
            invoice: invoiceData,
            items: invoiceData.invoice_items || invoiceData.items || [],
            customer: invoiceData.customers || invoiceData.customer || null,
            profile: invoiceData.profile || null,
          }
        : undefined

      // Use unified document engine
      await executeInvoiceAction({
        invoiceId,
        action: "download",
        format: "invoice",
        source,
      })

      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearPayment = async () => {
    if (!confirm("Are you sure you want to clear the payment status? This will change the invoice status to 'draft'.")) return

    setIsLoading(true)
    try {
      const { isIndexedDbMode } = await import("@/lib/utils/db-mode")
      const isIndexedDb = isIndexedDbMode()

      if (isIndexedDb) {
        // Update in IndexedDB
        const { db } = await import("@/lib/dexie-client")
        const invoice = await db.invoices.get(invoiceId)
        if (invoice) {
          await db.invoices.update(invoiceId, {
            status: "draft",
            updated_at: new Date().toISOString(),
          })
        }
      } else {
        // Update in Supabase
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        const { error } = await supabase
          .from("invoices")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
        
        if (error) throw error
      }

      toast({
        title: "Success",
        description: "Payment status cleared. Invoice status changed to 'draft'.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to clear payment status",
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
      const { isIndexedDbMode } = await import("@/lib/utils/db-mode")
      const isIndexedDb = isIndexedDbMode()

      if (isIndexedDb) {
        // Delete from IndexedDB
        const { storageManager } = await import("@/lib/storage-manager")
        await storageManager.deleteInvoice(invoiceId)
      } else {
        // Delete from Supabase
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        // Delete invoice items first (foreign key constraint)
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoiceId)
        
        if (itemsError) throw itemsError

        // Delete invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
        
        if (invoiceError) throw invoiceError
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
          setIsLoading(true)
          try {
            const source = invoiceData
              ? {
                  invoice: invoiceData,
                  items: invoiceData.invoice_items || invoiceData.items || [],
                  customer: invoiceData.customers || invoiceData.customer || null,
                  profile: invoiceData.profile || null,
                }
              : undefined
            await executeInvoiceAction({
              invoiceId,
              action: "print",
              format: "invoice",
              source,
            })
          } catch (error: any) {
            toast({
              title: "Error",
              description: error?.message || "Failed to print PDF",
              variant: "destructive",
            })
          } finally {
            setIsLoading(false)
          }
        }}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {invoiceData?.status === "paid" && (
          <DropdownMenuItem onClick={handleClearPayment}>
            <XCircle className="mr-2 h-4 w-4" />
            Clear Payment Status
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
