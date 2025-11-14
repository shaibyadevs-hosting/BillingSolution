"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CustomerForm } from "@/components/features/customers/customer-form"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"

export default function EditCustomerPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [customer, setCustomer] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCustomer()
  }, [params.id])

  const fetchCustomer = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({ title: "Error", description: "Please log in to continue", variant: "destructive" })
        router.push("/login")
        return
      }

      const { data: cust, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single()

      if (error || !cust) {
        // Try to load from local IndexedDB
        const localCust = await db.customers?.get?.(params.id as string)
        if (!localCust) {
          toast({ title: "Error", description: "Customer not found", variant: "destructive" })
          router.push("/customers")
          return
        }
        setCustomer(localCust)
      } else {
        setCustomer(cust)
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load customer", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Edit Customer</h1>
        <p className="text-muted-foreground">Update customer information</p>
      </div>

      <CustomerForm customer={customer} />
    </div>
  )
}

