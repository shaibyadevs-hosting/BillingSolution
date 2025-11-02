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
      // Validate required fields
      if (!employeeData.name) {
        return { success: false, error: "Employee name is required" }
      }
      if (!employeeData.email) {
        return { success: false, error: "Employee email is required" }
      }
      
      // Prepare insert data with defaults for nullable fields
      const insertData: any = {
        id: employeeData.id,
        user_id: user.id,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone || null,
        role: employeeData.role || 'employee',
        salary: employeeData.salary ?? null,
        joining_date: employeeData.joining_date 
          ? (employeeData.joining_date.includes('T') 
              ? employeeData.joining_date.split('T')[0] 
              : employeeData.joining_date)
          : new Date().toISOString().split('T')[0], // Default to today if not provided
        is_active: employeeData.is_active ?? true,
        employee_id: employeeData.employee_id || null,
        password: employeeData.password || null,
        store_id: employeeData.store_id || null,
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
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn("[SupabaseSync] No user authenticated, skipping store sync")
      return { success: false, error: "Not authenticated" }
    }

    // Check if store exists in Supabase
    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeData.id)
      .single()

    if (existing) {
      // Update existing store
      const { error } = await supabase
        .from("stores")
        .update({
          name: storeData.name,
          store_code: storeData.store_code,
          address: storeData.address,
          gstin: storeData.gstin,
          phone: storeData.phone,
        })
        .eq("id", storeData.id)

      if (error) {
        console.error("[SupabaseSync] Error updating store:", error)
        return { success: false, error: error.message }
      }
    } else {
      // Create new store
      const { error } = await supabase
        .from("stores")
        .insert({
          id: storeData.id,
          admin_user_id: user.id,
          name: storeData.name,
          store_code: storeData.store_code,
          address: storeData.address,
          gstin: storeData.gstin,
          phone: storeData.phone,
        })

      if (error) {
        console.error("[SupabaseSync] Error creating store:", error)
        return { success: false, error: error.message }
      }
    }

    console.log("[SupabaseSync] Store synced successfully:", storeData.store_code)
    return { success: true }
  } catch (error: any) {
    console.error("[SupabaseSync] Exception syncing store:", error)
    return { success: false, error: error.message }
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



