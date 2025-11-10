"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet, Sparkles } from "lucide-react"
import Link from "next/link"
import { ProductsTable } from "@/components/features/products/products-table"
import { toast } from "sonner"
// excel-sync-controller removed; Dexie is the source of truth
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { getDatabaseType, isIndexedDbMode } from "@/lib/utils/db-mode"
import { storageManager } from "@/lib/storage-manager"

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const isIndexedDb = isIndexedDbMode()
    if (isIndexedDb) {
      // Prefer the Excel API so we read from the data folder
      (async () => {
        try {
          setIsLoading(true)
          const list = await db.products.toArray()
          console.log('[ProductsPage][Dexie] fetched', list?.length || 0, 'products')
          if (!list || list.length === 0) { toast.warning('No products found') }
          setProducts(list)
        } catch (e) {
          console.error('[ProductsPage][Dexie] load failed:', e)
          
        } finally {
          setIsLoading(false)
        }
      })()
      
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
        const isIndexedDb = isIndexedDbMode()
        if (!isIndexedDb) {
          toast.error("Excel import is only available in IndexedDB mode")
          return
        }
        
        const { importProductsFromExcel } = await import("@/lib/utils/excel-import")
        const res = await importProductsFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        // Save imported products to Dexie
        const toSave = (res.data || []).map((p: any) => ({ id: crypto.randomUUID(), ...p }))
        for (const p of toSave) {
          await storageManager.addProduct(p as any)
        }
        const list = await db.products.toArray()
        setProducts(list)
        toast.success(`Products imported: ${toSave.length}`)
        
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

  const handleAddMockProduct = async () => {
    try {
      const rand = Math.floor(Math.random()*10000)
      const isIndexedDb = isIndexedDbMode()
      
      const product = {
        id: crypto.randomUUID(),
        name: `Mock Product ${rand}`,
        sku: `SKU-${rand}`,
        category: ["General","Tools","Food"][rand%3],
        price: Number((Math.random()*1000+10).toFixed(2)),
        cost_price: Number((Math.random()*800+5).toFixed(2)),
        stock_quantity: Math.floor(Math.random()*100)+1,
        unit: "piece",
        hsn_code: "1234",
        gst_rate: 18,
        is_active: true,
      }

      if (isIndexedDb) {
        // Save to Dexie
        await storageManager.addProduct(product as any)
        const list = await db.products.toArray()
        setProducts(list)
        toast.success(`Mock product "${product.name}" added!`)
      } else {
        // Save to Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error("Not authenticated")
          return
        }
        const { error } = await supabase.from("products").insert({
          ...product,
          user_id: user.id,
        })
        if (error) throw error
        
        // Refresh from Supabase
        const { data: dbProducts } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        setProducts(dbProducts || [])
        toast.success(`Mock product "${product.name}" added!`)
      }
    } catch (error: any) {
      toast.error("Failed to add mock product: " + (error.message || error.toString()))
    }
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
          <Button type="button" variant="outline" onClick={handleAddMockProduct} title="Add a mock product">
            <Sparkles className="mr-2 h-4 w-4" /> Add Mock Product
          </Button>
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
