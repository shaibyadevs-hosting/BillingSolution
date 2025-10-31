"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function InventoryReportPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchInventoryData() }, [])

  const fetchInventoryData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("stock_quantity", { ascending: true })

      setProducts(data || [])
    } catch (error) {
      console.error("Error fetching inventory:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportInventory = () => {
    const csv = [
      ["Product Name", "SKU", "Category", "Stock Quantity", "Unit Price", "Cost Price", "Stock Value", "Status"],
      ...products.map((p) => [
        p.name,
        p.sku || "",
        p.category || "",
        p.stock_quantity,
        p.price,
        p.cost_price || "",
        (p.stock_quantity * p.price).toFixed(2),
        p.stock_quantity <= 10 ? "Low Stock" : "In Stock",
      ]),
    ]
    const csvContent = csv.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const lowStockProducts = products.filter((p) => p.stock_quantity <= 10)
  const outOfStockProducts = products.filter((p) => p.stock_quantity === 0)
  const totalStockValue = products.reduce((sum, p) => sum + p.stock_quantity * p.price, 0)

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Report</h1>
          <p className="text-muted-foreground">Monitor stock levels and inventory value</p>
        </div>
        <Button onClick={exportInventory} variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{products.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{totalStockValue.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">≤ 10 units</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{outOfStockProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">0 units</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={product.stock_quantity === 0 ? "destructive" : "secondary"}>
                      {product.stock_quantity} {product.unit || "units"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Product Name</th>
                  <th className="text-left py-2 px-2">SKU</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-right py-2 px-2">Stock</th>
                  <th className="text-right py-2 px-2">Unit Price</th>
                  <th className="text-right py-2 px-2">Stock Value</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{product.name}</td>
                    <td className="py-2 px-2">{product.sku || "-"}</td>
                    <td className="py-2 px-2">{product.category || "-"}</td>
                    <td className="text-right py-2 px-2">{product.stock_quantity}</td>
                    <td className="text-right py-2 px-2">₹{product.price.toLocaleString("en-IN")}</td>
                    <td className="text-right py-2 px-2">
                      ₹{(product.stock_quantity * product.price).toLocaleString("en-IN")}
                    </td>
                    <td className="text-center py-2 px-2">
                      <Badge
                        variant={
                          product.stock_quantity === 0
                            ? "destructive"
                            : product.stock_quantity <= 10
                              ? "secondary"
                              : "default"
                        }
                      >
                        {product.stock_quantity === 0 ? "Out" : product.stock_quantity <= 10 ? "Low" : "In Stock"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
