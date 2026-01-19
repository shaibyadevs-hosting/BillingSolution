"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import { getDatabaseType, isIndexedDbMode } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"
import { db } from "@/lib/dexie-client"
import { useInvalidateQueries } from "@/lib/hooks/use-cached-data"

interface Employee {
  id?: string
  name: string
  email: string
  phone?: string | null
  role?: string // Optional - will default to 'employee'
  salary?: number | null
  joining_date?: string | null
  is_active?: boolean // Optional - will default to true
  employee_id?: string | null
  password?: string | null
  store_id?: string | null
}

interface EmployeeFormProps {
  employee?: Employee
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { currentStore } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const isExcel = isIndexedDbMode() // Use isIndexedDbMode() instead of checking for 'excel'
  const { invalidateEmployees } = useInvalidateQueries()

  const [formData, setFormData] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    salary: employee?.salary?.toString() || "",
    joining_date: employee?.joining_date ? new Date(employee.joining_date).toISOString().split('T')[0] : "",
    password: employee?.password || "",
  })

  useEffect(() => {
    if (!currentStore && !employee?.store_id) {
      toast({
        title: "No Store Selected",
        description: "Please select a store before adding an employee",
        variant: "destructive",
      })
      router.push("/settings/store")
    }
  }, [currentStore, employee?.store_id, router, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!currentStore && !employee?.store_id) {
        throw new Error("No store selected. Please select a store first.")
      }

      const storeId = currentStore?.id || employee?.store_id || localStorage.getItem("currentStoreId")
      if (!storeId) {
        throw new Error("No store selected. Please select a store first.")
      }

      let employeeId = employee?.employee_id
      let password = formData.password || employee?.password

      // Get user_id for both modes (do this BEFORE creating employeeData)
      let userId: string | null = null
      if (!isExcel) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
        }
      } else {
        // For IndexedDB mode, try to get user_id from Supabase if available
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            userId = user.id
          }
        } catch (e) {
          // No Supabase user in IndexedDB mode is okay
        }
      }

      // Generate employee ID if creating new employee
      if (!employee?.id) {
        if (isExcel) {
          const { generateEmployeeId } = await import("@/lib/utils/employee-id")
          employeeId = await generateEmployeeId(storeId, formData.name)
        } else {
          // For Supabase, use shared utility
          const { generateEmployeeIdSupabase } = await import("@/lib/utils/employee-id-supabase")
          employeeId = await generateEmployeeIdSupabase(storeId, formData.name)
        }

        // Generate password different from employee ID for security
        if (!password) {
          const { generateSecurePassword } = await import("@/lib/utils/password-generator")
          password = generateSecurePassword(employeeId)
        }
      }

      const employeeData: any = {
        id: employee?.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())),
        name: formData.name,
        email: formData.email || '',
        phone: formData.phone || '',
        role: 'employee', // Always set to 'employee' (role field removed from form)
        salary: formData.salary ? parseFloat(formData.salary) : 0,
        joining_date: formData.joining_date || new Date().toISOString().split('T')[0],
        is_active: true, // Always set to true (is_active field removed from form)
        employee_id: employeeId || '',
        password: password || employeeId || '',
        store_id: storeId || '',
        created_at: employee?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId || 'local', // Add user_id for consistency
      }

      // Ensure password is different from employee ID
      if (!employeeData.password || employeeData.password === employeeId) {
        const { generateSecurePassword } = await import("@/lib/utils/password-generator")
        employeeData.password = generateSecurePassword(employeeId)
      }

      // ALWAYS save to Supabase first (employees need to login from remote devices)
      // Even in IndexedDB mode, employees must be in Supabase for authentication
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Unauthorized - Please login to create employees")
      }

      // Verify store belongs to this admin
      const { data: store } = await supabase
        .from("stores")
        .select("admin_user_id")
        .eq("id", storeId)
        .single()

      if (!store || store.admin_user_id !== user.id) {
        throw new Error("Store does not belong to this admin")
      }

      if (employee?.id) {
        // Update existing employee via API
        const updateData: any = {
          name: employeeData.name,
          email: employeeData.email,
          phone: employeeData.phone,
          role: employeeData.role,
          salary: employeeData.salary,
          joining_date: employeeData.joining_date,
          is_active: employeeData.is_active,
          employee_id: employeeData.employee_id,
          ...(formData.password && { password: employeeData.password }),
        }

        const response = await fetch("/api/employees", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: employee.id, ...updateData }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update employee")
        }
      } else {
        // Create new employee via API (ALWAYS to Supabase)
        const response = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(employeeData),
        })

        if (!response.ok) {
          const error = await response.json()
          // Handle duplicate employee ID error
          if (response.status === 409 && error.error?.includes("Employee ID")) {
            // Conflict - duplicate employee ID
            // Try to regenerate employee ID and retry (only once)
            console.warn("[EmployeeForm] Duplicate employee ID detected, regenerating...")
            const { generateEmployeeIdSupabase } = await import("@/lib/utils/employee-id-supabase")
            const newEmployeeId = await generateEmployeeIdSupabase(storeId, formData.name)

            // Update employee data with new ID
            const retryEmployeeData = {
              ...employeeData,
              employee_id: newEmployeeId
            }

            // Also regenerate password if it was based on the old employee ID
            if (!formData.password && retryEmployeeData.password === employeeId) {
              const { generateSecurePassword } = await import("@/lib/utils/password-generator")
              retryEmployeeData.password = generateSecurePassword(newEmployeeId)
            }

            // Retry with new employee ID
            const retryResponse = await fetch("/api/employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(retryEmployeeData),
            })

            if (!retryResponse.ok) {
              const retryError = await retryResponse.json()
              throw new Error(retryError.error || `Failed to create employee. Original error: ${error.error}`)
            }

            const createdEmployee = await retryResponse.json()

            // Also save to IndexedDB for local consistency (if in IndexedDB mode)
            if (isExcel && createdEmployee.employee) {
              try {
                await storageManager.addEmployee({
                  ...createdEmployee.employee,
                  user_id: user.id,
                })
                console.log("[EmployeeForm] Employee also saved to IndexedDB for local consistency")
              } catch (e) {
                console.warn("[EmployeeForm] Failed to save to IndexedDB:", e)
                // Don't throw - Supabase save succeeded, that's what matters
              }
            }

            toast({
              title: "Success",
              description: `Employee created with ID: ${newEmployeeId}. Password: ${retryEmployeeData.password}`
            })

            // Invalidate cache for instant UI update
            await invalidateEmployees()

            // Refresh the employees list
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('employees:refresh'))
            }

            router.push("/employees")
            router.refresh()
            return // Exit early after successful retry
          }
          throw new Error(error.error || "Failed to create employee")
        }

        const createdEmployee = await response.json()

        // Also save to IndexedDB for local consistency (if in IndexedDB mode)
        if (isExcel && createdEmployee.employee) {
          try {
            await storageManager.addEmployee({
              ...createdEmployee.employee,
              user_id: user.id,
            })
            console.log("[EmployeeForm] Employee also saved to IndexedDB for local consistency")
          } catch (e) {
            console.warn("[EmployeeForm] Failed to save to IndexedDB:", e)
            // Don't throw - Supabase save succeeded, that's what matters
          }
        }
      }

      // For IndexedDB mode, also save locally for consistency
      if (isExcel && employee?.id) {
        try {
          await storageManager.updateEmployee(employeeData)
          console.log("[EmployeeForm] Employee also updated in IndexedDB")
        } catch (e) {
          console.warn("[EmployeeForm] Failed to update in IndexedDB:", e)
          // Don't throw - Supabase update succeeded
        }
      }


      toast({
        title: "Success",
        description: employee?.id
          ? "Employee updated successfully"
          : `Employee created with ID: ${employeeId}. Password: ${employeeData.password}`
      })

      // Invalidate cache for instant UI update
      await invalidateEmployees()

      // Refresh the employees list
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('employees:refresh'))
      }

      router.push("/employees")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save employee",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Employee Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="employee@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  // Only allow digits and limit to 10
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, phone: digits });
                }}
                placeholder="9876543210"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                placeholder="50000"
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="joining_date">Joining Date</Label>
              <Input
                id="joining_date"
                type="date"
                value={formData.joining_date}
                onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              />
            </div>

            {employee?.id && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave empty to keep current password"
                />
                <p className="text-xs text-muted-foreground">
                  Default password is the Employee ID. Leave empty to keep current password.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : employee ? "Update Employee" : "Create Employee"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

