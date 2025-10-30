"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Receipt, Users, Package, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { autoLoadExcelFromPublic, excelSheetManager } from '@/lib/utils/excel-sync-controller';
import { createClient } from '@/lib/supabase/client';

// Add this for now. Replace with a real config or store later.
const getDatabaseType = () => typeof window !== 'undefined' && window.localStorage.getItem('databaseType') === 'supabase' ? 'supabase' : 'excel';

export default function DashboardPage() {
  // For Excel data
  const [excelStats, setExcelStats] = useState<any>(null);
  // For Supabase data
  const [sbStats, setSbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const dbType = getDatabaseType();

  useEffect(() => {
    if (dbType === 'excel') {
      autoLoadExcelFromPublic().then(() => {
        const products = excelSheetManager.getList('products') || [];
        const customers = excelSheetManager.getList('customers') || [];
        const invoices = excelSheetManager.getList('invoices') || [];
        // Simple stats for demo
        setExcelStats({
          totalRevenue: invoices.reduce((s, i) => s + Number(i.total || i.total_amount || 0), 0),
          productsCount: products.length,
          customersCount: customers.length,
          invoicesCount: invoices.length,
          recentInvoices: invoices.slice(-5).reverse(),
          lowStockProducts: products.filter(p => (p.stock_quantity !== undefined && p.stock_quantity <= 10)),
        });
        setLoading(false);
      }).catch(() => { setLoading(false); });
    } else if (dbType === 'supabase') {
      (async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const { count: productsCount } = await supabase
          .from("products").select("*", { count: "exact", head: true }).eq("user_id", user?.id);
        const { count: customersCount } = await supabase
          .from("customers").select("*", { count: "exact", head: true }).eq("user_id", user?.id);
        const { count: invoicesCount } = await supabase
          .from("invoices").select("*", { count: "exact", head: true }).eq("user_id", user?.id);
        const { data: invoices } = await supabase
          .from("invoices").select("total_amount").eq("user_id", user?.id).eq("status", "paid");
        const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
        const { data: recentInvoices } = await supabase
          .from("invoices").select("id, invoice_number, total_amount, status, created_at, customers(name)")
            .eq("user_id", user?.id).order("created_at", { ascending: false }).limit(5);
        const { data: lowStockProducts } = await supabase
          .from("products").select("id, name, stock_quantity").eq("user_id", user?.id).lte("stock_quantity", 10).limit(5);
        setSbStats({
          totalRevenue, productsCount, customersCount, invoicesCount, recentInvoices, lowStockProducts
        });
        setLoading(false);
      })();
    }
    // eslint-disable-next-line
  }, [dbType]);

  const stats = dbType === 'supabase' ? sbStats : excelStats;
  if (loading || !stats) return <div>Loading...</div>;

  // Use stats variable everywhere below
  const {
    totalRevenue = 0,
    invoicesCount = 0,
    productsCount = 0,
    customersCount = 0,
    recentInvoices = [],
    lowStockProducts = [],
  } = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your business.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoicesCount || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersCount || 0}</div>
            <p className="text-xs text-muted-foreground">Active customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsCount || 0}</div>
            <p className="text-xs text-muted-foreground">In inventory</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices && recentInvoices.length > 0 ? (
              <div className="space-y-4">
                {recentInvoices.map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{invoice.invoice_number || invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customers ? (invoice.customers as any).name : "No customer"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₹{Number(invoice.total_amount || invoice.total).toLocaleString("en-IN")}</p>
                      <p className="text-sm text-muted-foreground capitalize">{invoice.status || "n/a"}</p>
                    </div>
                  </div>
                ))}
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/invoices">View All Invoices</Link>
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No invoices yet</p>
                <Button asChild className="mt-4">
                  <Link href="/invoices/new">Create Your First Invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-4">
                {lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <p className="font-medium">{product.name}</p>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                      {product.stock_quantity} left
                    </span>
                  </div>
                ))}
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/products">Manage Products</Link>
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>All products are well stocked</p>
                <Button asChild className="mt-4 bg-transparent" variant="outline">
                  <Link href="/products">View Products</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="h-auto flex-col gap-2 py-4">
              <Link href="/invoices/new">
                <Receipt className="h-6 w-6" />
                <span>Create Invoice</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4 bg-transparent">
              <Link href="/products/new">
                <Package className="h-6 w-6" />
                <span>Add Product</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4 bg-transparent">
              <Link href="/customers/new">
                <Users className="h-6 w-6" />
                <span>Add Customer</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4 bg-transparent">
              <Link href="/reports">
                <TrendingUp className="h-6 w-6" />
                <span>View Reports</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
