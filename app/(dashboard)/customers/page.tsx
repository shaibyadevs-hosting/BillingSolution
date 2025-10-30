"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { CustomersTable } from "@/components/features/customers/customers-table"
import { toast } from "sonner"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
// Don't import createClient unless needed
// import { createClient } from "@/lib/supabase/client"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isExcel = excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()

  useEffect(() => {
    if (isExcel) {
      setCustomers([...excelSheetManager.getList('customers')])
      setIsLoading(false)
      const unsub = excelSheetManager.subscribe(() => setCustomers([...excelSheetManager.getList('customers')]))
      return unsub
    } else {
      // Only import and use Supabase when NOT in Excel mode
      import("@/lib/supabase/client").then(({ createClient }) => {
        const fetchData = async () => {
          setIsLoading(true)
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            setCustomers([])
            setIsLoading(false)
            return
          }
          const { data: dbCustomers } = await supabase
            .from("customers")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
          setCustomers(dbCustomers || [])
          setIsLoading(false)
        }
        fetchData()
      })
    }
  }, [isExcel])

  // Excel import logic
  function ExcelImport() {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [importing, setImporting] = useState(false)
    const handleClick = () => inputRef.current?.click()
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return
      setImporting(true)
      try {
        const { importCustomersFromExcel } = await import("@/lib/utils/excel-import")
        const res = await importCustomersFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        toast.success("Customers imported!")
        if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
          // Could refresh list here, but subscriber above should handle it
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
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImport />
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        </div>
      </div>
      <CustomersTable customers={customers || []} />
    </div>
  )
}
