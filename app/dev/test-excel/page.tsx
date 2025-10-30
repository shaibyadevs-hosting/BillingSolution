"use client"

import { useState, useEffect } from "react"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function TestExcelPage() {
  const [status, setStatus] = useState<string>("Idle")
  const [productsCount, setProductsCount] = useState<number>(0)
  const [initResult, setInitResult] = useState<string>("");

  const refreshCounts = () => {
    try {
      const list = excelSheetManager.getList("products") || []
      setProductsCount(list.length)
    } catch (e) {
      console.error("[dev/test-excel] refreshCounts error", e)
    }
  }

  const initExcel = async () => {
    setStatus("Checking/Creating Excel files via API...");
    try {
      const res = await fetch("/api/ensure-excel-files");
      const data = await res.json();
      setInitResult(JSON.stringify(data));
      if (Object.values(data).some((status) => status === "created")) {
        setStatus("Excel files created and ready.");
      } else {
        setStatus("Excel files already exist.");
      }
      // Recheck file status
      // (Refactor checkFiles as independent function so we can call here)
      checkFiles();
    } catch (e: any) {
      setStatus("Init failed: " + (e?.message || String(e)));
    }
  }

  const checkIntegrity = async () => {
    setStatus("Checking and repairing integrity...");
    try {
      // true: fill with mock data if file or structure missing
      const result = await excelSheetManager.ensureWorkbookAndSheetsWithData(true);
      setStatus("Check done: " + JSON.stringify(result));
      refreshCounts();
    } catch (e: any) {
      setStatus("Integrity check error: " + (e?.message || String(e)));
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

  const fileNames = ["Products.xlsx","Customers.xlsx","Employees.xlsx","Invoices.xlsx"];
  const [fileStatus, setFileStatus] = useState<{[key:string]:boolean}>({})

  // uses a public file endpoint in dev or simulate available files
  function checkFiles() {
    const statuses: {[key:string]:boolean} = {};
    Promise.all(fileNames.map(async (fname) => {
      try {
        const res = await fetch(`/excel-test/${fname}`, { method: 'HEAD' })
        statuses[fname] = res.ok
      } catch {
        statuses[fname] = false
      }
    })).then(() => setFileStatus(statuses));
  }
  useEffect(() => {
    checkFiles();
  }, []);

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
          {initResult && (<pre className="text-xs">Init Result: {initResult}</pre>)}
          <div className="mb-4">
            <strong>Excel file status in public/excel-test/</strong>:
            <ul>
              {fileNames.map(fname => (<li key={fname}>{fname}: {fileStatus[fname] ? '✅ Exists' : '❌ Missing'}</li>))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


