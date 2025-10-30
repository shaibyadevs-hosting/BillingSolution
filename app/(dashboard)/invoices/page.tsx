import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/features/invoices/invoices-table"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller";

export default async function InvoicesPage() {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    const invoices = excelSheetManager.getList("invoices");
    return (
      // Use the same UI as before with Excel invoices as input (replace DB prop/args/JSX with Excel data)
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Invoices (Excel)</h1>
        {/* Add your table/grid rendering here, reusing your component and passing invoices */}
        {/* Example: <InvoicesTable invoices={invoices}/> if such a component exists */}
      </div>
    );
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage your invoices</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <InvoicesTable invoices={invoices || []} />
    </div>
  )
}
