"use client"

import { useState, useEffect, useRef } from "react"
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
  const hasCheckedSession = useRef(false)

  // Check if already logged in and redirect (prevent loops)
  useEffect(() => {
    // Only check once on mount
    if (hasCheckedSession.current) return
    hasCheckedSession.current = true
    
    const checkExistingSession = () => {
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            if (session.employeeId && session.storeId) {
              // Already logged in, redirect to dashboard
              window.location.href = "/dashboard"
              return
            }
          } catch (e) {
            // Invalid session, clear it
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("authType")
            localStorage.removeItem("currentStoreId")
          }
        }
      }
    }
    
    checkExistingSession()
  }, [])
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
        // Find store by name OR store_code (case-insensitive, trimmed)
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Use API route to fetch stores (bypasses RLS issues with direct Supabase calls)
        
        let stores: any[] = []
        let storeError: any = null
        
        try {
          // Fetch all stores via API (this works even with RLS)
          const storesResponse = await fetch('/api/stores?all=true')
          const storesData = await storesResponse.json()
          
          // Log only if error occurs
          
          if (!storesResponse.ok) {
            throw new Error(`API Error: ${storesData.error || storesResponse.statusText}`)
          }
          
          if (!storesData.stores || storesData.stores.length === 0) {
            throw new Error("No stores found in database")
          }
          
          // Filter stores by code or name (client-side filtering)
          // Try exact match first
          stores = storesData.stores.filter((s: any) => {
            const nameMatch = s.name?.toLowerCase().trim() === trimmedStoreName.toLowerCase()
            const codeMatch = s.store_code?.toUpperCase().trim() === upperStoreName
            return nameMatch || codeMatch
          })
          
          // If no exact match, try partial name match
          if (stores.length === 0) {
            const partialMatch = storesData.stores.filter((s: any) =>
              s.name?.toLowerCase().includes(trimmedStoreName.toLowerCase())
            )
            
            if (partialMatch.length > 0) {
              stores = [partialMatch[0]]
            }
          }
          
          // Store search completed
        } catch (apiError: any) {
          console.error("[EmployeeLogin] Stores API call failed:", apiError)
          storeError = apiError
          
          // Error handled below
        }
        
        if (storeError) {
          throw new Error(
            `Failed to fetch stores: ${storeError.message}\n\n` +
            `Please ensure the stores API is accessible.`
          )
        }
        
        // Get the matched store (stores array already contains filtered results)
        const store = stores && stores.length > 0 ? stores[0] : null
        
        if (!stores || stores.length === 0 || !store) {
          // Fetch all stores to show what's available
          try {
            const storesResponse = await fetch('/api/stores?all=true')
            const storesData = await storesResponse.json()
            
            const availableStores = storesData.stores?.map((s: any) => 
              `"${s.name}" (code: ${s.store_code})`
            ).join(', ') || "No stores found"
            
            throw new Error(
              `Store not found: "${trimmedStoreName}" (searched as code: "${upperStoreName}").\n\n` +
              `Available stores: ${availableStores}\n\n` +
              `Please enter the exact Store Name or Store Code from the list above.`
            )
          } catch (apiError: any) {
            throw new Error(
              `Store not found: "${trimmedStoreName}".\n\n` +
              `Could not fetch available stores. Please try again.`
            )
          }
        }
        
        if (store) {
          // Verify store belongs to an admin
          if (!store.admin_user_id) {
            throw new Error("Access denied: Store must be created by an admin")
          }

          // Find employee - ensure employee belongs to this store
          const upperEmployeeId = employeeId.toUpperCase().trim()
          
          const employeeResponse = await fetch('/api/employees/lookup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              employee_id: upperEmployeeId,
              store_id: store.id
            })
          })
          
          const employeeData = await employeeResponse.json()
          
          if (!employeeResponse.ok || !employeeData.employee) {
            throw new Error(
              employeeData.error || 
              `Employee "${upperEmployeeId}" not found in store "${store.name}" (${store.store_code}).\n\n` +
              `Please verify:\n` +
              `1. Employee ID is correct\n` +
              `2. Employee belongs to this store`
            )
          }
          
          const employee = employeeData.employee

          // Verify employee has a valid store_id that matches the store
          if (!employee.store_id || employee.store_id !== store.id) {
            throw new Error("Invalid employee-store association")
          }

          // Check password
          const passwordMatches = employee.password === password || employee.employee_id === password
          if (!passwordMatches) {
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
            // Use window.location to prevent React re-renders and infinite loops
            setTimeout(() => {
              window.location.href = "/dashboard"
            }, 100)
            return // Success - exit early
          }
      } catch (supabaseError: any) {
        // Supabase lookup failed - continue to Excel fallback
        // Error logged in catch block below
      }

      // Fallback to Excel mode if Supabase didn't work
      if (isExcel) {
        // Find store by name (case-insensitive) OR store_code
        const trimmedStoreName = storeName.trim()
        const upperStoreName = trimmedStoreName.toUpperCase()
        
        // Get all stores and filter
        const allStores = await db.stores.toArray()
        const stores = allStores.filter(s => 
          s.name?.toLowerCase().trim() === trimmedStoreName.toLowerCase() ||
          s.store_code?.toUpperCase().trim() === upperStoreName
        )
        
        if (stores.length === 0) {
          const availableStores = allStores.map(s => `${s.name} (${s.store_code})`).join(', ')
          throw new Error(
            `Store not found. Please enter the exact Store Name or Store Code.\n` +
            (availableStores ? `Available stores: ${availableStores}` : '')
          )
        }
        const store = stores[0]

        // Verify store belongs to an admin
        if (!store.admin_user_id) {
          throw new Error("Access denied: Store must be created by an admin")
        }

        // Find employee by employee_id and store_id
        const upperEmployeeId = employeeId.toUpperCase().trim()
        const employees = await db.employees
          .where("employee_id").equals(upperEmployeeId)
          .and(e => e.store_id === store.id)
          .toArray()
        
        if (employees.length === 0) {
          throw new Error(
            `Employee "${upperEmployeeId}" not found in store "${store.name}" (${store.store_code}).\n\n` +
            `Please verify the employee ID and store match.`
          )
        }
        const employee = employees[0]

        // Verify employee has a valid store_id that matches the store
        if (!employee.store_id || employee.store_id !== store.id) {
          throw new Error("Invalid employee-store association")
        }

        // Check password
        const passwordMatches = employee.password === password || employee.employee_id === password
        if (!passwordMatches) {
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
        // Use window.location to prevent React re-renders and infinite loops
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 100)
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

