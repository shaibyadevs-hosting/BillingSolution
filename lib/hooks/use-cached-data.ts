"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode, getActiveDbModeAsync, getActiveDbMode } from "@/lib/utils/db-mode"
import { getCurrentStoreId, getCurrentStoreIdSync } from "@/lib/utils/get-current-store-id"
import { toast } from "sonner"

// Helper to get stable query key with storeId and dbMode
// Uses sync versions to avoid async in key calculation
function getQueryKey(baseKey: string[]): string[] {
    if (typeof window === "undefined") return baseKey
    
    const dbMode = getActiveDbMode()
    const storeId = getCurrentStoreIdSync()
    
    // Include dbMode and storeId in key for proper cache isolation
    // This ensures queries are cached per store and per database mode
    return [...baseKey, dbMode, storeId || "no-store"]
}

// Query keys for consistent caching (with store and dbMode included)
export const queryKeys = {
    customers: () => getQueryKey(["customers"]) as readonly string[],
    products: () => getQueryKey(["products"]) as readonly string[],
    invoices: () => getQueryKey(["invoices"]) as readonly string[],
    employees: () => getQueryKey(["employees"]) as readonly string[],
    stores: () => getQueryKey(["stores"]) as readonly string[],
    employee: (id: string) => getQueryKey(["employee", id]) as readonly string[],
    customer: (id: string) => getQueryKey(["customer", id]) as readonly string[],
    product: (id: string) => getQueryKey(["product", id]) as readonly string[],
    invoice: (id: string) => getQueryKey(["invoice", id]) as readonly string[],
    store: (id: string) => getQueryKey(["store", id]) as readonly string[],
}

// Hook to fetch customers with caching (store-scoped)
export function useCustomers() {
    return useQuery({
        queryKey: queryKeys.customers(),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'
            const storeId = await getCurrentStoreId()

            if (isIndexedDb) {
                try {
                    // IndexedDB: Filter by store_id if available, but include legacy data (null store_id)
                    if (storeId) {
                        const allCustomers = await db.customers.toArray()
                        // Include customers with matching store_id OR null/undefined store_id (legacy data)
                        return allCustomers.filter(
                            (c) => !c.store_id || c.store_id === storeId
                        )
                    }
                    // Fallback: Return all (for backward compatibility with legacy data)
                    return await db.customers.toArray()
                } catch (error) {
                    console.error("[useCustomers] Error loading from IndexedDB:", error)
                    return [] // Return empty array on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null

                if (authType === "employee") {
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useCustomers] Error fetching store:", storeError)
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                // For employees, query by store_id (RLS will allow access)
                                let query = supabase
                                    .from("customers")
                                    .select("*")
                                    .eq("user_id", userId)
                                
                                // Filter by store_id
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order("created_at", { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load customers. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useCustomers] Error fetching customers:", error)
                                    throw error
                                }
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load customer data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useCustomers] Error parsing employee session:", e)
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    // If no valid employee session, return empty
                    return []
                } else {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) userId = user.id
                }

                if (!userId) return []

                // Build query with store_id filter (for admin)
                let query = supabase
                    .from("customers")
                    .select("*")
                    .eq("user_id", userId)

                // Filter by store_id if available (store-scoped isolation)
                if (storeId) {
                    query = query.or(`store_id.is.null,store_id.eq.${storeId}`)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) {
                    console.error("[useCustomers] Error fetching customers:", error)
                    throw error
                }
                return data || []
            }
        },
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch products with caching (store-scoped)
export function useProducts() {
    return useQuery({
        queryKey: queryKeys.products(),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'
            const storeId = await getCurrentStoreId()

            if (isIndexedDb) {
                try {
                    // IndexedDB: Filter by store_id if available, but include legacy data (null store_id)
                    if (storeId) {
                        const allProducts = await db.products.toArray()
                        // Include products with matching store_id OR null/undefined store_id (legacy data)
                        return allProducts.filter(
                            (p) => !p.store_id || p.store_id === storeId
                        )
                    }
                    // Fallback: Return all (for backward compatibility with legacy data)
                    return await db.products.toArray()
                } catch (error) {
                    console.error("[useProducts] Error loading from IndexedDB:", error)
                    return [] // Return empty array on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null

                if (authType === "employee") {
                    // For employees, get admin_user_id from store to share products
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useProducts] Error fetching store:", storeError)
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                // For employees, query by store_id (RLS will allow access)
                                let query = supabase
                                    .from("products")
                                    .select("*")
                                    .eq("user_id", userId)
                                    .eq("is_active", true) // Only active products
                                
                                // Filter by store_id
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order("created_at", { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load products. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useProducts] Error fetching products:", error)
                                    throw error
                                }
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load product data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useProducts] Error parsing employee session:", e)
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    // If no valid employee session, return empty
                    return []
                } else {
                    // For admin, use their own user_id
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) userId = user.id
                }

                if (!userId) return []

                // Build query with store_id filter (shared across employees/admins with same store_id)
                let query = supabase
                    .from("products")
                    .select("*")
                    .eq("user_id", userId)

                // Filter by store_id if available (store-scoped isolation)
                if (storeId) {
                    query = query.or(`store_id.is.null,store_id.eq.${storeId}`)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) {
                    console.error("[useProducts] Error fetching products:", error)
                    throw error
                }
                return data || []
            }
        },
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch invoices with caching
export function useInvoices() {
    return useQuery({
        queryKey: queryKeys.invoices(),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    const list = await db.invoices.toArray()
                    const customers = await db.customers.toArray()
                    const customersMap = new Map(customers.map(c => [c.id, c]))
                    return list.map(inv => ({
                        ...inv,
                        customers: customersMap.get(inv.customer_id) ? { name: customersMap.get(inv.customer_id)!.name } : null
                    }))
                } catch (error) {
                    console.error("[useInvoices] Error loading from IndexedDB:", error)
                    return [] // Return empty array on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const authType = localStorage.getItem("authType")
                let userId: string | null = null
                const storeId = await getCurrentStoreId()

                if (authType === "employee") {
                    // For employees, show ALL invoices from their store (shared-store model)
                    const empSession = localStorage.getItem("employeeSession")
                    if (empSession) {
                        try {
                            const session = JSON.parse(empSession)
                            const sessionStoreId = session.storeId || storeId
                            
                            if (sessionStoreId) {
                                // Get store to find admin_user_id
                                const { data: store, error: storeError } = await supabase
                                    .from('stores')
                                    .select('admin_user_id')
                                    .eq('id', sessionStoreId)
                                    .maybeSingle()
                                
                                if (storeError) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to fetch store information. Please contact your administrator or try refreshing the page."
                                    })
                                    console.error("[useInvoices] Error fetching store:", storeError)
                                    throw storeError
                                }
                                
                                if (!store?.admin_user_id) {
                                    toast.error("Data Sync Error", {
                                        description: "Store information is incomplete. Please contact your administrator."
                                    })
                                    return []
                                }
                                
                                userId = store.admin_user_id
                                
                                // Query all invoices for this store (RLS will allow access)
                                // Filter by user_id (admin) and store_id to get all store invoices
                                // Include NULL store_id for legacy B2C invoices
                                let query = supabase
                                    .from('invoices')
                                    .select('*, customers(name)')
                                    .eq('user_id', userId)
                                
                                // Filter by store_id (include NULL for legacy data)
                                query = query.or(`store_id.is.null,store_id.eq.${sessionStoreId}`)
                                
                                const { data, error } = await query.order('created_at', { ascending: false })
                                
                                if (error) {
                                    toast.error("Data Sync Error", {
                                        description: "Unable to load invoices. Please check your connection or contact your administrator."
                                    })
                                    console.error("[useInvoices] Error fetching invoices:", error)
                                    throw error
                                }
                                
                                return data || []
                            } else {
                                toast.error("Data Sync Error", {
                                    description: "Store ID not found in employee session. Please log out and log in again."
                                })
                                return []
                            }
                        } catch (e: any) {
                            toast.error("Data Sync Error", {
                                description: "Failed to load invoice data. Please try refreshing the page or contact your administrator."
                            })
                            console.error("[useInvoices] Error parsing employee session:", e)
                            return []
                        }
                    } else {
                        toast.error("Data Sync Error", {
                            description: "Employee session not found. Please log out and log in again."
                        })
                    }
                    return []
                } else {
                    // For admin, show all invoices where user_id = admin_user_id
                    // This includes both admin-created and employee-created invoices
                    // (since employees use admin's user_id when creating invoices)
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) {
                        console.warn("[useInvoices] Admin not authenticated")
                        return []
                    }
                    userId = user.id

                    // Simple query: all invoices for this admin's user_id
                    // Filter by store_id if provided
                    let query = supabase
                        .from('invoices')
                        .select('*, customers(name)')
                        .eq('user_id', userId)
                    
                    // Optionally filter by store_id
                    if (storeId) {
                        query = query.eq('store_id', storeId)
                    }

                    const { data, error } = await query.order('created_at', { ascending: false })
                    
                    if (error) {
                        console.error("[useInvoices] Error fetching invoices:", error)
                        toast.error("Data Sync Error", {
                            description: `Unable to fetch invoices: ${error.message}. Please try refreshing the page.`
                        })
                        throw error
                    }
                    
                    return data || []
                }
            }
        },
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch employees with caching
export function useEmployees() {
    return useQuery({
        queryKey: queryKeys.employees(),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'
            const storeId = await getCurrentStoreId()

            if (isIndexedDb) {
                try {
                    const allEmployees: any[] = await db.employees.toArray()

                    // Store-scoped filtering (include legacy/null store_id for backward compatibility)
                    const filtered = storeId
                        ? allEmployees.filter((e) => !e.store_id || e.store_id === storeId)
                        : allEmployees

                    // Attach store info to match Supabase shape: `employee.stores`
                    const uniqueStoreIds = Array.from(
                        new Set(
                            filtered
                                .map((e) => e.store_id)
                                .filter((id): id is string => typeof id === "string" && id.length > 0)
                        )
                    )

                    if (uniqueStoreIds.length > 0) {
                        const stores = await db.stores.bulkGet(uniqueStoreIds)
                        const storeById = new Map<string, any>()
                        uniqueStoreIds.forEach((id, idx) => storeById.set(id, stores[idx] || null))

                        const withStores = filtered.map((e) => {
                            // Keep existing nested stores if it already exists (e.g., saved from Supabase response)
                            if (e?.stores?.name) return e
                            const s = e.store_id ? storeById.get(e.store_id) : null
                            return s ? { ...e, stores: s } : e
                        })

                        // Match Supabase ordering (newest first) when timestamps exist
                        withStores.sort((a: any, b: any) => {
                            const aTs = a?.created_at || a?.updated_at || ""
                            const bTs = b?.created_at || b?.updated_at || ""
                            return String(bTs).localeCompare(String(aTs))
                        })

                        return withStores
                    }

                    filtered.sort((a: any, b: any) => {
                        const aTs = a?.created_at || a?.updated_at || ""
                        const bTs = b?.created_at || b?.updated_at || ""
                        return String(bTs).localeCompare(String(aTs))
                    })

                    return filtered
                } catch (error) {
                    console.error("[useEmployees] Error loading from IndexedDB:", error)
                    return [] // Return empty array on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                let query = supabase
                    .from("employees")
                    .select("*, stores(name, store_code)")
                    .eq("user_id", user.id)
                
                if (storeId) {
                    query = query.eq("store_id", storeId)
                }

                const { data, error } = await query.order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch stores with caching
export function useStores() {
    return useQuery({
        queryKey: queryKeys.stores(),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    return await db.stores.toArray()
                } catch (error) {
                    console.error("[useStores] Error loading from IndexedDB:", error)
                    return [] // Return empty array on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return []

                const { data, error } = await supabase
                    .from("stores")
                    .select("*")
                    .eq("admin_user_id", user.id)
                    .order("created_at", { ascending: false })

                if (error) throw error
                return data || []
            }
        },
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch a single store by ID
export function useStore(id: string) {
    return useQuery({
        queryKey: queryKeys.store(id),
        queryFn: async () => {
            const isIndexedDb = isIndexedDbMode()

            if (isIndexedDb) {
                try {
                    return await db.stores.get(id) || null
                } catch (error) {
                    console.error("[useStore] Error loading from IndexedDB:", error)
                    return null // Return null on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("stores")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch a single employee by ID
export function useEmployee(id: string) {
    return useQuery({
        queryKey: queryKeys.employee(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    const employee = await db.employees.get(id)
                    if (!employee) return null

                    // Get store info if store_id exists
                    if (employee.store_id) {
                        const store = await db.stores.get(employee.store_id)
                        return { ...employee, stores: store }
                    }
                    return employee
                } catch (error) {
                    console.error("[useEmployee] Error loading from IndexedDB:", error)
                    return null // Return null on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("employees")
                    .select("*, stores(name, store_code)")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single customer by ID
export function useCustomer(id: string) {
    return useQuery({
        queryKey: queryKeys.customer(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    return await db.customers.get(id) || null
                } catch (error) {
                    console.error("[useCustomer] Error loading from IndexedDB:", error)
                    return null // Return null on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to fetch a single product by ID
export function useProduct(id: string) {
    return useQuery({
        queryKey: queryKeys.product(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    return await db.products.get(id) || null
                } catch (error) {
                    console.error("[useProduct] Error loading from IndexedDB:", error)
                    return null // Return null on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
    })
}

// Hook to fetch a single invoice by ID with items
export function useInvoice(id: string) {
    return useQuery({
        queryKey: queryKeys.invoice(id),
        queryFn: async () => {
            // Use async mode detection to properly inherit from admin for employees
            const dbMode = await getActiveDbModeAsync()
            const isIndexedDb = dbMode === 'indexeddb'

            if (isIndexedDb) {
                try {
                    const invoice = await db.invoices.get(id)
                    if (!invoice) return null

                    // Get customer info
                    const customer = await db.customers.get(invoice.customer_id)

                    // Get employee info if invoice was created by employee
                    let employee = null
                    if (invoice.created_by_employee_id || invoice.employee_id) {
                        const employeeId = invoice.created_by_employee_id || invoice.employee_id
                        employee = await db.employees.where("employee_id").equals(employeeId).first()
                    }

                    // Get invoice items
                    const items = await db.invoice_items.where("invoice_id").equals(id).toArray()

                    return {
                        ...invoice,
                        customers: customer || null,
                        employees: employee ? { name: employee.name, employee_id: employee.employee_id } : null,
                        invoice_items: items,
                    }
                } catch (error) {
                    console.error("[useInvoice] Error loading from IndexedDB:", error)
                    return null // Return null on error (offline mode)
                }
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("invoices")
                    .select("*, customers(*), invoice_items(*)")
                    .eq("id", id)
                    .single()

                if (error) throw error
                return data
            }
        },
        enabled: !!id,
        staleTime: (() => {
            const dbMode = getActiveDbMode()
            return dbMode === 'indexeddb' ? 30 * 60 * 1000 : 5 * 60 * 1000
        })(),
    })
}

// Hook to invalidate cache when data changes
export function useInvalidateQueries() {
    const queryClient = useQueryClient()

    return {
        invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
        invalidateProducts: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
        invalidateInvoices: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        invalidateEmployees: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
        invalidateStores: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
        invalidateStore: (id: string) => queryClient.invalidateQueries({ queryKey: ["store", id] }),
        invalidateEmployee: (id: string) => queryClient.invalidateQueries({ queryKey: ["employee", id] }),
        invalidateCustomer: (id: string) => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
        invalidateProduct: (id: string) => queryClient.invalidateQueries({ queryKey: ["product", id] }),
        invalidateInvoice: (id: string) => queryClient.invalidateQueries({ queryKey: ["invoice", id] }),
        invalidateAll: () => queryClient.invalidateQueries(),
    }
}
