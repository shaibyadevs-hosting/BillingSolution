"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Receipt, Users, Package, TrendingUp, AlertCircle, UserCog, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from 'react';
import { db } from '@/lib/dexie-client';
import { createClient } from '@/lib/supabase/client';
import { getDatabaseType } from '@/lib/utils/db-mode';
import { useUserRole } from '@/lib/hooks/use-user-role';

export default function DashboardPage() {
  const [localStats, setLocalStats] = useState<any>(null);
  const [sbStats, setSbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole();
  const dbType = getDatabaseType();

  useEffect(() => {
    // Local (IndexedDB) mode
    if (dbType !== 'supabase') {
      (async () => {
        try {
          setLoading(true);
          const [products, customers, invoices] = await Promise.all([
            db.products.toArray(),
            db.customers.toArray(),
            db.invoices.toArray(),
          ]);
          setLocalStats({
            totalRevenue: (invoices || []).reduce((s: number, i: any)=> s + Number(i.total_amount || i.total || 0), 0),
            productsCount: products?.length || 0,
            customersCount: customers?.length || 0,
            invoicesCount: invoices?.length || 0,
            recentInvoices: (invoices || []).slice(-5).reverse(),
            lowStockProducts: (products || []).filter((p: any)=> p.stock_quantity !== undefined && Number(p.stock_quantity) <= 10),
          });
        } finally {
          setLoading(false);
        }
      })();
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
        setSbStats({ totalRevenue, productsCount, customersCount, invoicesCount, recentInvoices, lowStockProducts });
        setLoading(false);
      })();
    }
  }, [dbType]);

  const stats = dbType === 'supabase' ? sbStats : localStats;
  
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { totalRevenue = 0, invoicesCount = 0, productsCount = 0, customersCount = 0, recentInvoices = [], lowStockProducts = [] } = stats;

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-6 py-4 md:py-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Welcome back! Here's an overview of your business.</p>
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
                  <div key={invoice.id || invoice.invoice_number} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{invoice.invoice_number || invoice.id}</p>
                      <p className="text-sm text-muted-foreground">{invoice.customer_name || 'Customer'}</p>
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
                {(isEmployee || isAdmin) && (
                  <Button asChild className="mt-4">
                    <Link href="/invoices/new">Create Your First Invoice</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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
      {/* Excel UI removed in favor of IndexedDB-first local storage */}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(isEmployee || isAdmin) && (
              <Button asChild className="h-auto flex-col gap-2 py-4">
                <Link href="/invoices/new">
                  <Receipt className="h-6 w-6" />
                  <span>Create Invoice</span>
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4 bg-transparent">
                <Link href="/employees">
                  <UserCog className="h-6 w-6" />
                  <span>Manage Employees</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4 bg-transparent">
              <Link href="/inventory">
                <Boxes className="h-6 w-6" />
                <span>Inventory Overview</span>
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
