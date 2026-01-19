"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { db, type Store } from "@/lib/dexie-client"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/utils/store-context"
import { useRouter } from "next/navigation"

export default function StorePage() {
  const { currentStore, setCurrentStore, loading } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    gstin: "",
    phone: "",
  })

  useEffect(() => {
    if (currentStore) {
      setFormData({
        name: currentStore.name || "",
        address: currentStore.address || "",
        gstin: currentStore.gstin || "",
        phone: currentStore.phone || "",
      })
    }
  }, [currentStore])

  const generateStoreCode = (name: string): string => {
    // Remove special characters and convert to uppercase
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
    
    // If we have at least 4 characters, take first 4
    if (cleaned.length >= 4) return cleaned.slice(0, 4)
    
    // If less than 4, pad with X
    return cleaned.padEnd(4, "X")
  }

  const getStoreCodeDisplay = (): string => {
    if (currentStore?.store_code) return currentStore.store_code
    if (formData.name) return generateStoreCode(formData.name)
    return "XXXX"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // Update store code if store name changed
      const storeCode = currentStore?.store_code && currentStore.name === formData.name 
        ? currentStore.store_code 
        : generateStoreCode(formData.name)
      
      // Prepare store data
      const storeData: Store = {
        id: currentStore?.id || crypto.randomUUID(),
        name: formData.name,
        store_code: storeCode,
        admin_user_id: currentStore?.admin_user_id || "", // Will be set when syncing to Supabase
        address: formData.address || undefined,
        gstin: formData.gstin || undefined,
        phone: formData.phone || undefined,
        created_at: currentStore?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      // ALWAYS save to local database (Dexie) first - default storage
      await db.stores.put(storeData)
      console.log("[StorePage] Store saved to local database (Dexie)")
      
      // Update context and localStorage
      setCurrentStore(storeData)
      localStorage.setItem("currentStoreId", storeData.id)
      
      // Refresh the page context to ensure store is loaded everywhere
      router.refresh()
      
      toast({ 
        title: "Success", 
        description: currentStore ? "Store updated successfully in local database" : "Store created successfully in local database" 
      })
      
      // Don't redirect - let user stay on settings page to see other settings
      // User can click "Sync to Supabase" button if they want to sync
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save store",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncToSupabase = async () => {
    if (!currentStore) {
      toast({ 
        title: "Error", 
        description: "No store to sync. Please save the store first.", 
        variant: "destructive" 
      })
      return
    }

    setIsLoading(true)
    try {
      const { syncStoreToSupabase } = await import("@/lib/utils/supabase-sync")
      const result = await syncStoreToSupabase(currentStore)
      
      if (result.success) {
        toast({ 
          title: "Success", 
          description: "Store synced to Supabase successfully" 
        })
        // Refresh to update context
        router.refresh()
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to sync store to Supabase",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sync store",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Store Settings</h1>
        <p className="text-muted-foreground">Manage your store information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStore ? "Edit Store" : "Create Store"}</CardTitle>
          <CardDescription>
            {currentStore 
              ? "Update your store information. Store code cannot be changed."
              : "Create a new store. A unique 4-character store code will be generated."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStore && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Store Code: {currentStore.store_code}</p>
              <p className="text-xs text-muted-foreground">Store code cannot be changed after creation</p>
            </div>
          )}
          {!currentStore && formData.name && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm font-medium">Preview Store Code: {getStoreCodeDisplay()}</p>
              <p className="text-xs text-muted-foreground">This code will be generated when you create the store</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Store Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Store"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="29ABCDE1234F1Z5"
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

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : currentStore ? "Update Store" : "Create Store"}
            </Button>
          </form>
          
          {/* Sync to Supabase button - only show if store exists */}
          {currentStore && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Store is saved locally. Click below to sync to Supabase cloud storage.
              </p>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleSyncToSupabase}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Syncing..." : "Sync to Supabase"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

