"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { InvoiceForm } from "@/components/features/invoices/invoice-form"
import { useInvoice } from "@/lib/hooks/use-cached-data"
import { useCustomers, useProducts, useStoreSettings } from "@/lib/hooks/use-cached-data"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore } from "@/lib/utils/store-context"

export default function InvoiceEditPageClient() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const { currentStore } = useStore()
  const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole()
  
  const { data: invoiceData, isLoading: invoiceLoading } = useInvoice(invoiceId)
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: settings, isLoading: settingsLoading } = useStoreSettings()

  useEffect(() => {
    if (roleLoading) return
    
    if (!isAdmin && !isEmployee) {
      router.push("/dashboard")
      return
    }
  }, [isAdmin, isEmployee, roleLoading, router])

  if (roleLoading || invoiceLoading || customersLoading || productsLoading || settingsLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!invoiceData) {
    return (
      <div className="p-6">
        <p className="text-destructive">Invoice not found</p>
      </div>
    )
  }

  // Extract employee ID from invoice or session
  let employeeId: string | undefined
  const authType = typeof window !== 'undefined' ? localStorage.getItem("authType") : null
  if (authType === "employee") {
    const empSession = typeof window !== 'undefined' ? localStorage.getItem("employeeSession") : null
    if (empSession) {
      try {
        const session = JSON.parse(empSession)
        employeeId = session.employeeId || invoiceData.employee_id || invoiceData.created_by_employee_id
      } catch (e) {
        console.warn("[InvoiceEdit] Error parsing employee session:", e)
      }
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <InvoiceForm
        customers={customers}
        products={products}
        settings={settings}
        storeId={currentStore?.id || invoiceData.store_id || undefined}
        employeeId={employeeId}
        invoice={invoiceData}
      />
    </div>
  )
}
