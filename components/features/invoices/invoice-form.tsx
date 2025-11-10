"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Trash2, Search, X, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { calculateLineItem, roundToTwo } from "@/lib/utils/gst-calculator"
import { Switch } from "@/components/ui/switch"
import { storageManager } from "@/lib/storage-manager"
import { InlineCustomerForm } from "@/components/features/customers/inline-customer-form"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"

interface Customer {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  price: number
  gst_rate: number
  hsn_code: string | null
  unit: string
  stock_quantity?: number
  sku?: string | null
  category?: string | null
}

interface BusinessSettings {
  invoice_prefix: string
  next_invoice_number: number
  default_gst_rate: number
  place_of_supply: string | null
}

interface InvoiceFormProps {
  customers: Customer[]
  products: Product[]
  settings: BusinessSettings | null
  storeId?: string | null
  employeeId?: string
  onCustomersUpdate?: (customers: Customer[]) => void
}

// LineItem interface for form state
interface LineItem {
  id: string;
  invoice_id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_rate: number;
  hsn_code?: string;
  line_total?: number;
  gst_amount?: number;
  created_at?: string;
}

export function InvoiceForm({ customers, products, settings, storeId, employeeId, onCustomersUpdate }: InvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers)
  
  // Update local customers when prop changes
  useEffect(() => {
    setLocalCustomers(customers)
  }, [customers])
  
  useEffect(() => {
    // Generate invoice number on mount if we have store/employee
    if (storeId && employeeId) {
      const isExcel = typeof window !== 'undefined' && localStorage.getItem('databaseType') !== 'supabase'
      if (isExcel) {
        import("@/lib/utils/invoice-number").then(({ generateInvoiceNumber }) => {
          generateInvoiceNumber(storeId, employeeId).then(num => setInvoiceNumber(num))
        })
      } else {
        import("@/lib/utils/invoice-number-supabase").then(({ generateInvoiceNumberSupabase }) => {
          generateInvoiceNumberSupabase(storeId, employeeId).then(num => setInvoiceNumber(num))
        })
      }
    } else {
      // Fallback to old format
      setInvoiceNumber(`${settings?.invoice_prefix || "INV"}-${String(settings?.next_invoice_number || 1).padStart(4, "0")}`)
    }
  }, [storeId, employeeId, settings])
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [isGstInvoice, setIsGstInvoice] = useState(true)
  const [isSameState, setIsSameState] = useState(true)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")
  const [showProductWindow, setShowProductWindow] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      product_id: null,
      description: "",
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      gst_rate: settings?.default_gst_rate || 18,
      hsn_code: "",
    },
  ])

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        gst_rate: settings?.default_gst_rate || 18,
        hsn_code: "",
      },
    ])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          // If product is selected, auto-fill details
          if (field === "product_id" && value) {
            const product = products.find((p) => p.id === value)
            if (product) {
              return {
                ...item,
                product_id: value,
                description: product.name,
                unit_price: product.price,
                gst_rate: product.gst_rate,
                hsn_code: product.hsn_code || "",
              }
            }
          }
          return { ...item, [field]: value }
        }
        return item
      }),
    )
  }

  // Calculate frequently bought products (products that appear most in lineItems)
  const frequentlyBoughtProducts = useMemo(() => {
    // For now, we'll show products with stock > 0, sorted by name
    // In a real app, you'd track purchase frequency from invoice_items
    return products
      .filter(p => p.stock_quantity > 0)
      .slice(0, 8)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products.filter(p => p.stock_quantity > 0)
    const search = productSearchTerm.toLowerCase()
    return products.filter(
      p => p.stock_quantity > 0 && (
        p.name.toLowerCase().includes(search) ||
        p.sku?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search)
      )
    )
  }, [products, productSearchTerm])

  // Add product to invoice
  const addProductToInvoice = (product: Product) => {
    const newLineItem: LineItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: product.price,
      discount_percent: 0,
      gst_rate: product.gst_rate,
      hsn_code: product.hsn_code || "",
    }
    setLineItems([...lineItems, newLineItem])
    setShowProductWindow(false)
    setProductSearchTerm("")
    toast({ title: "Product added", description: `${product.name} added to invoice` })
  }

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0
    let totalGst = 0
    let cgst = 0
    let sgst = 0
    let igst = 0

    lineItems.forEach((item) => {
      // Fix: Ensure we pass the correct format to calculateLineItem
      const calc = calculateLineItem({
        unitPrice: item.unit_price,
        discountPercent: item.discount_percent,
        gstRate: item.gst_rate,
        quantity: item.quantity,
      })
      subtotal += calc.taxableAmount

      if (isGstInvoice) {
        totalGst += calc.gstAmount
        if (isSameState) {
          cgst += calc.gstAmount / 2
          sgst += calc.gstAmount / 2
        } else {
          igst += calc.gstAmount
        }
      }
    })

    const total = subtotal + totalGst

    return {
      subtotal: roundToTwo(subtotal),
      cgst: roundToTwo(cgst),
      sgst: roundToTwo(sgst),
      igst: roundToTwo(igst),
      totalGst: roundToTwo(totalGst),
      total: roundToTwo(total),
    }
  }

  const totals = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const t = calculateTotals();
      const invoiceId = crypto.randomUUID();
      const invoiceData = {
        id: invoiceId,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        status: "draft",
        is_gst_invoice: isGstInvoice,
        subtotal: t.subtotal,
        cgst_amount: t.cgst,
        sgst_amount: t.sgst,
        igst_amount: t.igst,
        total_amount: t.total,
        notes: notes || undefined,
        terms: terms || undefined,
        created_at: new Date().toISOString(),
        store_id: storeId || undefined,
        employee_id: employeeId || undefined,
        created_by_employee_id: employeeId || undefined,
      };
      
      // Calculate line totals and GST for each item
      const items = lineItems.map((li) => {
        const calc = calculateLineItem({
          unitPrice: li.unit_price,
          discountPercent: li.discount_percent,
          gstRate: li.gst_rate,
          quantity: li.quantity,
        });
        return {
          id: li.id,
          invoice_id: invoiceId,
          product_id: li.product_id || null,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent,
          gst_rate: li.gst_rate,
          hsn_code: li.hsn_code || null,
          line_total: calc.taxableAmount + calc.gstAmount,
          gst_amount: calc.gstAmount,
          created_at: new Date().toISOString(),
        };
      });
      
      console.log('[InvoiceForm] Saving invoice', invoiceData, items);
      await storageManager.addInvoice(invoiceData, items);
      toast({ title: "Success", description: "Invoice created successfully" });
      router.push("/invoices");
      router.refresh();
    } catch (error) {
      console.error('[InvoiceForm] Error saving invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quick Customer Form - Always Visible */}
      <InlineCustomerForm
        onCustomerCreated={(newCustomer) => {
          // Add new customer to local list
          setLocalCustomers([...localCustomers, newCustomer])
          // Select the newly created customer
          setCustomerId(newCustomer.id)
          // Notify parent if callback provided
          if (onCustomersUpdate) {
            onCustomersUpdate([...localCustomers, newCustomer])
          }
        }}
      />

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {localCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="gst_invoice" checked={isGstInvoice} onCheckedChange={setIsGstInvoice} />
                <Label htmlFor="gst_invoice">GST Invoice</Label>
              </div>
              {isGstInvoice && (
                <div className="flex items-center gap-2">
                  <Switch id="same_state" checked={isSameState} onCheckedChange={setIsSameState} />
                  <Label htmlFor="same_state">Same State (CGST+SGST)</Label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowProductWindow(true)}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              Browse Products
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Price</TableHead>
                  <TableHead className="w-[100px]">Disc %</TableHead>
                  {isGstInvoice && <TableHead className="w-[100px]">GST %</TableHead>}
                  <TableHead className="w-[120px]">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => {
                  const calc = calculateLineItem({
                    unitPrice: item.unit_price,
                    discountPercent: item.discount_percent,
                    gstRate: item.gst_rate,
                    quantity: item.quantity,
                  })
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={item.product_id || ""}
                          onValueChange={(value) => updateLineItem(item.id, "product_id", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Description"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateLineItem(item.id, "unit_price", Number.parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount_percent}
                          onChange={(e) =>
                            updateLineItem(item.id, "discount_percent", Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </TableCell>
                      {isGstInvoice && (
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.gst_rate}
                            onChange={(e) =>
                              updateLineItem(item.id, "gst_rate", Number.parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">₹{calc.lineTotal.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <Button type="button" variant="outline" onClick={addLineItem} className="mt-4 bg-transparent">
            <Plus className="mr-2 h-4 w-4" />
            Add Line Item
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="p-6">
          <div className="ml-auto max-w-sm space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            {isGstInvoice && (
              <>
                {isSameState ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span className="font-medium">₹{totals.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span className="font-medium">₹{totals.sgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span className="font-medium">₹{totals.igst.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total:</span>
              <span>₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the customer..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms and conditions..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Invoice"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
    </>
  )
}
