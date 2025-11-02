"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { EmployeeForm } from "@/components/features/employees/employee-form"
import { useUserRole } from "@/lib/hooks/use-user-role"

export default function NewEmployeePage() {
  const router = useRouter()
  const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole()

  useEffect(() => {
    // Wait for role to be determined
    if (roleLoading) {
      return
    }

    // Only admin can access this page
    if (isEmployee || !isAdmin) {
      router.push("/employees")
      return
    }
  }, [isAdmin, isEmployee, roleLoading, router])

  if (roleLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!isAdmin) {
    return <div className="text-center py-8">Access Denied. Admin access required.</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Employee</h1>
        <p className="text-muted-foreground">Add a new employee to your team</p>
      </div>

      <EmployeeForm />
    </div>
  )
}

