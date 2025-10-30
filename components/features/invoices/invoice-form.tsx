"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { calculateLineItem, roundToTwo } from "@/lib/utils/gst-calculator"
import { Switch } from "@/components/ui/switch"
import { db } from "@/lib/db/dexie"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

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
}

interface BusinessSettings {
  invoice_prefix: string
  next_invoice_number: number
  default_gst_rate: number
  place_of_supply: string | null
}

interface LineItem {
  id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  gst_rate: number
  hsn_code: string
}

interface InvoiceFormProps {
  customers: Customer[]
  products: Product[]
  settings: BusinessSettings | null
}

// Sync the Invoice and LineItem shape across Excel/DB
interface Invoice {
  id: string;
  user_id?: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  is_gst_invoice: boolean;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  created_at?: string;
  updated_at?: string;
  items: LineItem[];
}

interface LineItem {
  id: string;
  invoice_id?: string;
  product_id: string|null;
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

export function InvoiceForm({ customers, products, settings }: InvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const [invoiceNumber, setInvoiceNumber] = useState(
    `${settings?.invoice_prefix || "INV"}-${String(settings?.next_invoice_number || 1).padStart(4, "0")}`,
  )
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [isGstInvoice, setIsGstInvoice] = useState(true)
  const [isSameState, setIsSameState] = useState(true)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")

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
    e.preventDefault()
    setIsLoading(true)
    try {
      if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
        // Validate required fields (mimic backend validation)
        if (!customerId) throw new Error("Customer is required.");
        if (!invoiceNumber) throw new Error("Invoice number is required.");
        if (!invoiceDate) throw new Error("Invoice date is required.");
        if (!lineItems.length || lineItems.some(it => !it.description || !it.quantity || isNaN(it.unit_price))) {
          throw new Error('All line items must be filled.');
        }
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const excelInvoice: Invoice = {
          id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          status: "draft",
          is_gst_invoice: isGstInvoice,
          subtotal: totals.subtotal,
          cgst_amount: totals.cgst,
          sgst_amount: totals.sgst,
          igst_amount: totals.igst,
          total_amount: totals.total,
          notes: notes,
          terms: terms,
          created_at: now,
          updated_at: now,
          items: lineItems.map(it => ({
            id: it.id,
            product_id: it.product_id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount_percent: it.discount_percent,
            gst_rate: it.gst_rate,
            hsn_code: it.hsn_code ?? '',
            // totals below are helpful for Excel-only, but optional in DB
            line_total: calculateLineItem(it).lineTotal,
            gst_amount: calculateLineItem(it).gstAmount,
          }))
        }
        try {
          excelSheetManager.add('invoices', excelInvoice);
          if (!excelSheetManager.workbook || !excelSheetManager.workbook.Sheets["Invoices"]) {
            window.alert("Excel sheet 'Invoices' was not created or is missing. Click 'Check Excel Integrity' or allow pop-up/download if prompted.");
            throw new Error("Excel sheet missing after save.");
          }
        } catch (excelError) {
          window.alert('Excel Save Failed: ' + (excelError instanceof Error && excelError.message ? excelError.message : JSON.stringify(excelError)));
          throw excelError;
        }
        toast({
          title: "Success",
          description: "Invoice created in Excel file",
        });
        router.push(`/invoices`);
        router.refresh();
        return;
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

      // Offline-first: if offline, persist to IndexedDB and queue sync
      if (!navigator.onLine) {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const payload = {
          id,
          user_id: user.id,
          customer_id: customerId || null,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          status: "draft",
          is_gst_invoice: isGstInvoice,
          subtotal: totals.subtotal,
          cgst_amount: totals.cgst,
          sgst_amount: totals.sgst,
          igst_amount: totals.igst,
          total_amount: totals.total,
          notes,
          terms,
          created_at: now,
          updated_at: now,
          is_synced: false,
          deleted: false,
        } as any

        const itemsToSave = lineItems.map((item) => {
          // Ensure the shape matches the expected LineItem type for calculateLineItem
          const calc = calculateLineItem({
            unitPrice: item.unit_price,
            quantity: item.quantity,
            discountPercent: item.discount_percent,
            gstRate: item.gst_rate,
          })
          return {
            id: crypto.randomUUID(),
            invoice_id: id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            gst_rate: item.gst_rate,
            hsn_code: item.hsn_code,
            line_total: calc.lineTotal,
            gst_amount: calc.gstAmount,
            created_at: now,
          }
        })

        await db.invoices.put(payload)
        await db.invoice_items.bulkPut(itemsToSave)
        await db.sync_queue.add({
          entity_type: "invoice",
          entity_id: id,
          action: "create",
          data: payload,
          created_at: now,
          retry_count: 0,
        })

        toast({ title: "Saved offline", description: "Invoice will sync when you're online." })
        router.push(`/invoices/${id}`)
        router.refresh()
        return
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          customer_id: customerId || null,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          status: "draft",
          is_gst_invoice: isGstInvoice,
          subtotal: totals.subtotal,
          cgst_amount: totals.cgst,
          sgst_amount: totals.sgst,
          igst_amount: totals.igst,
          total_amount: totals.total,
          notes,
          terms,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice items
      const itemsToInsert = lineItems.map((item) => {
        const calc = calculateLineItem({
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discountPercent: item.discount_percent,
          gstRate: item.gst_rate,
          hsnCode: item.hsn_code,
          hsnCode: item.hsn_code,
        })
        return {
          invoice_id: invoice.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_rate: item.gst_rate,
          hsn_code: item.hsn_code,
          line_total: calc.lineTotal,
          gst_amount: calc.gstAmount,
        }
      })

      const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert)

      if (itemsError) throw itemsError

      // Update next invoice number
      if (settings) {
        await supabase
          .from("business_settings")
          .update({ next_invoice_number: settings.next_invoice_number + 1 })
          .eq("user_id", user.id)
      }

      toast({
        title: "Success",
        description: "Invoice created successfully",
      })

      router.push(`/invoices/${invoice.id}`)
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create invoice",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                  {customers.map((customer) => (
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
          <CardTitle>Line Items</CardTitle>
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
                  const calc = calculateLineItem(item)
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
  )
}
