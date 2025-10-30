"use client"

import { useState } from "react"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function TestExcelPage() {
  const [status, setStatus] = useState<string>("Idle")
  const [productsCount, setProductsCount] = useState<number>(0)

  const refreshCounts = () => {
    try {
      const list = excelSheetManager.getList("products") || []
      setProductsCount(list.length)
    } catch (e) {
      console.error("[dev/test-excel] refreshCounts error", e)
    }
  }

  const initExcel = async () => {
    setStatus("Initializing Excel mode...")
    try {
      await excelSheetManager.initializeExcelMode()
      setStatus("Excel mode initialized")
      refreshCounts()
    } catch (e: any) {
      setStatus("Init failed: " + (e?.message || String(e)))
    }
  }

  const checkIntegrity = () => {
    try {
      const wb = excelSheetManager.workbook
      const ok = !!(wb && wb.Sheets && wb.Sheets["Products"]) 
      setStatus(ok ? "Integrity OK" : "Integrity FAILED (Products sheet missing)")
      refreshCounts()
    } catch (e: any) {
      setStatus("Integrity check error: " + (e?.message || String(e)))
    }
  }

  const addProduct = async () => {
    try {
      const id = crypto.randomUUID()
      excelSheetManager.add("products", {
        id,
        name: "Dev Test Product",
        price: 10,
        cost_price: 8,
        stock_quantity: 2,
        unit: "piece",
        sku: "DEV-TEST",
        category: "Dev",
        hsn_code: "0000",
        gst_rate: 18,
        is_active: true,
      })
      setStatus("Added product: " + id)
      refreshCounts()
    } catch (e: any) {
      setStatus("Add failed: " + (e?.message || String(e)))
    }
  }

  const updateRandom = async () => {
    try {
      const list = excelSheetManager.getList("products") || []
      if (list.length === 0) {
        setStatus("No products to update")
        return
      }
      const id = list[0].id
      excelSheetManager.update("products", id, { name: "Dev Test Product (Updated)" })
      setStatus("Updated product: " + id)
      refreshCounts()
    } catch (e: any) {
      setStatus("Update failed: " + (e?.message || String(e)))
    }
  }

  const deleteRandom = async () => {
    try {
      const list = excelSheetManager.getList("products") || []
      if (list.length === 0) {
        setStatus("No products to delete")
        return
      }
      const id = list[0].id
      excelSheetManager.remove("products", id)
      setStatus("Deleted product: " + id)
      refreshCounts()
    } catch (e: any) {
      setStatus("Delete failed: " + (e?.message || String(e)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dev: Test Excel</h1>
          <p className="text-muted-foreground">Exercise excelSheetManager CRUD and integrity checks</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={initExcel}>Initialize Excel Mode</Button>
            <Button variant="outline" onClick={checkIntegrity}>Check Excel Integrity</Button>
            <Button onClick={addProduct}>Add Product</Button>
            <Button onClick={updateRandom}>Update First Product</Button>
            <Button variant="destructive" onClick={deleteRandom}>Delete First Product</Button>
          </div>
          <div className="text-sm">
            <div>Status: {status}</div>
            <div>Products Count: {productsCount}</div>
            <div>Excel Mode: {String(excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive())}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


