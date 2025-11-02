"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { getCustomerSession } from "@/lib/utils/customer-auth"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"

export default function CustomerDashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<any>(null)
  const router = useRouter()
  const session = getCustomerSession()
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    if (!session) {
      router.push("/auth/customer-login")
      return
    }

    (async () => {
      try {
        setLoading(true)
        
        // Get customer info
        if (isExcel) {
          const cust = await db.customers.get(session.customerId)
          setCustomer(cust)
          
          // Get invoices for this customer
          const invs = await db.invoices.where("customer_id").equals(session.customerId).toArray()
          setInvoices(invs || [])
        } else {
          const supabase = createClient()
          const { data: cust } = await supabase
            .from("customers")
            .select("*")
            .eq("id", session.customerId)
            .single()
          setCustomer(cust)

          const { data: invs } = await supabase
            .from("invoices")
            .select("*")
            .eq("customer_id", session.customerId)
            .order("created_at", { ascending: false })
          setInvoices(invs || [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    })()
  }, [session, isExcel, router])

  if (!session) return null
  if (loading) return <div className="p-6">Loading...</div>

  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
  const paidAmount = invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">My Purchases</h1>
        <p className="text-sm md:text-base text-muted-foreground">Welcome, {customer?.name || session.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalAmount.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{paidAmount.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">
              {invoices.filter(inv => inv.status === "paid").length} paid invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices found</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                            inv.status === "paid" ? "bg-green-100 text-green-800" :
                            inv.status === "sent" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {inv.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">₹{Number(inv.total_amount || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/invoices/${inv.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">View</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

