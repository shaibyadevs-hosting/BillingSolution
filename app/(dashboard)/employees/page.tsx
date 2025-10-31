"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Search, Edit2, Trash2, Sparkles } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  role: string
  salary: number
  joining_date: string
  is_active: boolean
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => { fetchEmployees() }, [isExcel])

  const fetchEmployees = async () => {
    try {
      if (isExcel) {
        setIsLoading(true)
        const list = await db.employees.toArray()
        setEmployees(list as any)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    if (isExcel) {
      await db.employees.delete(id)
      setEmployees(employees.filter(e => e.id !== id))
      toast({ title: "Success", description: "Employee deleted" })
      return
    }

    try {
      const supabase = createClient()
      await supabase.from("employees").delete().eq("id", id)
      setEmployees(employees.filter((e) => e.id !== id))
      toast({
        title: "Success",
        description: "Employee deleted",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      })
    }
  }

  const handleAddMockEmployee = async () => {
    try {
      // Get current store
      const currentStoreId = localStorage.getItem("currentStoreId")
      if (!currentStoreId) {
        toast({ title: "Error", description: "No store selected. Please create a store first.", variant: "destructive" })
        return
      }

      const rand = Math.floor(Math.random()*10000)
      const name = `Employee ${rand}`
      
      // Generate employee ID
      const { generateEmployeeId } = await import("@/lib/utils/employee-id")
      const employeeId = await generateEmployeeId(currentStoreId, name)
      
      const employee: any = {
        id: crypto.randomUUID(),
        name,
        email: `emp${rand}@example.com`,
        phone: `9${Math.floor(100000000 + Math.random()*899999999)}`,
        role: rand % 5 === 0 ? 'admin' : 'employee',
        salary: Math.floor(Math.random()*50000)+20000,
        joining_date: new Date().toISOString(),
        is_active: true,
        employee_id: employeeId,
        password: employeeId, // Default password = employee ID
        store_id: currentStoreId,
      }
      await storageManager.addEmployee(employee)
      const list = await db.employees.toArray()
      setEmployees(list as any)
      toast({ title: "Success", description: `Mock employee "${employee.name}" (ID: ${employeeId}) added. Password: ${employeeId}` })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add employee", variant: "destructive" })
    }
  }

  // Excel import logic
  function ExcelImport() {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [importing, setImporting] = useState(false)
    const handleClick = () => inputRef.current?.click()
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return
      setImporting(true)
      try {
        const { importEmployeesFromExcel } = await import("@/lib/utils/excel-import")
        const res = await importEmployeesFromExcel(e.target.files[0])
        if (!res.success) throw new Error(res.errors[0] || "Import failed")
        const toSave = (res.data || []).map((e: any) => ({ id: crypto.randomUUID(), ...e }))
        for (const emp of toSave) {
          await storageManager.addEmployee(emp)
        }
        const list = await db.employees.toArray()
        setEmployees(list as any)
        toast({ title: "Imported", description: `Employees imported: ${toSave.length}` })
      } finally {
        setImporting(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    }
    return (
      <>
        <Button type="button" variant="secondary" className="mr-2" onClick={handleClick} disabled={importing}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import from Excel
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </>
    )
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImport />
          <Button type="button" variant="outline" onClick={handleAddMockEmployee} title="Add a mock employee">
            <Sparkles className="mr-2 h-4 w-4" /> Add Mock Employee
          </Button>
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono font-medium">{emp.employee_id || "N/A"}</TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.phone}</TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>₹{emp.salary.toLocaleString()}</TableCell>
                      <TableCell>{new Date(emp.joining_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/employees/${emp.id}/edit`}>
                              <Edit2 className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
