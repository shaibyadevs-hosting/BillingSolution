"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MoreHorizontal, Pencil, Trash2, Search, Filter, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  name: string
  sku: string | null
  category: string | null
  price: number
  stock_quantity: number
  unit: string
  gst_rate: number
  is_active: boolean
}

interface ProductsTableProps {
  products: Product[]
}

export function ProductsTable({ products: initialProducts }: ProductsTableProps) {
  const [products, setProducts] = useState(initialProducts)
  useEffect(() => {
    console.log('[ProductsTable] props changed, count =', initialProducts?.length || 0)
    setProducts(initialProducts || [])
  }, [initialProducts])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>("all")
  const [selectedActiveStatus, setSelectedActiveStatus] = useState<string>("all")
  const router = useRouter()
  const { toast } = useToast()

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase())

      // Category filter
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory

      // Stock status filter
      const matchesStockStatus =
        selectedStockStatus === "all" ||
        (selectedStockStatus === "in-stock" && product.stock_quantity > 10) ||
        (selectedStockStatus === "low-stock" && product.stock_quantity > 0 && product.stock_quantity <= 10) ||
        (selectedStockStatus === "out-of-stock" && product.stock_quantity === 0)

      // Active status filter
      const matchesActiveStatus =
        selectedActiveStatus === "all" ||
        (selectedActiveStatus === "active" && product.is_active) ||
        (selectedActiveStatus === "inactive" && !product.is_active)

      return matchesSearch && matchesCategory && matchesStockStatus && matchesActiveStatus
    })
  }, [products, searchTerm, selectedCategory, selectedStockStatus, selectedActiveStatus])

  const hasActiveFilters = selectedCategory !== "all" || selectedStockStatus !== "all" || selectedActiveStatus !== "all"

  const clearFilters = () => {
    setSelectedCategory("all")
    setSelectedStockStatus("all")
    setSelectedActiveStatus("all")
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return

    const supabase = createClient()
    const { error } = await supabase.from("products").delete().eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      })
    } else {
      setProducts(products.filter((p) => p.id !== id))
      toast({
        title: "Success",
        description: "Product deleted successfully",
      })
    }
  }

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (quantity <= 10) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Low Stock</Badge>
    } else {
      return <Badge className="bg-green-500 hover:bg-green-600">In Stock</Badge>
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 space-y-4">
          {/* Search and Total Count Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <span className="font-medium text-foreground">
                Total: <span className="font-semibold">{products.length}</span>
              </span>
              {filteredProducts.length !== products.length && (
                <span className="text-muted-foreground">
                  | Showing: <span className="font-semibold text-foreground">{filteredProducts.length}</span>
                </span>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters:</span>
            </div>
            
            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stock Status Filter */}
            <Select value={selectedStockStatus} onValueChange={setSelectedStockStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
                <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            {/* Active Status Filter */}
            <Select value={selectedActiveStatus} onValueChange={setSelectedActiveStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No products found</p>
            <Button asChild className="mt-4">
              <a href="/products/new">Add Your First Product</a>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">GST Rate</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>{product.category || "-"}</TableCell>
                    <TableCell className="text-right">₹{Number(product.price).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">
                      {product.stock_quantity} {product.unit}
                    </TableCell>
                    <TableCell>{getStockBadge(product.stock_quantity)}</TableCell>
                    <TableCell className="text-right">{product.gst_rate}%</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
