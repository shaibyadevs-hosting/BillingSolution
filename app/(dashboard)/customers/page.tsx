"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet, Sparkles } from "lucide-react"
import Link from "next/link"
import { CustomersTable } from "@/components/features/customers/customers-table"
import { toast } from "sonner"
// excel-sync-controller removed; Dexie is the source of truth
// Don't import createClient unless needed
// import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isExcel = getDatabaseType() === 'excel'

  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (isExcel) {
      (async () => {
        try {
          setIsLoading(true)
          const list = await db.customers.toArray()
          console.log('[CustomersPage][Dexie] fetched', list?.length || 0, 'customers')
          if (!list || list.length === 0) {
            toast.warning('No customers found in data/Customers.xlsx')
          }
          setCustomers(list)
        } catch {
          console.error('[CustomersPage][Dexie] load failed')
          toast.error('Failed to load customers')
          setCustomers([])
        } finally {
          setIsLoading(false)
        }
      })()
      
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

  const handleAddMockCustomer = async () => {
    try {
      const rand = Math.floor(Math.random() * 10000)
      const mockCustomer = {
        id: crypto.randomUUID(),
        name: `Mock Customer ${rand}`,
        email: `user${rand}@example.com`,
        phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        gstin: `29${Math.floor(1000000000 + Math.random() * 8999999999)}${Math.floor(10 + Math.random() * 90)}`,
        billing_address: `${rand} Street, Sector ${Math.floor(1 + Math.random() * 50)}, City`,
        shipping_address: `${rand + 1} Street, Sector ${Math.floor(1 + Math.random() * 50)}, City`,
        notes: `Mock customer generated at ${new Date().toLocaleString()}`,
      }
      
      if (isExcel) {
        await db.customers.put(mockCustomer as any)
        // Trigger refresh by re-fetching
        const list = await db.customers.toArray()
        setCustomers(list)
        toast.success(`Mock customer "${mockCustomer.name}" added!`)
      } else {
        // For Supabase mode, use API
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error("Not authenticated")
          return
        }
        const { error } = await supabase.from("customers").insert({
          ...mockCustomer,
          user_id: user.id,
        })
        if (error) throw error
        toast.success(`Mock customer "${mockCustomer.name}" added!`)
        // Refresh data
        const { data: dbCustomers } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        setCustomers(dbCustomers || [])
      }
    } catch (error: any) {
      toast.error("Failed to add mock customer: " + (error.message || error.toString()))
    }
  }

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
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleAddMockCustomer}
            title="Add a mock customer with random data"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Add Mock Customer
          </Button>
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
