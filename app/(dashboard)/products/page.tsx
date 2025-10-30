import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { ProductsTable } from "@/components/features/products/products-table"
import { useState, useRef } from "react"
import { toast } from "sonner"
export default async function ProductsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

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
        const { syncExcelWithDexieAndSupabase } = await import("@/lib/utils/excel-sync-controller")
        const res = await importProductsFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        // Always store to DB or Dexie, then sync
        // (logic could check storageMode; for simplicity just sync after import)
        await syncExcelWithDexieAndSupabase(
          (typeof window !== "undefined" && (localStorage.getItem("storageMode") as any)) || "database"
        )
        toast.success("Products imported!")
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
