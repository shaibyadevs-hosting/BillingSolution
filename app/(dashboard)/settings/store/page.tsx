"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { db, type Store } from "@/lib/dexie-client"
import { createClient } from "@/lib/supabase/client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"
import { useRouter } from "next/navigation"

export default function StorePage() {
  const { currentStore, setCurrentStore, loading } = useStore()
  const { toast } = useToast()
  const router = useRouter()
  const isExcel = getDatabaseType() === 'excel'
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
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (cleaned.length >= 4) return cleaned.slice(0, 4)
    return cleaned.padEnd(4, "X")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isExcel) {
        if (currentStore) {
          // Update existing store
          await db.stores.update(currentStore.id, {
            name: formData.name,
            address: formData.address,
            gstin: formData.gstin,
            phone: formData.phone,
          })
          const updated = await db.stores.get(currentStore.id)
          if (updated) setCurrentStore(updated)
          toast({ title: "Success", description: "Store updated successfully" })
          // Wait a bit for state to update, then redirect
          await new Promise(resolve => setTimeout(resolve, 500))
          router.push("/dashboard")
          router.refresh()
        } else {
          // Create new store
          const storeCode = generateStoreCode(formData.name)
          const store: Store = {
            id: crypto.randomUUID(),
            name: formData.name,
            store_code: storeCode,
            address: formData.address,
            gstin: formData.gstin,
            phone: formData.phone,
            created_at: new Date().toISOString(),
          }
          await db.stores.put(store)
          setCurrentStore(store)
          localStorage.setItem("currentStoreId", store.id)
          toast({ title: "Success", description: "Store created successfully" })
          // Wait a bit for state to update, then redirect
          await new Promise(resolve => setTimeout(resolve, 500))
          router.push("/dashboard")
          router.refresh()
        }
      } else {
        // Supabase mode
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast({ title: "Error", description: "Not authenticated", variant: "destructive" })
          return
        }
        
        if (currentStore) {
          // Update existing store
          const { data, error: updateError } = await supabase
            .from("stores")
            .update({
              name: formData.name,
              address: formData.address,
              gstin: formData.gstin,
              phone: formData.phone,
            })
            .eq("id", currentStore.id)
            .select()
            .single()
          
          if (updateError) throw updateError
          
          if (data) {
            setCurrentStore(data as any)
            localStorage.setItem("currentStoreId", data.id)
            toast({ title: "Success", description: "Store updated successfully" })
            // Wait a bit for state to update, then redirect
            await new Promise(resolve => setTimeout(resolve, 500))
            router.push("/dashboard")
            router.refresh()
          }
        } else {
          // Create new store
          const storeCode = generateStoreCode(formData.name)
          const { data, error } = await supabase.from("stores").insert({
            name: formData.name,
            store_code: storeCode,
            admin_user_id: user.id,
            address: formData.address,
            gstin: formData.gstin,
            phone: formData.phone,
          }).select().single()
          
          if (error) throw error
          if (data) {
            setCurrentStore(data as any)
            localStorage.setItem("currentStoreId", data.id)
            toast({ title: "Success", description: "Store created successfully" })
            // Wait a bit for state to update, then redirect
            await new Promise(resolve => setTimeout(resolve, 500))
            router.push("/dashboard")
            router.refresh()
          }
        }
      }
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
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : currentStore ? "Update Store" : "Create Store"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

