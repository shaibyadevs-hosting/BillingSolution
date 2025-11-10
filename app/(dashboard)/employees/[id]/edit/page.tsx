"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { EmployeeForm } from "@/components/features/employees/employee-form"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"

export default function EditEmployeePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const [employee, setEmployee] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/employees")
      return
    }
    fetchEmployee()
  }, [params.id, isAdmin, roleLoading, router])

  const fetchEmployee = async () => {
    try {
      setIsLoading(true)
      {
        const supabase = createClient()
        const { data: emp, error } = await supabase
          .from("employees")
          .select("*, stores(name, store_code)")
          .eq("id", params.id)
          .single()
        
        if (error || !emp) {
          const localEmp = await db.employees?.get?.(params.id as string)
          if (!localEmp) {
            toast({ title: "Error", description: "Employee not found", variant: "destructive" })
            router.push("/employees")
            return
          }
          setEmployee(localEmp)
        } else {
          setEmployee(emp)
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load employee", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  if (roleLoading || isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!employee) {
    return <div className="text-center py-8">Employee not found</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Edit Employee</h1>
        <p className="text-muted-foreground">Update employee information</p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  )
}

