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
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  role: string
  salary: number
  joining_date: string
  is_active: boolean
  employee_id?: string
  password?: string
  store_id?: string
  stores?: {
    name: string
    store_code: string
  }
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin } = useUserRole()
  const isExcel = getDatabaseType() === 'excel'
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    fetchEmployee()
  }, [params.id, isAdmin, router])

  const fetchEmployee = async () => {
    try {
      setIsLoading(true)
      if (isExcel) {
        const emp = await db.employees.get(params.id as string)
        if (!emp) {
          toast({ title: "Error", description: "Employee not found", variant: "destructive" })
          router.push("/employees")
          return
        }
        setEmployee(emp as any)
        
        // Fetch invoices created by this employee
        const empInvoices = await db.invoices
          .where("created_by_employee_id").equals(emp.employee_id || "")
          .toArray()
        setInvoices(empInvoices as any)
      } else {
        const supabase = createClient()
        const { data: emp, error } = await supabase
          .from("employees")
          .select("*, stores(name, store_code)")
          .eq("id", params.id)
          .single()
        
        if (error || !emp) {
          toast({ title: "Error", description: "Employee not found", variant: "destructive" })
          router.push("/employees")
          return
        }
        setEmployee(emp as any)
        
        // Fetch invoices created by this employee
        const { data: empInvoices } = await supabase
          .from("invoices")
          .select("*, customers(name)")
          .eq("created_by_employee_id", emp.employee_id || "")
          .order("created_at", { ascending: false })
        setInvoices(empInvoices || [])
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load employee", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!employee) return
    const newPassword = employee.employee_id || employee.id.slice(0, 4).toUpperCase()
    
    if (!confirm(`Reset password for ${employee.name} to ${newPassword}?`)) return
    
    try {
      if (isExcel) {
        await db.employees.update(employee.id, { password: newPassword })
        setEmployee({ ...employee, password: newPassword })
        toast({ title: "Success", description: `Password reset to ${newPassword}` })
      } else {
        const supabase = createClient()
        const { error } = await supabase
          .from("employees")
          .update({ password: newPassword })
          .eq("id", employee.id)
        
        if (error) throw error
        setEmployee({ ...employee, password: newPassword })
        toast({ title: "Success", description: `Password reset to ${newPassword}` })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" })
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!employee) {
    return <div className="text-center py-8">Employee not found</div>
  }

  const totalInvoices = invoices.length
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{employee.name}</h1>
            <p className="text-muted-foreground">Employee Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePasswordReset}>
            <Key className="mr-2 h-4 w-4" />
            Reset Password
          </Button>
          <Button asChild>
            <Link href={`/employees/${employee.id}/edit`}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Employee Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium w-24">Employee ID:</span>
                <span className="font-mono font-semibold">{employee.employee_id || "N/A"}</span>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Email</span>
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Phone</span>
                  <p className="text-sm text-muted-foreground">{employee.phone || "N/A"}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Store</span>
                  <p className="text-sm text-muted-foreground">
                    {employee.stores ? `${employee.stores.name} (${employee.stores.store_code})` : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={employee.is_active ? "default" : "secondary"}>
                  {employee.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{employee.role}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Salary</span>
                  <p className="text-lg font-semibold">₹{employee.salary?.toLocaleString() || "N/A"}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Joining Date</span>
                  <p className="text-sm text-muted-foreground">
                    {new Date(employee.joining_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Key className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Password</span>
                  <p className="font-mono text-sm">{employee.password || employee.employee_id || "N/A"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{totalInvoices}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg per Invoice</p>
              <p className="text-2xl font-bold">
                ₹{totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices).toLocaleString() : 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={employee.is_active ? "default" : "secondary"}>
                {employee.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.slice(0, 10).map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customers?.name || inv.customer_id}</TableCell>
                      <TableCell>{new Date(inv.invoice_date || inv.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{inv.total_amount?.toLocaleString() || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

