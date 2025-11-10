"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { AlertCircle, Boxes, Layers, PiggyBank, TrendingUp } from "lucide-react"

interface InventoryProduct {
  id: string
  name: string
  sku?: string | null
  category?: string | null
  stock_quantity?: number | null
  price?: number | null
  cost_price?: number | null
  unit?: string | null
  gst_rate?: number | null
  updated_at?: string | null
}

export default function InventoryPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const databaseType = getDatabaseType()

  useEffect(() => {
    let isActive = true
    const loadProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        if (databaseType === "excel") {
          const list = await db.products.toArray()
          if (!isActive) return
          setProducts(list as InventoryProduct[])
        } else {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            if (isActive) setProducts([])
            return
          }
          const { data, error: fetchError } = await supabase
            .from("products")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
          if (fetchError) throw fetchError
          if (isActive) setProducts((data || []) as InventoryProduct[])
        }
      } catch (err: any) {
        console.error("[InventoryPage] Failed to load products", err)
        if (isActive) setError(err.message || "Failed to load inventory data")
      } finally {
        if (isActive) setLoading(false)
      }
    }

    loadProducts()
    return () => {
      isActive = false
    }
  }, [databaseType])

  const {
    totalProducts,
    totalUnits,
    totalValue,
    estimatedProfit,
    lowStockProducts,
    outOfStockProducts,
    topValuedProducts,
    categoryBreakdown,
  } = useMemo(() => {
    const safeProducts = products || []
    const totals = safeProducts.reduce(
      (acc, product) => {
        const qty = Number(product.stock_quantity || 0)
        const price = Number(product.price || 0)
        const cost = Number(product.cost_price || 0)
        acc.totalUnits += qty
        acc.totalValue += qty * price
        acc.estimatedProfit += qty * Math.max(price - cost, 0)
        return acc
      },
      { totalUnits: 0, totalValue: 0, estimatedProfit: 0 },
    )

    const lowStock = safeProducts.filter((product) => {
      const qty = Number(product.stock_quantity ?? 0)
      return qty > 0 && qty <= 10
    })
    const outOfStock = safeProducts.filter((product) => Number(product.stock_quantity ?? 0) === 0)

    const topValued = [...safeProducts]
      .sort((a, b) => {
        const valueA = Number(a.stock_quantity || 0) * Number(a.price || 0)
        const valueB = Number(b.stock_quantity || 0) * Number(b.price || 0)
        return valueB - valueA
      })
      .slice(0, 6)

    const categoriesMap = new Map<
      string,
      { units: number; products: number; value: number; lowStock: number }
    >()

    safeProducts.forEach((product) => {
      const key = product.category?.trim() || "Uncategorized"
      const entry = categoriesMap.get(key) || { units: 0, products: 0, value: 0, lowStock: 0 }
      entry.products += 1
      const qty = Number(product.stock_quantity || 0)
      entry.units += qty
      entry.value += qty * Number(product.price || 0)
      if (qty <= 10) entry.lowStock += 1
      categoriesMap.set(key, entry)
    })

    const categoryList = Array.from(categoriesMap.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    }))

    return {
      totalProducts: safeProducts.length,
      totalUnits: totals.totalUnits,
      totalValue: totals.totalValue,
      estimatedProfit: totals.estimatedProfit,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      topValuedProducts: topValued,
      categoryBreakdown: categoryList,
    }
  }, [products])

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading inventory insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
          <p className="text-sm font-medium text-destructive">Unable to load inventory</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 md:px-6 py-4 md:py-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Monitor stock levels, inventory value, and category health at a glance.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {databaseType === "excel" ? "Excel Mode" : "Supabase Mode"}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Boxes className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique listings being tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Units In Stock</CardTitle>
            <Layers className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUnits.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all warehouses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Potential sales value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Projected Profit</CardTitle>
            <PiggyBank className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(estimatedProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on cost vs. sale price</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={lowStockProducts.length ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Low Stock ({lowStockProducts.length})
            </CardTitle>
            {lowStockProducts.length > 0 && (
              <Badge variant="outline" className="bg-white text-yellow-700">
                Reorder soon
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products have healthy inventory levels.</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-yellow-100 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku || "N/A"} • {product.category || "Uncategorized"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="border-yellow-200 text-yellow-700">
                      {Number(product.stock_quantity || 0)} {product.unit || "units"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={outOfStockProducts.length ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Out of Stock ({outOfStockProducts.length})
            </CardTitle>
            {outOfStockProducts.length > 0 && (
              <Badge variant="destructive" className="border border-destructive/20">
                Needs replenishment
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {outOfStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items are completely out of stock.</p>
            ) : (
              <div className="space-y-3">
                {outOfStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/30 bg-background px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku || "N/A"} • {product.category || "Uncategorized"}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                      Out of stock
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products have been added yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categoryBreakdown.map((category) => (
                <div
                  key={category.category}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{category.category}</p>
                    <Badge variant="outline">{category.products} items</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Units in stock</span>
                      <span className="font-medium text-foreground">{category.units}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inventory value</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Low stock</span>
                      <span className="font-medium text-foreground">{category.lowStock}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle>High Value Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {topValuedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add products to see insights.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {topValuedProducts.map((product) => {
                const qty = Number(product.stock_quantity || 0)
                const value = qty * Number(product.price || 0)
                return (
                  <div key={product.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{product.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product.sku || "N/A"}</p>
                      </div>
                      <Badge variant="secondary">{product.category || "Uncategorized"}</Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Stock</span>
                        <span className="font-medium text-foreground">
                          {qty} {product.unit || "units"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Value</span>
                        <span className="font-medium text-foreground">{formatCurrency(value)}</span>
                      </div>
                      {product.gst_rate != null && (
                        <div className="flex justify-between">
                          <span>GST Rate</span>
                          <span className="font-medium text-foreground">{product.gst_rate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabular view */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Inventory Listing</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Inventory Value</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const qty = Number(product.stock_quantity || 0)
                    const status =
                      qty === 0 ? "out" : qty <= 10 ? "low" : "healthy"
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{product.sku || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {product.category || "Uncategorized"}
                        </TableCell>
                        <TableCell className="text-right">{qty.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">{product.unit || "units"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(product.price || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.cost_price != null ? formatCurrency(Number(product.cost_price)) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(qty * Number(product.price || 0))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              status === "out" ? "destructive" : status === "low" ? "secondary" : "default"
                            }
                          >
                            {status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "In stock"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

