"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { getCurrentStoreId } from "@/lib/utils/get-current-store-id"
import { getB2BModeStatus } from "@/lib/utils/b2b-mode"

interface Customer {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  gstin?: string | null
  billing_address?: string | null
  shipping_address?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

interface CustomerFormProps {
  customer?: Customer
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    gstin: customer?.gstin || "",
    billing_address: customer?.billing_address || "",
    shipping_address: customer?.shipping_address || "",
    notes: customer?.notes || "",
  })
  const [isB2BEnabled, setIsB2BEnabled] = useState(false)

  // Load B2B mode status
  useEffect(() => {
    const loadB2BStatus = async () => {
      try {
        const b2bEnabled = await getB2BModeStatus()
        setIsB2BEnabled(b2bEnabled)
      } catch (error) {
        console.error('Failed to load B2B status:', error)
      }
    }
    loadB2BStatus()
  }, [])

  // Load existing customers for autocomplete
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        // Use async mode detection to properly inherit from admin for employees
        const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
        const dbMode = await getActiveDbModeAsync()
        const isIndexedDb = dbMode === 'indexeddb'
        if (isIndexedDb) {
          // IndexedDB mode - load from IndexedDB
          const customers = await db.customers.toArray()
          setExistingCustomers(customers as Customer[])
        } else {
          // Supabase mode - load from Supabase
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            // Handle employee auth
            const authType = localStorage.getItem("authType")
            let userId = user.id
            if (authType === "employee") {
              const empSession = localStorage.getItem("employeeSession")
              if (empSession) {
                const session = JSON.parse(empSession)
                const sessionStoreId = session.storeId
                if (sessionStoreId) {
                  const { data: store } = await supabase
                    .from("stores")
                    .select("admin_user_id")
                    .eq("id", sessionStoreId)
                    .single()
                  if (store?.admin_user_id) {
                    userId = store.admin_user_id
                  }
                }
              }
            }

            const { data: customers } = await supabase
              .from("customers")
              .select("*")
              .eq("user_id", userId)
            setExistingCustomers((customers || []) as Customer[])
          }
        }
      } catch (error) {
        console.error('Failed to load customers:', error)
      }
    }
    loadCustomers()
  }, [])

  // Filter customers based on name input
  const filteredCustomers = existingCustomers.filter(c =>
    c.id !== customer?.id && // Exclude current customer when editing
    c.name.toLowerCase().includes(formData.name.toLowerCase())
  ).slice(0, 5) // Show max 5 suggestions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone?.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    // B2B validation: GSTIN and billing address are mandatory when B2B is enabled
    if (isB2BEnabled) {
      if (!formData.gstin?.trim()) {
        toast({
          title: "B2B Validation Error",
          description: "GSTIN is required when B2B mode is enabled",
          variant: "destructive",
        });
        return;
      }
      if (!formData.billing_address?.trim()) {
        toast({
          title: "B2B Validation Error",
          description: "Billing address is required when B2B mode is enabled",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Use async mode detection to properly inherit from admin for employees
      const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
      const dbMode = await getActiveDbModeAsync()
      const isIndexedDb = dbMode === 'indexeddb'
      const storeId = await getCurrentStoreId()
      const id = customer?.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()))
      
      if (isIndexedDb) {
        // IndexedDB mode
        const customerData = { 
          id, 
          ...formData, 
          gstin: formData.gstin || null, 
          store_id: storeId || null,
          created_at: customer?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        if (customer?.id) {
          await storageManager.updateCustomer(customerData)
        } else {
          await storageManager.addCustomer(customerData)
        }
        toast({ title: "Success", description: customer?.id ? "Customer updated" : "Customer created" })
      } else {
        // Supabase mode
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast({ title: "Error", description: "Not authenticated", variant: "destructive" })
          return
        }

        // Handle employee auth
        const authType = localStorage.getItem("authType")
        let userId = user.id
        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            const session = JSON.parse(empSession)
            const sessionStoreId = session.storeId
            if (sessionStoreId) {
              const { data: store } = await supabase
                .from("stores")
                .select("admin_user_id")
                .eq("id", sessionStoreId)
                .single()
              if (store?.admin_user_id) {
                userId = store.admin_user_id
              }
            }
          }
        }

        const customerData = {
          id: customer?.id,
          user_id: userId,
          store_id: storeId || null, // Store-scoped isolation
          name: formData.name.trim(),
          email: formData.email?.trim() || null,
          phone: formData.phone?.trim() || null,
          gstin: formData.gstin?.trim() || null,
          billing_address: formData.billing_address?.trim() || null,
          shipping_address: formData.shipping_address?.trim() || null,
          notes: formData.notes?.trim() || null,
        }

        if (customer?.id) {
          const { error } = await supabase
            .from("customers")
            .update(customerData)
            .eq("id", customer.id)
          if (error) throw error
          toast({ title: "Success", description: "Customer updated" })
        } else {
          const { error } = await supabase
            .from("customers")
            .insert(customerData)
          if (error) throw error
          toast({ title: "Success", description: "Customer created" })
        }
      }
      
      router.push(customer?.id ? `/customers/${customer.id}` : "/customers")
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    setShowSuggestions(e.target.value.length > 0)
                  }}
                  onFocus={() => {
                    if (formData.name.length > 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow clicks on suggestions
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  placeholder="e.g., John Doe"
                  autoComplete="off"
                />
                {showSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-auto">
                    <div className="p-1">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Existing Customers</div>
                      {filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          className="px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setFormData({
                              name: c.name,
                              email: c.email || "",
                              phone: c.phone || "",
                              gstin: c.gstin || "",
                              billing_address: c.billing_address || "",
                              shipping_address: c.shipping_address || "",
                              notes: c.notes || "",
                            })
                            setShowSuggestions(false)
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{c.name}</span>
                            {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                required
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">
                GSTIN {isB2BEnabled && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="29ABCDE1234F1Z5"
                required={isB2BEnabled}
              />
              {isB2BEnabled && (
                <p className="text-xs text-muted-foreground">
                  GSTIN is required for B2B transactions
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address">
              Billing Address {isB2BEnabled && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="billing_address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              placeholder="Street, City, State, PIN"
              rows={3}
              required={isB2BEnabled}
            />
            {isB2BEnabled && (
              <p className="text-xs text-muted-foreground">
                Billing address is required for B2B transactions
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping_address">Shipping Address</Label>
            <Textarea
              id="shipping_address"
              value={formData.shipping_address}
              onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
              placeholder="Street, City, State, PIN (leave blank if same as billing)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this customer..."
              rows={3}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : customer ? "Update Customer" : "Create Customer"}
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
