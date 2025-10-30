import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
import { CustomerForm } from "@/components/features/customers/customer-form"
import { notFound } from "next/navigation"

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    const allCustomers = excelSheetManager.getList("customers")
    const customer = allCustomers.find((c: any) => c.id === id)
    if (!customer) {
      return <div>Customer Not Found (Excel)</div>
    }
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Customer</h1>
          <p className="text-muted-foreground">Update customer information (Excel)</p>
        </div>
        <CustomerForm customer={customer} />
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).eq("user_id", user!.id).single()

  if (!customer) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Customer</h1>
        <p className="text-muted-foreground">Update customer information</p>
      </div>

      <CustomerForm customer={customer} />
    </div>
  )
}
