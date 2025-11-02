"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface Employee {
  id?: string
  name: string
  email: string
  phone?: string | null
  role: string
  salary?: number | null
  joining_date?: string | null
  is_active: boolean
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
  const isExcel = getDatabaseType() === 'excel'

  const [formData, setFormData] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    role: employee?.role || "employee",
    salary: employee?.salary?.toString() || "",
    joining_date: employee?.joining_date ? new Date(employee.joining_date).toISOString().split('T')[0] : "",
    is_active: employee?.is_active !== undefined ? employee.is_active : true,
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
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        joining_date: formData.joining_date || new Date().toISOString(),
        is_active: formData.is_active,
        employee_id: employeeId,
        password: password || employeeId, // Will be set properly below if not provided
        store_id: storeId,
      }

      // Ensure password is different from employee ID
      if (!employeeData.password || employeeData.password === employeeId) {
        const { generateSecurePassword } = await import("@/lib/utils/password-generator")
        employeeData.password = generateSecurePassword(employeeId)
      }

      if (isExcel) {
        // In Excel mode: sync to Supabase first (for remote access)
        // Then save to Excel for local cache
        const { syncEmployeeToSupabase } = await import("@/lib/utils/supabase-sync")
        const syncResult = await syncEmployeeToSupabase(employeeData)
        
        if (!syncResult.success) {
          console.warn("[EmployeeForm] Supabase sync failed:", syncResult.error)
          // Continue anyway - will be synced later
        }
        
        // Also save to Excel for local cache
        await storageManager.updateEmployee(employeeData)
      } else {
        // In Supabase mode: use API route (handles auth, validation, and RLS)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error("Unauthorized")
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
          const updateData = {
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
          // Create new employee via API
          const response = await fetch("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employeeData),
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Failed to create employee")
          }
        }
      }

      toast({ 
        title: "Success", 
        description: employee?.id 
          ? "Employee updated successfully" 
          : `Employee created with ID: ${employeeId}. Password: ${employeeData.password}` 
      })
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
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => {
              const rand = Math.floor(Math.random()*10000)
              setFormData({
                name: `Employee ${rand}`,
                email: `emp${rand}@example.com`,
                phone: `9${Math.floor(100000000 + Math.random()*899999999)}`,
                role: "employee",
                salary: String(Math.floor(Math.random()*50000)+20000),
                joining_date: new Date().toISOString().split('T')[0],
                is_active: true,
                password: "",
              })
            }}>Fill Mock</Button>
          </div>
          
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
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
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
                <Input
                  id="password"
                  type="text"
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active Employee
            </Label>
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

