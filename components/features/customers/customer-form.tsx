"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db/dexie"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

interface Customer {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  gstin?: string | null
  billing_address?: string | null
  shipping_address?: string | null
  notes?: string | null
}

interface CustomerFormProps {
  customer?: Customer
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    gstin: customer?.gstin || "",
    billing_address: customer?.billing_address || "",
    shipping_address: customer?.shipping_address || "",
    notes: customer?.notes || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
        const id = customer?.id || crypto.randomUUID();
        let excelResult = null;
        try {
          if (customer?.id) {
            excelResult = excelSheetManager.update('customers', id, { ...formData, id })
          } else {
            excelResult = excelSheetManager.add('customers', { ...formData, id })
          }
        } catch (excelError) {
          console.error('[CustomerForm] Excel add/update threw error:', excelError);
          window.alert(
            'Excel Save Failed: ' +
            (excelError instanceof Error && excelError.message
              ? excelError.message
              : JSON.stringify(excelError))
          );
          throw excelError;
        }
        console.log('[CustomerForm] Excel add/update result:', excelResult)
        toast({
          title: "Success",
          description: `Customer ${customer?.id ? "updated" : "created"} in Excel`,
        })
        router.push(customer?.id ? `/customers/${id}` : "/customers")
        router.refresh()
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      if (customer?.id) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customer.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Customer updated successfully",
        })
        router.push(`/customers/${customer.id}`)
      } else {
        // Create new customer
        const { error } = await supabase.from("customers").insert({
          ...formData,
          user_id: user.id,
        })

        if (error) throw error

        toast({
          title: "Success",
          description: "Customer created successfully",
        })
        router.push("/customers")
      }

      router.refresh()
    } catch (error) {
      console.error('[CustomerForm] Error in Excel/DB add/update:', error);
      toast({
        title: "Error",
        description:
          (error instanceof Error ? error.message : "Failed to save customer") +
          (error && typeof error === 'object' ? '\n' + JSON.stringify(error) : ''),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Doe"
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
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address">Billing Address</Label>
            <Textarea
              id="billing_address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              placeholder="Street, City, State, PIN"
              rows={3}
            />
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
