"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { v4 as uuidv4 } from "uuid"
import { PRODUCT_CATEGORIES } from "@/lib/constants/product-categories"
import { PRODUCT_UNITS } from "@/lib/constants/product-units"
import { useInvalidateQueries } from "@/lib/hooks/use-cached-data"
import { db } from "@/lib/dexie-client"
import { getB2BModeStatus } from "@/lib/utils/b2b-mode"
import {
  validateProductPrice,
  validateProductCost,
  validateStockQuantity,
  validateGstRate
} from "@/lib/utils/db-validation"
import { Plus } from "lucide-react"

interface Product {
  id?: string
  name: string
  sku?: string | null
  category?: string | null
  price: number
  cost_price?: number | null
  stock_quantity: number
  unit: string
  hsn_code?: string | null
  gst_rate: number
  is_active: boolean
}

interface ProductFormProps {
  product?: Product
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { invalidateProducts } = useInvalidateQueries()
  const [isLoading, setIsLoading] = useState(false)
  const [showCustomUnit, setShowCustomUnit] = useState(false)
  const [customUnit, setCustomUnit] = useState("")
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

  const [formData, setFormData] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    category: product?.category || "",
    price: product?.price || 0,
    cost_price: product?.cost_price || 0,
    stock_quantity: product?.stock_quantity || 0,
    unit: product?.unit || "piece",
    hsn_code: product?.hsn_code || "",
    gst_rate: product?.gst_rate || 18,
    is_active: product?.is_active ?? true,
    selling_unit: product?.selling_unit || null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Validate selling price >= cost price
      if (formData.cost_price && formData.price < formData.cost_price) {
        toast({
          title: "Validation Error",
          description: "Selling price cannot be less than cost price",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validate price
      const priceValidation = validateProductPrice(formData.price);
      if (!priceValidation.isValid) {
        toast({
          title: "Validation Error",
          description: priceValidation.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validate cost price
      const costValidation = validateProductCost(formData.cost_price || 0);
      if (!costValidation.isValid) {
        toast({
          title: "Validation Error",
          description: costValidation.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validate stock quantity
      const stockValidation = validateStockQuantity(formData.stock_quantity);
      if (!stockValidation.isValid) {
        toast({
          title: "Validation Error",
          description: stockValidation.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validate GST rate
      const gstValidation = validateGstRate(formData.gst_rate);
      if (!gstValidation.isValid) {
        toast({
          title: "Validation Error",
          description: gstValidation.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // B2B validation: HSN code and GST rate are mandatory when B2B is enabled
      if (isB2BEnabled) {
        if (!formData.hsn_code?.trim()) {
          toast({
            title: "B2B Validation Error",
            description: "HSN code is required when B2B mode is enabled",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (!formData.gst_rate || formData.gst_rate <= 0) {
          toast({
            title: "B2B Validation Error",
            description: "GST rate is required and must be greater than 0 when B2B mode is enabled",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Check for duplicate product (same name and category)
      // Use async mode detection to properly inherit from admin for employees
      const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
      const dbMode = await getActiveDbModeAsync()
      const isIndexedDb = dbMode === 'indexeddb'
      if (!product?.id) { // Only check for new products
        if (isIndexedDb) {
          const existingProducts = await db.products.toArray();
          const duplicate = existingProducts.find(
            p => p.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
              (p.category || '').toLowerCase().trim() === (formData.category || '').toLowerCase().trim()
          );
          if (duplicate) {
            toast({
              title: "Duplicate Product",
              description: `A product with name "${formData.name}" in category "${formData.category || 'Uncategorized'}" already exists`,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: existingProducts } = await supabase
              .from('products')
              .select('id, name, category')
              .eq('user_id', user.id)
              .ilike('name', formData.name.trim())
              .limit(10);

            const duplicate = existingProducts?.find(
              p => p.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
                (p.category || '').toLowerCase().trim() === (formData.category || '').toLowerCase().trim()
            );
            if (duplicate) {
              toast({
                title: "Duplicate Product",
                description: `A product with name "${formData.name}" in category "${formData.category || 'Uncategorized'}" already exists`,
                variant: "destructive",
              });
              setIsLoading(false);
              return;
            }
          }
        }
      }

      // Get current store ID for store-scoped isolation
      const { getCurrentStoreId } = await import("@/lib/utils/get-current-store-id")
      const storeId = await getCurrentStoreId()

      // Prepare payload with proper data formatting
      const now = new Date().toISOString()
      const payload: any = { 
        id: product?.id || uuidv4(), 
        name: formData.name.trim(),
        sku: formData.sku?.trim() || null,
        category: formData.category?.trim() || null,
        price: Number(formData.price) || 0,
        cost_price: formData.cost_price ? Number(formData.cost_price) : null,
        stock_quantity: Number(formData.stock_quantity) || 0,
        unit: formData.unit || "piece",
        hsn_code: formData.hsn_code?.trim() || null,
        gst_rate: Number(formData.gst_rate) || 0,
        is_active: formData.is_active ?? true,
        selling_unit: formData.selling_unit || null,
        store_id: storeId || null,
        // Add timestamps for IndexedDB
        created_at: product?.id ? undefined : now,
        updated_at: now,
      }

      if (isIndexedDb) {
        // Save to Dexie
        try {
          if (product?.id) {
            await storageManager.updateProduct(payload)
            toast({ title: "Success", description: "Product updated" })
          } else {
            await storageManager.addProduct(payload)
            toast({ title: "Success", description: "Product created" })
          }
        } catch (dbError: any) {
          console.error("[ProductForm] IndexedDB error:", dbError)
          throw new Error(`Failed to save product: ${dbError?.message || "Database error"}`)
        }
      } else {
        // Save to Supabase
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null
        let finalStoreId = storeId

        // Handle employee auth - get admin_user_id from store
        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            try {
              const session = JSON.parse(empSession)
              finalStoreId = session.storeId || storeId
              
              if (finalStoreId) {
                const { data: store } = await supabase
                  .from('stores')
                  .select('admin_user_id')
                  .eq('id', finalStoreId)
                  .single()
                
                if (store?.admin_user_id) {
                  userId = store.admin_user_id
                } else {
                  throw new Error("Store information not found. Please contact your administrator.")
                }
              } else {
                throw new Error("Store ID not found in employee session.")
              }
            } catch (e: any) {
              console.error("[ProductForm] Employee session error:", e)
              toast({ 
                title: "Error", 
                description: e.message || "Failed to get store information", 
                variant: "destructive" 
              })
              setIsLoading(false)
              return
            }
          } else {
            toast({ 
              title: "Error", 
              description: "Employee session not found. Please log out and log in again.", 
              variant: "destructive" 
            })
            setIsLoading(false)
            return
          }
        } else {
          // For admin users
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            toast({ title: "Error", description: "Not authenticated", variant: "destructive" })
            setIsLoading(false)
            return
          }
          userId = user.id
        }

        if (!userId) {
          toast({ title: "Error", description: "Could not determine user ID", variant: "destructive" })
          setIsLoading(false)
          return
        }

        // Prepare Supabase data (remove IndexedDB-specific fields, add user_id)
        const productData: any = {
          id: payload.id,
          name: payload.name,
          sku: payload.sku,
          category: payload.category,
          price: payload.price,
          cost_price: payload.cost_price,
          stock_quantity: payload.stock_quantity,
          unit: payload.unit,
          hsn_code: payload.hsn_code,
          gst_rate: payload.gst_rate,
          is_active: payload.is_active,
          user_id: userId,
          store_id: finalStoreId || null,
        }

        // Add selling_unit if it exists (check if column exists in Supabase)
        if (payload.selling_unit !== undefined) {
          productData.selling_unit = payload.selling_unit
        }

        if (product?.id) {
          const { error } = await supabase.from("products").update(productData).eq("id", product.id)
          if (error) {
            console.error("[ProductForm] Supabase update error:", error)
            throw new Error(`Failed to update product: ${error.message}`)
          }
          toast({ title: "Success", description: "Product updated" })
        } else {
          const { error } = await supabase.from("products").insert(productData)
          if (error) {
            console.error("[ProductForm] Supabase insert error:", error)
            throw new Error(`Failed to create product: ${error.message}`)
          }
          toast({ title: "Success", description: "Product created" })
        }
      }

      // Invalidate cache for instant UI update
      await invalidateProducts();

      router.push("/products")
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save product",
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
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., iPhone 15 Pro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g., IP15P-256-BLK"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              {!showCustomUnit ? (
                <div className="flex gap-2">
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setShowCustomUnit(true)
                        setCustomUnit("")
                      } else {
                        setFormData({ ...formData, unit: value })
                      }
                    }}
                  >
                    <SelectTrigger id="unit" className="flex-1">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          <span>Add Custom Unit</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="custom-unit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Enter custom unit"
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (customUnit.trim()) {
                        setFormData({ ...formData, unit: customUnit.trim() })
                        setShowCustomUnit(false)
                        setCustomUnit("")
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCustomUnit(false)
                      setCustomUnit("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">
                Selling Price (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_unit">Selling Unit Type</Label>
              <Select
                value={formData.selling_unit || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, selling_unit: value === "__none__" ? null : value as "loose" | "together" })
                }
              >
                <SelectTrigger id="selling_unit">
                  <SelectValue placeholder="Select selling unit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (Default)</SelectItem>
                  <SelectItem value="loose">Loose</SelectItem>
                  <SelectItem value="together">Together</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how this product is typically sold
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price (₹)</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: Number.parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_quantity">
                Stock Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock_quantity"
                type="number"
                required
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: Number.parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gst_rate">GST Rate (%)</Label>
              <Input
                id="gst_rate"
                type="number"
                step="0.01"
                value={formData.gst_rate}
                onChange={(e) => setFormData({ ...formData, gst_rate: Number.parseFloat(e.target.value) || 0 })}
                placeholder="18"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsn_code">HSN Code</Label>
              <Input
                id="hsn_code"
                value={formData.hsn_code || ""}
                onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                placeholder="e.g., 8517"
              />
              <p className="text-xs text-muted-foreground">
                {isB2BEnabled ? "Required for B2B invoices" : "Optional - Required for B2B invoices"}
              </p>
            </div>

          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : product ? "Update Product" : "Create Product"}
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
