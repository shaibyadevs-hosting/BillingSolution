"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Edit2, Key, DollarSign, Calendar, Mail, Phone, Building2, UserCircle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Employee {
  id: string
  name: string
  email: string
  phone?: string
  employee_id: string
  role: string
  store_id?: string
  store?: { name: string; store_code: string }
  created_at?: string
  is_active?: boolean
}

export default function EmployeeDetailPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/employees")
      return
    }
    fetchEmployee()
    fetchInvoices()
  }, [params.id, isAdmin, roleLoading, router])

  const fetchEmployee = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      const { data: emp, error } = await supabase
        .from("employees")
        .select("*, stores(name, store_code)")
        .eq("id", params.id)
        .single()
      
      if (error || !emp) {
        const localEmp = await db.employees?.get?.(params.id as string)
        if (!localEmp) {
          toast({ title: "Error", description: "Employee not found", variant: "destructive" })
          router.push("/employees")
          return
        }
        setEmployee(localEmp as Employee)
      } else {
        setEmployee(emp as Employee)
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load employee", variant: "destructive" })
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
        .eq("employee_id", params.id)
        .order("created_at", { ascending: false })
        .limit(10)
      
      if (!error && invs) {
        setInvoices(invs)
      } else {
        // Try Dexie
        const localInvs = await db.invoices?.where("employee_id").equals(params.id as string).toArray()
        if (localInvs) {
          setInvoices(localInvs)
        }
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error)
    }
  }

  if (roleLoading || isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!employee) {
    return <div className="text-center py-8">Employee not found</div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/employees")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
        {isAdmin && (
          <Link href={`/employees/${employee.id}/edit`}>
            <Button variant="outline" className="gap-2">
              <Edit2 className="h-4 w-4" />
              Edit Employee
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <UserCircle className="h-6 w-6" />
              {employee.name}
            </CardTitle>
            <Badge variant={employee.is_active !== false ? "default" : "secondary"}>
              {employee.is_active !== false ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="h-4 w-4" />
                Employee ID
              </div>
              <p className="font-medium">{employee.employee_id}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <p className="font-medium">{employee.email || "N/A"}</p>
            </div>
            {employee.phone && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p className="font-medium">{employee.phone}</p>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Role
              </div>
              <Badge variant="outline">{employee.role || "Employee"}</Badge>
            </div>
            {employee.store && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Store
                </div>
                <p className="font-medium">{employee.store.name} ({employee.store.store_code})</p>
              </div>
            )}
            {employee.created_at && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Created
                </div>
                <p className="font-medium">
                  {new Date(employee.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Recent Invoices ({invoices.length})
            </h3>
            {invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>₹{inv.total_amount?.toFixed(2) || "0.00"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No invoices found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

