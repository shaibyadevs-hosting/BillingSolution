"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function EmployeeLoginPage() {
  const [storeName, setStoreName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const isExcel = getDatabaseType() === 'excel'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isExcel) {
        // Find store by name - ensure it belongs to an admin
        const stores = await db.stores.where("name").equals(storeName).toArray()
        if (stores.length === 0) {
          throw new Error("Store not found")
        }
        const store = stores[0]

        // Verify store belongs to an admin (has admin_user_id or created by admin)
        if (!store.admin_user_id) {
          throw new Error("Access denied: Store must be created by an admin")
        }

        // Find employee by employee_id and store_id - ensure employee belongs to this store
        const employees = await db.employees
          .where("employee_id").equals(employeeId.toUpperCase())
          .and(e => e.store_id === store.id)
          .toArray()
        
        if (employees.length === 0) {
          throw new Error("Employee not found or not associated with this store")
        }
        const employee = employees[0]

        // Verify employee has a valid store_id that matches the store
        if (!employee.store_id || employee.store_id !== store.id) {
          throw new Error("Invalid employee-store association")
        }

        // Check password (simple comparison for now, should hash in production)
        if (employee.password !== password && employee.employee_id !== password) {
          throw new Error("Invalid password")
        }

        // Create session
        const session = {
          employeeId: employee.employee_id,
          employeeName: employee.name,
          storeId: store.id,
          storeName: store.name,
          storeCode: store.store_code,
        }
        localStorage.setItem("employeeSession", JSON.stringify(session))
        localStorage.setItem("currentStoreId", store.id)
        localStorage.setItem("authType", "employee")

        toast.success("Logged in as Employee")
        router.push("/dashboard")
        router.refresh()
      } else {
        // Supabase mode
        const supabase = createClient()
        // Find store - ensure it belongs to an admin
        const { data: stores } = await supabase
          .from("stores")
          .select("*")
          .eq("name", storeName)
        
        if (!stores || stores.length === 0) throw new Error("Store not found")
        const store = stores[0]

        // Verify store belongs to an admin (has admin_user_id)
        if (!store.admin_user_id) {
          throw new Error("Access denied: Store must be created by an admin")
        }

        // Verify the admin_user_id exists and is an admin
        const { data: adminProfile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", store.admin_user_id)
          .single()
        
        if (!adminProfile || adminProfile.role !== "admin") {
          throw new Error("Access denied: Store owner is not an admin")
        }

        // Find employee - ensure employee belongs to this store and was created by admin
        const { data: employees } = await supabase
          .from("employees")
          .select("*, stores!inner(admin_user_id)")
          .eq("employee_id", employeeId.toUpperCase())
          .eq("store_id", store.id)
        
        if (!employees || employees.length === 0) {
          throw new Error("Employee not found or not associated with this store")
        }
        const employee = employees[0]

        // Verify employee has a valid store_id that matches the store
        if (!employee.store_id || employee.store_id !== store.id) {
          throw new Error("Invalid employee-store association")
        }

        // Check password (would need password_hash comparison in production)
        if (employee.password !== password && employee.employee_id !== password) {
          throw new Error("Invalid password")
        }

        // Create session (similar to Excel mode)
        const session = {
          employeeId: employee.employee_id,
          employeeName: employee.name,
          storeId: store.id,
          storeName: store.name,
          storeCode: store.store_code,
        }
        localStorage.setItem("employeeSession", JSON.stringify(session))
        localStorage.setItem("currentStoreId", store.id)
        localStorage.setItem("authType", "employee")

        toast.success("Logged in as Employee")
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error: any) {
      setError(error.message || "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Employee Login</CardTitle>
          <CardDescription>Enter your store name, employee ID, and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Store Name</Label>
              <Input
                id="store_name"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="My Store"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="A1B2"
                maxLength={4}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

