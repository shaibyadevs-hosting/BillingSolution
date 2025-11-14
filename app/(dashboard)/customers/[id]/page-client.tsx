"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Mail, Phone, MapPin, FileText, Receipt } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"

export default function CustomerDetailPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCustomer()
    fetchInvoices()
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

  const fetchInvoices = async () => {
    try {
      const supabase = createClient()
      const { data: invs, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false })

      if (!error && invs) {
        setInvoices(invs)
      } else {
        // Try Dexie
        const localInvs = await db.invoices?.where("customer_id").equals(params.id as string).toArray()
        if (localInvs) {
          setInvoices(localInvs)
        }
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
  }

  const totalInvoices = invoices?.length || 0
  const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0
  const paidInvoices = invoices?.filter((inv) => inv.status === "paid").length || 0

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">Customer Details</p>
        </div>
        <Button asChild>
          <Link href={`/customers/${params.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Customer
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
              </div>
            )}

            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              </div>
            )}

            {customer.gstin && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">GSTIN</p>
                  <p className="text-sm text-muted-foreground">{customer.gstin}</p>
                </div>
              </div>
            )}

            {customer.billing_address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Billing Address</p>
                  <p className="text-sm text-muted-foreground">{customer.billing_address}</p>
                </div>
              </div>
            )}

            {customer.shipping_address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Shipping Address</p>
                  <p className="text-sm text-muted-foreground">{customer.shipping_address}</p>
                </div>
              </div>
            )}

            {customer.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">{customer.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="space-y-4">
                {invoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.invoice_date
                          ? new Date(invoice.invoice_date).toLocaleDateString()
                          : invoice.created_at
                            ? new Date(invoice.created_at).toLocaleDateString()
                            : "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₹{Number(invoice.total_amount || 0).toLocaleString("en-IN")}</p>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "default" : invoice.status === "sent" ? "secondary" : "outline"
                        }
                        className="capitalize"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {invoices.length > 5 && (
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href={`/invoices?customer=${params.id}`}>View All Invoices</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No invoices yet</p>
                <Button asChild className="mt-4">
                  <Link href={`/invoices/new?customer=${params.id}`}>Create Invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

