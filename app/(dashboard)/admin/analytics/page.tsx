"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useUserRole } from "@/lib/hooks/use-user-role"

interface AnalyticsData {
  totalRevenue: number
  totalInvoices: number
  averageOrderValue: number
  totalCustomers: number
  monthlySales: Array<{ month: string; sales: number }>
  topProducts: Array<{ name: string; revenue: number }>
  employeeSales: Array<{ name: string; sales: number }>
  invoiceStatus: Array<{ status: string; count: number }>
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()
  const { isAdmin, isLoading: roleLoading } = useUserRole()
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    // Role guard
    if (!roleLoading && !isAdmin) {
      router.replace("/dashboard")
      return
    }
    if (isAdmin && !roleLoading) {
      fetchAnalytics()
    }
  }, [isAdmin, roleLoading, router])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      let invoices: any[] = []
      let customers: any[] = []

      if (isExcel) {
        // Excel mode - fetch from Dexie
        invoices = await db.invoices.toArray()
        customers = await db.customers.toArray()
      } else {
        // Supabase mode
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const [{ data: invData }, { data: custData }] = await Promise.all([
          supabase.from("invoices").select("*").eq("user_id", user.id),
          supabase.from("customers").select("*").eq("user_id", user.id),
        ])

        invoices = invData || []
        customers = custData || []
      }

      // Calculate metrics
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || inv.total || 0), 0) || 0
      const totalInvoices = invoices?.length || 0
      const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0
      const totalCustomers = customers?.length || 0

      // Monthly sales
      const monthlySales = getMonthlySales(invoices || [])

      // Invoice status breakdown
      const invoiceStatus = [
        { status: "Draft", count: invoices?.filter((i) => i.status === "draft").length || 0 },
        { status: "Sent", count: invoices?.filter((i) => i.status === "sent").length || 0 },
        { status: "Paid", count: invoices?.filter((i) => i.status === "paid").length || 0 },
        { status: "Cancelled", count: invoices?.filter((i) => i.status === "cancelled").length || 0 },
      ]

      setAnalytics({
        totalRevenue,
        totalInvoices,
        averageOrderValue,
        totalCustomers,
        monthlySales,
        topProducts: [],
        employeeSales: [],
        invoiceStatus,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analytics",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getMonthlySales = (invoices: any[]) => {
    const months: Record<string, number> = {}
    invoices.forEach((inv) => {
      const date = inv.invoice_date || inv.created_at || new Date().toISOString()
      const month = new Date(date).toLocaleString("default", { month: "short" })
      const amount = Number(inv.total_amount || inv.total || 0)
      months[month] = (months[month] || 0) + amount
    })
    return Object.entries(months).map(([month, sales]) => ({ month, sales }))
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="text-center py-8">No data available</div>
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Business performance and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.averageOrderValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Per invoice</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.invoiceStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.invoiceStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
