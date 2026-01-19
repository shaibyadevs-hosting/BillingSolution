"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
    // Wait for role to be determined
    if (roleLoading) {
      return
    }
    
    // Only admin can access this page
    if (!isAdmin) {
      router.push("/dashboard")
      return
    }
    
    // Only fetch analytics if we're an admin
    if (isAdmin) {
      fetchAnalytics()
    }
  }, [isAdmin, roleLoading, router])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      let employeeStats: EmployeeStats[] = []
      const dbType = getDatabaseType()

      if (dbType === 'supabase') {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            console.warn("[EmployeeAnalytics] No user found, using IndexedDB fallback")
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
          } else {
            // Get admin_user_id (for both admin and employee views)
            const authType = localStorage.getItem("authType")
            let adminUserId: string | null = null
            let storeIds: string[] = []

            if (authType === "employee") {
              // For employees, get admin_user_id from store
              const empSession = localStorage.getItem("employeeSession")
              if (empSession) {
                try {
                  const session = JSON.parse(empSession)
                  const storeId = session.storeId || localStorage.getItem("currentStoreId")
                  if (storeId) {
                    const { data: store } = await supabase
                      .from("stores")
                      .select("admin_user_id")
                      .eq("id", storeId)
                      .single()
                    if (store?.admin_user_id) {
                      adminUserId = store.admin_user_id
                      storeIds = [storeId]
                    }
                  }
                } catch (e) {
                  console.warn("[EmployeeAnalytics] Error parsing employee session:", e)
                }
              }
            } else {
              // For admin, use their own user_id and get all their stores
              adminUserId = user.id
              const { data: stores } = await supabase
                .from("stores")
                .select("id")
                .eq("admin_user_id", user.id)
              storeIds = stores?.map(s => s.id) || []
            }

            if (!adminUserId) {
              setEmployees([])
              setOverallStats({
                totalEmployees: 0,
                activeEmployees: 0,
                totalInvoices: 0,
                totalRevenue: 0,
              })
              setIsLoading(false)
              return
            }

            // Fetch employees for this admin (from all stores)
            let employeesQuery = supabase
              .from("employees")
              .select("*")
            
            if (storeIds.length > 0) {
              employeesQuery = employeesQuery.in("store_id", storeIds)
            } else {
              // If no stores, try to get employees by checking stores with this admin_user_id
              const { data: allStores } = await supabase
                .from("stores")
                .select("id")
                .eq("admin_user_id", adminUserId)
              const allStoreIds = allStores?.map(s => s.id) || []
              if (allStoreIds.length > 0) {
                employeesQuery = employeesQuery.in("store_id", allStoreIds)
              } else {
                employeesQuery = employeesQuery.eq("store_id", "00000000-0000-0000-0000-000000000000") // No results
              }
            }

            const { data: employeesData } = await employeesQuery

            if (!employeesData || employeesData.length === 0) {
              setEmployees([])
              setOverallStats({
                totalEmployees: 0,
                activeEmployees: 0,
                totalInvoices: 0,
                totalRevenue: 0,
              })
              setIsLoading(false)
              return
            }

            // Get all stores for this admin if not already fetched
            let allStoreIds = storeIds
            if (allStoreIds.length === 0) {
              const { data: allStores } = await supabase
                .from("stores")
                .select("id")
                .eq("admin_user_id", adminUserId)
              allStoreIds = allStores?.map(s => s.id) || []
            }

            // Fetch all invoices for this admin (includes employee-created invoices)
            // Invoices where user_id = admin_user_id AND (store_id IN storeIds OR store_id IS NULL)
            let invoicesQuery = supabase
              .from("invoices")
              .select("*")
              .eq("user_id", adminUserId)
            
            if (allStoreIds.length > 0) {
              invoicesQuery = invoicesQuery.or(`store_id.is.null,store_id.in.(${allStoreIds.join(',')})`)
            }

            const { data: invoicesData } = await invoicesQuery

            employeeStats = (employeesData || []).map((emp) => {
              const empInvoices = (invoicesData || []).filter(
                (inv) => inv.created_by_employee_id === emp.employee_id || inv.employee_id === emp.employee_id
              )
              const revenue = empInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
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
              totalRevenue: (invoicesData || []).reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
            })
          }
        } catch (error) {
          console.error("[EmployeeAnalytics] Supabase error, falling back to IndexedDB:", error)
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
      } else {
        // IndexedDB mode
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
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Employee Performance Analytics</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Track employee productivity and performance metrics</p>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xl md:text-2xl font-bold truncate cursor-help">
                  ₹{overallStats.totalRevenue.toLocaleString()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total Revenue: ₹{overallStats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground">Combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg per Employee</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xl md:text-2xl font-bold truncate cursor-help">
                  ₹{overallStats.totalEmployees > 0 ? Math.round(overallStats.totalRevenue / overallStats.totalEmployees).toLocaleString() : 0}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Average per Employee: ₹{overallStats.totalEmployees > 0 ? (overallStats.totalRevenue / overallStats.totalEmployees).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 0}</p>
              </TooltipContent>
            </Tooltip>
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
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Employee</TableHead>
                      <TableHead className="min-w-[100px]">ID</TableHead>
                      <TableHead className="text-right min-w-[100px]">Invoices</TableHead>
                      <TableHead className="text-right min-w-[130px]">Total Revenue</TableHead>
                      <TableHead className="text-right min-w-[110px]">Avg/Invoice</TableHead>
                      <TableHead className="min-w-[120px]">Last Invoice</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[150px] cursor-help">{emp.name}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{emp.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[100px] cursor-help">{emp.employee_id}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Employee ID: {emp.employee_id}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{emp.invoiceCount}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{emp.invoiceCount} invoice{emp.invoiceCount !== 1 ? 's' : ''} created</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[130px] cursor-help">₹{emp.totalRevenue.toLocaleString()}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total Revenue: ₹{emp.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[110px] cursor-help">₹{Math.round(emp.avgInvoiceValue).toLocaleString()}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Average per Invoice: ₹{emp.avgInvoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block max-w-[120px] cursor-help">
                                {emp.lastInvoiceDate
                                  ? new Date(emp.lastInvoiceDate).toLocaleDateString()
                                  : "Never"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {emp.lastInvoiceDate
                                  ? `Last invoice: ${new Date(emp.lastInvoiceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`
                                  : "No invoices created yet"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

