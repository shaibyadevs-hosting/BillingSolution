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
      // ALWAYS check Supabase FIRST for employee credentials
      // This ensures login works from remote devices and incognito mode
      const supabase = createClient()
      
      // Try Supabase first (even in Excel mode, employees should be in Supabase)
      try {
        console.log("[EmployeeLogin] Searching for store:", { 
          storeName, 
          storeNameLength: storeName.length,
          storeNameTrimmed: storeName.trim(),
        })
        
        // Find store by name OR store_code (case-insensitive, trimmed)
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Try to find by name (case-insensitive using ilike) OR by store_code (exact match)
        // First try by store_code (exact match)
        let { data: stores, error: storeError } = await supabase
          .from("stores")
          .select("*")
          .eq("store_code", upperStoreName)
          .limit(5)
        
        // If not found by code, try by name (case-insensitive)
        if ((!stores || stores.length === 0) && !storeError) {
          const { data: storesByName, error: nameError } = await supabase
            .from("stores")
            .select("*")
            .ilike("name", `%${trimmedStoreName}%`)
            .limit(5)
          
          if (nameError) {
            storeError = nameError
          } else {
            stores = storesByName
          }
        }
        
        if (storeError) {
          console.error("[EmployeeLogin] Error searching for store:", storeError)
          throw new Error(`Store lookup failed: ${storeError.message}`)
        }
        
        console.log("[EmployeeLogin] Store search results:", {
          found: stores?.length || 0,
          stores: stores?.map(s => ({ id: s.id, name: s.name, code: s.store_code }))
        })
        
        // Find exact match by name (case-insensitive) or store_code
        let store = stores?.find(s => 
          s.name.toLowerCase().trim() === trimmedStoreName.toLowerCase() || 
          s.store_code.toUpperCase().trim() === upperStoreName
        )
        
        // If no exact match, try partial name match
        if (!store && stores && stores.length > 0) {
          store = stores[0] // Take first result as fallback
          console.log("[EmployeeLogin] Using first store result (partial match):", {
            id: store.id,
            name: store.name,
            code: store.store_code
          })
        }
        
        if (!store || stores.length === 0) {
          // Try to get all stores to show in error message
          const { data: allStores } = await supabase
            .from("stores")
            .select("name, store_code")
            .limit(10)
          
          const availableStores = allStores?.map(s => `${s.name} (code: ${s.store_code})`).join(', ') || "No stores found"
          
          console.error("[EmployeeLogin] Store not found in Supabase:", {
            searched: trimmedStoreName,
            availableStores: allStores
          })
          
          throw new Error(
            `Store not found: "${trimmedStoreName}".\n\n` +
            `Available stores: ${availableStores}\n\n` +
            `Please enter the exact Store Name or Store Code (e.g., "MYS1").`
          )
        }
        
        if (store) {
          console.log("[EmployeeLogin] Store found:", {
            id: store.id,
            name: store.name,
            storeCode: store.store_code,
            adminUserId: store.admin_user_id
          })

          // Verify store belongs to an admin
          if (!store.admin_user_id) {
            throw new Error("Access denied: Store must be created by an admin")
          }

          // Verify the admin_user_id exists and is an admin
          const { data: adminProfile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", store.admin_user_id)
            .maybeSingle()
          
          if (!adminProfile || adminProfile.role !== "admin") {
            throw new Error("Access denied: Store owner is not an admin")
          }

          // Find employee - ensure employee belongs to this store
          const upperEmployeeId = employeeId.toUpperCase().trim()
          console.log("[EmployeeLogin] Searching for employee:", {
            employeeId: upperEmployeeId,
            storeId: store.id,
            storeName: store.name,
          })
          
          // Query employees - check by employee_id and store_id
          const { data: employees, error: empError } = await supabase
            .from("employees")
            .select("*")
            .eq("employee_id", upperEmployeeId)
            .eq("store_id", store.id)
          
          console.log("[EmployeeLogin] Employee search results:", {
            found: employees?.length || 0,
            error: empError,
            employees: employees?.map(e => ({
              id: e.id,
              employee_id: e.employee_id,
              name: e.name,
              store_id: e.store_id,
              hasPassword: !!e.password,
            }))
          })
          
          if (empError) {
            console.error("[EmployeeLogin] Error searching for employee:", empError)
            throw new Error(`Employee lookup failed: ${empError.message}`)
          }
          
          if (!employees || employees.length === 0) {
            // Try to find employee without store_id filter to see if it exists
            const { data: allEmployees } = await supabase
              .from("employees")
              .select("employee_id, name, store_id")
              .eq("employee_id", upperEmployeeId)
              .limit(5)
            
            console.error("[EmployeeLogin] Employee not found in store:", {
              searchedEmployeeId: upperEmployeeId,
              searchedStoreId: store.id,
              foundEmployees: allEmployees,
            })
            
            throw new Error(
              `Employee "${upperEmployeeId}" not found in store "${store.name}" (${store.store_code}).\n\n` +
              `Please verify:\n` +
              `1. Employee ID is correct (case-insensitive)\n` +
              `2. Employee belongs to this store\n` +
              (allEmployees && allEmployees.length > 0 
                ? `\nNote: Employee exists but may be in a different store.` 
                : `\nNote: Employee "${upperEmployeeId}" not found in system.`)
            )
          }
          
          const employee = employees[0]

          // Verify employee has a valid store_id that matches the store
          if (!employee.store_id || employee.store_id !== store.id) {
            console.error("[EmployeeLogin] Store ID mismatch:", {
              employeeStoreId: employee.store_id,
              expectedStoreId: store.id,
            })
            throw new Error("Invalid employee-store association")
          }

          console.log("[EmployeeLogin] Employee found, checking password:", {
            employeeId: employee.employee_id,
            employeeName: employee.name,
            hasPassword: !!employee.password,
            passwordLength: employee.password?.length,
          })

          // Check password
          const passwordMatches = employee.password === password || employee.employee_id === password
          if (!passwordMatches) {
            console.error("[EmployeeLogin] Password mismatch:", {
              provided: password.length,
              storedLength: employee.password?.length,
              employeeIdFallback: employee.employee_id,
            })
            throw new Error("Invalid password. Please check your password or try using your Employee ID as password.")
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
            return // Success - exit early
          }
      } catch (supabaseError: any) {
        // Supabase lookup failed - continue to Excel fallback
        console.log("[EmployeeLogin] Supabase lookup failed, trying Excel:", supabaseError.message)
      }

      // Fallback to Excel mode if Supabase didn't work
      if (isExcel) {
        console.log("[EmployeeLogin] Excel mode: Searching for store:", { storeName })
        
        // Find store by name (case-insensitive) OR store_code
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Get all stores and filter
        const allStores = await db.stores.toArray()
        const stores = allStores.filter(s => 
          s.name?.toLowerCase().trim() === trimmedStoreName.toLowerCase() ||
          s.store_code?.toUpperCase().trim() === upperStoreName
        )
        
        console.log("[EmployeeLogin] Excel mode: Store search results:", {
          totalStores: allStores.length,
          matchedStores: stores.length,
          stores: stores.map(s => ({ id: s.id, name: s.name, code: s.store_code }))
        })
        
        if (stores.length === 0) {
          const availableStores = allStores.map(s => ({
            name: s.name,
            code: s.store_code
          }))
          console.error("[EmployeeLogin] Store not found. Available stores:", availableStores)
          throw new Error(
            `Store not found. Please enter the exact Store Name or Store Code.\n` +
            `Available stores: ${availableStores.map(s => `${s.name} (${s.code})`).join(', ')}`
          )
        }
        const store = stores[0]
        
        console.log("[EmployeeLogin] Excel mode: Store found:", {
          id: store.id,
          name: store.name,
          storeCode: store.store_code
        })

        // Verify store belongs to an admin (has admin_user_id or created by admin)
        if (!store.admin_user_id) {
          throw new Error("Access denied: Store must be created by an admin")
        }

        // Find employee by employee_id and store_id - ensure employee belongs to this store
        const upperEmployeeId = employeeId.toUpperCase().trim()
        console.log("[EmployeeLogin] Excel mode: Searching for employee:", {
          employeeId: upperEmployeeId,
          storeId: store.id,
        })
        
        const employees = await db.employees
          .where("employee_id").equals(upperEmployeeId)
          .and(e => e.store_id === store.id)
          .toArray()
        
        console.log("[EmployeeLogin] Excel mode: Employee search results:", {
          found: employees.length,
          employees: employees.map(e => ({
            id: e.id,
            employee_id: e.employee_id,
            name: e.name,
            store_id: e.store_id,
            hasPassword: !!e.password,
          }))
        })
        
        if (employees.length === 0) {
          // Try to find employee without store filter
          const allEmployees = await db.employees
            .where("employee_id").equals(upperEmployeeId)
            .toArray()
          
          console.error("[EmployeeLogin] Excel mode: Employee not found in store:", {
            searchedEmployeeId: upperEmployeeId,
            searchedStoreId: store.id,
            foundInOtherStores: allEmployees.map(e => ({
              employee_id: e.employee_id,
              store_id: e.store_id,
            }))
          })
          
          throw new Error(
            `Employee "${upperEmployeeId}" not found in store "${store.name}" (${store.store_code}).\n\n` +
            `Please verify the employee ID and store match.`
          )
        }
        const employee = employees[0]

        // Verify employee has a valid store_id that matches the store
        if (!employee.store_id || employee.store_id !== store.id) {
          console.error("[EmployeeLogin] Excel mode: Store ID mismatch")
          throw new Error("Invalid employee-store association")
        }

        // Check password (simple comparison for now, should hash in production)
        const passwordMatches = employee.password === password || employee.employee_id === password
        if (!passwordMatches) {
          console.error("[EmployeeLogin] Excel mode: Password mismatch")
          throw new Error("Invalid password. Please check your password or try using your Employee ID as password.")
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
        // Pure Supabase mode (shouldn't reach here since we checked Supabase first)
        // But keeping as fallback
        throw new Error("Employee not found. Please ensure employee is synced to Supabase.")
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
          <CardDescription>
            Enter your store name or store code, employee ID, and password to login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Store Name or Store Code</Label>
              <Input
                id="store_name"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter store name (e.g., 'My Store') or code (e.g., 'MYS1')"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                You can enter either the full store name or the 4-character store code
              </p>
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

