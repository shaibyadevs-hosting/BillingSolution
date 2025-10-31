"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { ProductsTable } from "@/components/features/products/products-table"
import { toast } from "sonner"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
import { createClient } from "@/lib/supabase/client"
import { fetchProducts } from "@/lib/api/products"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const isExcel = getDatabaseType() === 'excel'
    if (isExcel) {
      // Prefer the Excel API so we read from the data folder
      (async () => {
        try {
          setIsLoading(true)
          const list = await fetchProducts()
          console.log('[ProductsPage][Excel] fetched', list?.length || 0, 'products from /api/excel/products')
          if (!list || list.length === 0) {
            toast.warning('No products found in data/Products.xlsx')
          }
          setProducts(list)
        } catch (e) {
          console.error('[ProductsPage][Excel] fetch failed:', e)
          toast.error('Failed to load products from Excel API')
          // Fallback to in-memory manager if API fails
          setProducts([...excelSheetManager.getList('products')])
        } finally {
          setIsLoading(false)
        }
      })()
      const unsub = excelSheetManager.subscribe(async () => {
        try {
          const list = await fetchProducts()
          console.log('[ProductsPage][Excel][sub] fetched', list?.length || 0)
          setProducts(list)
        } catch (e) {
          console.error('[ProductsPage][Excel][sub] fetch failed:', e)
          setProducts([...excelSheetManager.getList('products')])
        }
      })
      return unsub
    } else {
      const fetchData = async () => {
        setIsLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setProducts([]); setIsLoading(false); return }
        const { data: dbProducts } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        setProducts(dbProducts || [])
        setIsLoading(false)
      }
      fetchData()
    }
  }, [])

  // Excel import logic
  function ExcelImport() {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [importing, setImporting] = useState(false)
    const handleClick = () => inputRef.current?.click()
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return
      setImporting(true)
      try {
        const { importProductsFromExcel } = await import("@/lib/utils/excel-import")
        const res = await importProductsFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        toast.success("Products imported!")
        if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
          // Subscriber should update table
        }
      } catch (error: any) {
        toast.error("Import failed: " + (error.message || error.toString()))
      } finally {
        setImporting(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    }
    return (
      <>
        <Button type="button" variant="secondary" className="mr-2" onClick={handleClick} disabled={importing}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import from Excel
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImport />
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>
      <ProductsTable products={products || []} />
    </div>
  )
}
