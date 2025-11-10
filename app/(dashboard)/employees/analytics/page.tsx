"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, DollarSign, FileText, Users } from "lucide-react"
import Link from "next/link"

interface EmployeeStats {
  id: string
  name: string
  employee_id: string
  invoiceCount: number
  totalRevenue: number
  avgInvoiceValue: number
  lastInvoiceDate: string | null
  is_active: boolean
}

export default function EmployeeAnalyticsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const [employees, setEmployees] = useState<EmployeeStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [overallStats, setOverallStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalInvoices: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/dashboard")
      return
    }
    fetchAnalytics()
  }, [isAdmin, roleLoading, router])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      let employeeStats: EmployeeStats[] = []

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user")

        // Fetch employees
        const { data: employeesData } = await supabase
          .from("employees")
          .select("*")
          .eq("user_id", user.id)

        if (!employeesData) {
          setEmployees([])
          setIsLoading(false)
          return
        }

        // Fetch all invoices
        const { data: invoicesData } = await supabase
          .from("invoices")
          .select("*")
          .eq("user_id", user.id)

        employeeStats = (employeesData || []).map((emp) => {
          const empInvoices = (invoicesData || []).filter(
            (inv) => inv.created_by_employee_id === emp.employee_id || inv.employee_id === emp.employee_id
          )
          const revenue = empInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
          const latestInvoice = empInvoices.sort(
            (a, b) => new Date(b.invoice_date || b.created_at).getTime() - new Date(a.invoice_date || a.created_at).getTime()
          )[0]

          return {
            id: emp.id,
            name: emp.name,
            employee_id: emp.employee_id || "N/A",
            invoiceCount: empInvoices.length,
            totalRevenue: revenue,
            avgInvoiceValue: empInvoices.length > 0 ? revenue / empInvoices.length : 0,
            lastInvoiceDate: latestInvoice ? (latestInvoice.invoice_date || latestInvoice.created_at) : null,
            is_active: emp.is_active,
          }
        })

        setOverallStats({
          totalEmployees: employeesData.length,
          activeEmployees: employeesData.filter((e) => e.is_active).length,
          totalInvoices: invoicesData?.length || 0,
          totalRevenue: (invoicesData || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
        })
      } catch {
        // Fallback to local IndexedDB
        const allEmployees = await db.employees.toArray()
        const allInvoices = await db.invoices.toArray()
        employeeStats = allEmployees.map((emp: any) => {
          const empInvoices = allInvoices.filter(
            (inv: any) => inv.created_by_employee_id === emp.employee_id || inv.employee_id === emp.employee_id
          )
          const revenue = empInvoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0)
          const latestInvoice = empInvoices.sort(
            (a: any, b: any) => new Date(b.invoice_date || b.created_at).getTime() - new Date(a.invoice_date || a.created_at).getTime()
          )[0]
          return {
            id: emp.id,
            name: emp.name,
            employee_id: emp.employee_id || "N/A",
            invoiceCount: empInvoices.length,
            totalRevenue: revenue,
            avgInvoiceValue: empInvoices.length > 0 ? revenue / empInvoices.length : 0,
            lastInvoiceDate: latestInvoice ? (latestInvoice.invoice_date || latestInvoice.created_at) : null,
            is_active: emp.is_active,
          }
        })
        setOverallStats({
          totalEmployees: allEmployees.length,
          activeEmployees: allEmployees.filter((e: any) => e.is_active).length,
          totalInvoices: allInvoices.length,
          totalRevenue: allInvoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0),
        })
      }

      // Sort by revenue descending
      employeeStats.sort((a, b) => b.totalRevenue - a.totalRevenue)
      setEmployees(employeeStats)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  if (roleLoading || isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Employee Performance Analytics</h1>
        <p className="text-muted-foreground">Track employee productivity and performance metrics</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">{overallStats.activeEmployees} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">All employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{overallStats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg per Employee</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{overallStats.totalEmployees > 0 ? Math.round(overallStats.totalRevenue / overallStats.totalEmployees).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">Revenue average</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Employee Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Avg/Invoice</TableHead>
                    <TableHead>Last Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="font-mono text-sm">{emp.employee_id}</TableCell>
                      <TableCell className="text-right">{emp.invoiceCount}</TableCell>
                      <TableCell className="text-right font-semibold">₹{emp.totalRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{Math.round(emp.avgInvoiceValue).toLocaleString()}</TableCell>
                      <TableCell>
                        {emp.lastInvoiceDate
                          ? new Date(emp.lastInvoiceDate).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/employees/${emp.id}`} className="text-sm text-primary hover:underline">
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

