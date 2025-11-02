"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Always sync employees and stores to Supabase, regardless of storage mode
 * This ensures employee login works from remote devices and incognito mode
 */

export interface SyncResult {
  success: boolean
  error?: string
}

/**
 * Sync employee to Supabase (always, even in Excel mode)
 * This is critical for remote employee login
 */
export async function syncEmployeeToSupabase(employeeData: any): Promise<SyncResult> {
  console.log("[SupabaseSync] Starting employee sync:", {
    employeeId: employeeData.id,
    employeeDataId: employeeData.employee_id,
    name: employeeData.name,
    email: employeeData.email,
    storeId: employeeData.store_id,
    hasData: !!employeeData,
    dataKeys: employeeData ? Object.keys(employeeData) : [],
  })
  
  try {
    const supabase = createClient()
    console.log("[SupabaseSync] Supabase client created, getting user...")
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("[SupabaseSync] Auth error:", authError)
    }
    
    if (!user) {
      console.warn("[SupabaseSync] No user authenticated, skipping employee sync", {
        authError,
        hasUser: !!user,
      })
      return { success: false, error: "Not authenticated" }
    }
    
    console.log("[SupabaseSync] User authenticated:", {
      userId: user.id,
      userEmail: user.email,
    })

    // Validate and sync store if store_id is provided
    if (employeeData.store_id) {
      console.log("[SupabaseSync] Employee has store_id, validating store exists:", employeeData.store_id)
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id, name, admin_user_id")
        .eq("id", employeeData.store_id)
        .maybeSingle()
      
      if (storeError) {
        console.error("[SupabaseSync] Error checking store:", {
          error: storeError,
          storeId: employeeData.store_id,
          errorCode: storeError.code,
          errorMessage: storeError.message,
        })
        return { 
          success: false, 
          error: `Store validation failed: ${storeError.message}. Store ID ${employeeData.store_id} may not exist in Supabase. Please ensure the store is synced to Supabase first.` 
        }
      }
      
      if (!store) {
        console.error("[SupabaseSync] Store does not exist in Supabase:", {
          storeId: employeeData.store_id,
          employeeId: employeeData.employee_id || employeeData.id,
          employeeName: employeeData.name,
        })
        return { 
          success: false, 
          error: `Store with ID ${employeeData.store_id} does not exist in Supabase. Please sync the store to Supabase first before syncing employees.` 
        }
      }
      
      // Verify store belongs to current user
      if (store.admin_user_id !== user.id) {
        console.error("[SupabaseSync] Store does not belong to current user:", {
          storeId: store.id,
          storeAdminUserId: store.admin_user_id,
          currentUserId: user.id,
        })
        return { 
          success: false, 
          error: `Store does not belong to current user` 
        }
      }
      
      console.log("[SupabaseSync] Store validated successfully:", {
        storeId: store.id,
        storeName: store.name,
        adminUserId: store.admin_user_id,
      })
    } else {
      console.warn("[SupabaseSync] No store_id provided for employee:", {
        employeeId: employeeData.employee_id || employeeData.id,
        employeeName: employeeData.name,
      })
    }

    // Check if employee exists in Supabase
    console.log("[SupabaseSync] Checking if employee exists with id:", employeeData.id)
    const { data: existing, error: existingError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeData.id)
      .single()
    
    if (existingError && existingError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is expected for new employees
      console.warn("[SupabaseSync] Error checking for existing employee:", existingError)
    }
    
    console.log("[SupabaseSync] Employee exists check:", {
      exists: !!existing,
      employeeId: employeeData.id,
      existingId: existing?.id,
    })

    if (existing) {
      // Update existing employee
      const updateData: any = {
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone || null,
        role: employeeData.role || 'employee',
        salary: employeeData.salary ?? null,
        joining_date: employeeData.joining_date 
          ? (employeeData.joining_date.includes('T') 
              ? employeeData.joining_date.split('T')[0] 
              : employeeData.joining_date)
          : null,
        is_active: employeeData.is_active ?? true,
        employee_id: employeeData.employee_id || null,
        password: employeeData.password || null,
        store_id: employeeData.store_id || null,
      }

      const { data: updatedData, error } = await supabase
        .from("employees")
        .update(updateData)
        .eq("id", employeeData.id)
        .select()
        .single()

      if (error) {
        // Enhanced error logging
        console.error("[SupabaseSync] Error updating employee:", {
          error,
          errorDetails: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
          updateData: {
            ...updateData,
            password: updateData.password ? '[REDACTED]' : null, // Don't log password
          },
          employeeId: employeeData.id
        })
        return { success: false, error: error.message || error.details || JSON.stringify(error) }
      }
      
      console.log("[SupabaseSync] Employee updated successfully:", updatedData?.id)
    } else {
      // Create new employee
      // Validate required fields (NOT NULL columns based on schema)
      if (!employeeData.name) {
        return { success: false, error: "Employee name is required (NOT NULL)" }
      }
      // Note: Email might be nullable or NOT NULL depending on schema
      // We'll provide it but allow null if schema allows
      
      // Prepare insert data with defaults for nullable fields
      // CRITICAL: Ensure all NOT NULL columns are provided:
      // - id (required, provided)
      // - user_id (required, provided)
      // - name (required, validated above)
      // - role (required, must have default 'employee' if not provided)
      const insertData: any = {
        id: employeeData.id,
        user_id: user.id, // NOT NULL - required
        name: employeeData.name, // NOT NULL - required (validated above)
        email: employeeData.email || null, // nullable
        phone: employeeData.phone || null, // nullable
        role: employeeData.role || 'employee', // NOT NULL - always provide default
        salary: employeeData.salary ?? null, // nullable
        joining_date: employeeData.joining_date 
          ? (employeeData.joining_date.includes('T') 
              ? employeeData.joining_date.split('T')[0] 
              : employeeData.joining_date)
          : null, // nullable - removed default to today, let DB handle it
        is_active: employeeData.is_active ?? true,
        employee_id: employeeData.employee_id || null,
        password: employeeData.password || null,
        store_id: employeeData.store_id || null,
      }
      
      // Double-check all NOT NULL fields are set
      if (!insertData.id) {
        console.error("[SupabaseSync] Missing required field: id")
        return { success: false, error: "Employee ID is required" }
      }
      if (!insertData.user_id) {
        console.error("[SupabaseSync] Missing required field: user_id")
        return { success: false, error: "User ID is required" }
      }
      if (!insertData.name) {
        console.error("[SupabaseSync] Missing required field: name")
        return { success: false, error: "Employee name is required" }
      }
      if (!insertData.role) {
        console.error("[SupabaseSync] Missing required field: role - setting default")
        insertData.role = 'employee' // Ensure role is always set
      }

      // Log input data before insert (for debugging)
      console.log("[SupabaseSync] Preparing to insert employee:", {
        userId: user.id,
        employeeId: insertData.id,
        employeeDataId: insertData.employee_id,
        storeId: insertData.store_id,
        name: insertData.name,
        email: insertData.email,
        role: insertData.role,
        hasPassword: !!insertData.password,
        dataStructure: Object.keys(insertData),
      })

      // Check for unique constraint violation (store_id + employee_id)
      if (insertData.store_id && insertData.employee_id) {
        console.log("[SupabaseSync] Checking for duplicate employee_id...")
        const { data: duplicate, error: duplicateCheckError } = await supabase
          .from("employees")
          .select("id, employee_id")
          .eq("store_id", insertData.store_id)
          .eq("employee_id", insertData.employee_id)
          .maybeSingle()
        
        if (duplicateCheckError) {
          console.warn("[SupabaseSync] Error checking for duplicate:", duplicateCheckError)
        }
        
        if (duplicate) {
          console.error("[SupabaseSync] Employee with same employee_id already exists in this store:", duplicate)
          return { success: false, error: `Employee ID ${insertData.employee_id} already exists in this store` }
        }
        console.log("[SupabaseSync] No duplicate found, proceeding with insert...")
      }

      // Attempt insert
      console.log("[SupabaseSync] Attempting insert to Supabase...")
      const { data: insertedData, error } = await supabase
        .from("employees")
        .insert(insertData)
        .select()
        .single()

      if (error) {
        // Comprehensive error logging with multiple serialization methods
        const errorInfo: any = {
          // Try different ways to serialize the error
          errorString: String(error),
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorKeys: error ? Object.keys(error) : [],
          errorEnumerable: error ? Object.getOwnPropertyNames(error) : [],
        }

        // Try to extract error properties
        try {
          errorInfo.message = error?.message
          errorInfo.details = error?.details
          errorInfo.hint = error?.hint
          errorInfo.code = error?.code
          errorInfo.statusCode = (error as any)?.statusCode
          errorInfo.status = (error as any)?.status
        } catch (e) {
          console.warn("[SupabaseSync] Error extracting error properties:", e)
        }

        // Try JSON serialization
        try {
          errorInfo.errorJson = JSON.stringify(error)
        } catch (e) {
          errorInfo.errorJson = "Could not stringify error: " + String(e)
        }

        // Try to stringify with replacer
        try {
          errorInfo.errorJsonReplacer = JSON.stringify(error, (key, value) => {
            if (key === 'password') return '[REDACTED]'
            return value
          })
        } catch (e) {
          // Ignore
        }

        console.error("[SupabaseSync] Error creating employee:", {
          errorInfo,
          insertData: {
            ...insertData,
            password: insertData.password ? '[REDACTED]' : null,
          },
          userInfo: {
            userId: user.id,
            userEmail: user.email,
          },
          timestamp: new Date().toISOString(),
        })

        // Also log the raw error separately using different methods
        console.error("[SupabaseSync] Raw error object:", error)
        console.error("[SupabaseSync] Error.toString():", error?.toString?.())
        
        // Try to inspect error with all properties
        try {
          const errorInspect = JSON.stringify(error, Object.getOwnPropertyNames(error))
          console.error("[SupabaseSync] Error inspect (all properties):", errorInspect)
        } catch (e) {
          console.error("[SupabaseSync] Could not inspect error with all properties:", e)
        }
        
        // Log error as plain object
        console.error("[SupabaseSync] Error as object:", { ...error })

        const errorMessage = error?.message || error?.details || errorInfo.errorString || "Unknown error occurred"
        return { success: false, error: errorMessage }
      }
      
      console.log("[SupabaseSync] Employee created successfully:", insertedData?.id)
    }

    console.log("[SupabaseSync] Employee synced successfully:", employeeData.employee_id)
    return { success: true }
  } catch (error: any) {
    console.error("[SupabaseSync] Exception syncing employee:", {
      error,
      errorType: typeof error,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorString: String(error),
      errorJson: (() => {
        try {
          return JSON.stringify(error)
        } catch {
          return "Could not stringify"
        }
      })(),
      employeeData: employeeData ? {
        id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email,
        storeId: employeeData.store_id,
      } : null,
    })
    return { success: false, error: error?.message || String(error) || "Unknown error occurred" }
  }
}

/**
 * Sync store to Supabase (always, even in Excel mode)
 * This is critical for employee login and store lookup
 */
export async function syncStoreToSupabase(storeData: any): Promise<SyncResult> {
  console.log("[SupabaseSync] Starting store sync:", {
    storeId: storeData.id,
    storeCode: storeData.store_code,
    storeName: storeData.name,
  })
  
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("[SupabaseSync] Auth error when syncing store:", authError)
    }
    
    if (!user) {
      console.warn("[SupabaseSync] No user authenticated, skipping store sync")
      return { success: false, error: "Not authenticated" }
    }

    console.log("[SupabaseSync] Checking if store exists:", storeData.id)
    // Check if store exists in Supabase
    const { data: existing, error: existingError } = await supabase
      .from("stores")
      .select("id, name, admin_user_id")
      .eq("id", storeData.id)
      .maybeSingle()
    
    if (existingError && existingError.code !== 'PGRST116') {
      console.warn("[SupabaseSync] Error checking for existing store:", existingError)
    }

    if (existing) {
      console.log("[SupabaseSync] Store exists, updating:", {
        storeId: existing.id,
        currentAdmin: existing.admin_user_id,
        newAdmin: user.id,
      })
      
      // Update existing store
      const updateData = {
        name: storeData.name,
        store_code: storeData.store_code,
        address: storeData.address || null,
        gstin: storeData.gstin || null,
        phone: storeData.phone || null,
      }
      
      const { data: updatedStore, error } = await supabase
        .from("stores")
        .update(updateData)
        .eq("id", storeData.id)
        .select()
        .single()

      if (error) {
        console.error("[SupabaseSync] Error updating store:", {
          error,
          errorCode: error.code,
          errorMessage: error.message,
          storeId: storeData.id,
          updateData,
        })
        return { success: false, error: error.message }
      }
      
      console.log("[SupabaseSync] Store updated successfully:", updatedStore?.id)
    } else {
      console.log("[SupabaseSync] Store does not exist, creating new:", {
        storeId: storeData.id,
        storeCode: storeData.store_code,
        adminUserId: user.id,
      })
      
      // Create new store
      const insertData = {
        id: storeData.id,
        admin_user_id: user.id,
        name: storeData.name,
        store_code: storeData.store_code,
        address: storeData.address || null,
        gstin: storeData.gstin || null,
        phone: storeData.phone || null,
      }
      
      const { data: insertedStore, error } = await supabase
        .from("stores")
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error("[SupabaseSync] Error creating store:", {
          error,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          insertData,
        })
        return { success: false, error: error.message || error.details || "Failed to create store" }
      }
      
      console.log("[SupabaseSync] Store created successfully:", insertedStore?.id)
    }

    console.log("[SupabaseSync] Store synced successfully:", storeData.store_code)
    return { success: true }
  } catch (error: any) {
    console.error("[SupabaseSync] Exception syncing store:", {
      error,
      errorType: typeof error,
      errorMessage: error?.message,
      storeData: {
        id: storeData.id,
        storeCode: storeData.store_code,
        name: storeData.name,
      },
    })
    return { success: false, error: error?.message || String(error) }
  }
}

/**
 * Delete employee from Supabase
 */
export async function deleteEmployeeFromSupabase(employeeId: string): Promise<SyncResult> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", employeeId)
      .eq("user_id", user.id) // Ensure ownership

    if (error) {
      console.error("[SupabaseSync] Error deleting employee:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("[SupabaseSync] Exception deleting employee:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync all employees from Dexie/Excel to Supabase
 * This is used in Excel mode to upload all employee data to Supabase
 * Only syncs employees, NOT products/inventory
 */
export async function syncAllEmployeesToSupabase(): Promise<{
  success: boolean
  synced: number
  failed: number
  errors: string[]
}> {
  try {
    const { db } = await import("@/lib/dexie-client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ["Not authenticated"]
      }
    }

    console.log("[SupabaseSync] Starting bulk sync of all employees from Dexie to Supabase...")
    
    // Get all employees from Dexie
    const employees = await db.employees.toArray()
    console.log(`[SupabaseSync] Found ${employees.length} employees in Dexie to sync`)
    
    // Get all stores from Dexie to check/store them first
    const stores = await db.stores.toArray()
    console.log(`[SupabaseSync] Found ${stores.length} stores in Dexie`)
    
    // Sync stores first to ensure they exist in Supabase
    if (stores.length > 0) {
      console.log("[SupabaseSync] Syncing stores to Supabase first...")
      const { syncStoreToSupabase } = await import("@/lib/utils/supabase-sync")
      for (const store of stores) {
        try {
          const storeResult = await syncStoreToSupabase(store)
          if (storeResult.success) {
            console.log(`[SupabaseSync] Synced store: ${store.store_code} (${store.id})`)
          } else {
            console.warn(`[SupabaseSync] Failed to sync store ${store.store_code}: ${storeResult.error}`)
          }
        } catch (error: any) {
          console.error(`[SupabaseSync] Exception syncing store ${store.store_code}:`, error)
        }
      }
      console.log("[SupabaseSync] Store sync completed, proceeding with employees...")
    }

    if (employees.length === 0) {
      console.log("[SupabaseSync] No employees to sync")
      return {
        success: true,
        synced: 0,
        failed: 0,
        errors: []
      }
    }

    let synced = 0
    let failed = 0
    const errors: string[] = []

    // Sync each employee
    console.log(`[SupabaseSync] Starting to sync ${employees.length} employees...`)
    for (const employee of employees) {
      console.log(`[SupabaseSync] Processing employee:`, {
        employeeId: employee.employee_id || employee.id,
        name: employee.name,
        storeId: employee.store_id,
      })
      try {
        const result = await syncEmployeeToSupabase(employee)
        if (result.success) {
          synced++
          console.log(`[SupabaseSync] Synced employee: ${employee.employee_id || employee.id}`)
        } else {
          failed++
          const errorMsg = `Employee ${employee.employee_id || employee.name}: ${result.error}`
          errors.push(errorMsg)
          console.error(`[SupabaseSync] Failed to sync employee:`, errorMsg)
        }
      } catch (error: any) {
        failed++
        const errorMsg = `Employee ${employee.employee_id || employee.name}: ${error?.message || String(error)}`
        errors.push(errorMsg)
        console.error(`[SupabaseSync] Exception syncing employee:`, errorMsg)
      }
    }

    console.log(`[SupabaseSync] Bulk sync completed: ${synced} synced, ${failed} failed`)

    return {
      success: failed === 0,
      synced,
      failed,
      errors
    }
  } catch (error: any) {
    console.error("[SupabaseSync] Exception in bulk sync:", error)
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [error?.message || String(error)]
    }
  }
}



