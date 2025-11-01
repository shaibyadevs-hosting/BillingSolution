"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Search, Edit2, Trash2, Sparkles, Key, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUserRole } from "@/lib/hooks/use-user-role"

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
  const [storesMap, setStoresMap] = useState<Record<string, any>>({})
  const { toast } = useToast()
  const { isAdmin, isEmployee } = useUserRole()
  const isExcel = getDatabaseType() === 'excel'
  const router = useRouter()

  useEffect(() => {
    // Only admin can access this page
    if (!isLoading) {
      if (isEmployee || !isAdmin) {
        router.push("/dashboard")
        return
      }
      if (isAdmin) {
        fetchEmployees()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExcel, router, isAdmin, isEmployee, isLoading])

  const fetchEmployees = async () => {
    try {
      if (isExcel) {
        setIsLoading(true)
        const list = await db.employees.toArray()
        // Load stores for Excel mode
        const allStores = await db.stores.toArray()
        const stores: Record<string, any> = {}
        allStores.forEach(store => {
          stores[store.id] = store
        })
        setStoresMap(stores)
        setEmployees(list as any)
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from("employees")
        .select("*, stores(name, store_code)")
        .order("created_at", { ascending: false })

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

      // Verify store belongs to admin
      let store: any = null
      if (isExcel) {
        store = await db.stores.get(currentStoreId)
        if (!store || !store.admin_user_id) {
          toast({ title: "Error", description: "Store must be created by an admin", variant: "destructive" })
          return
        }
      } else {
        const supabase = createClient()
        const { data: storeData } = await supabase
          .from("stores")
          .select("*, user_profiles!stores_admin_user_id_fkey(role)")
          .eq("id", currentStoreId)
          .single()
        
        if (!storeData || !storeData.admin_user_id) {
          toast({ title: "Error", description: "Store must be created by an admin", variant: "destructive" })
          return
        }
        store = storeData
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
        role: 'employee', // Always employee, not admin
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Store</TableHead>
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
                      <TableCell className="font-mono text-sm">
                        {emp.password ? (
                          <span title={emp.password}>{emp.password}</span>
                        ) : (
                          <span className="text-muted-foreground">{emp.employee_id || "N/A"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {emp.stores ? (
                          <span className="text-sm">
                            {emp.stores.name} <span className="text-muted-foreground font-mono">({emp.stores.store_code})</span>
                          </span>
                        ) : emp.store_id && storesMap[emp.store_id] ? (
                          <span className="text-sm">
                            {storesMap[emp.store_id].name} <span className="text-muted-foreground font-mono">({storesMap[emp.store_id].store_code})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>₹{emp.salary.toLocaleString()}</TableCell>
                      <TableCell>{new Date(emp.joining_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="icon" asChild title="View Details">
                            <Link href={`/employees/${emp.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link href={`/employees/${emp.id}/edit`}>
                              <Edit2 className="h-4 w-4" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={async () => {
                                if (!confirm(`Reset password for ${emp.name} to ${emp.employee_id || emp.id.slice(0, 4).toUpperCase()}?`)) return
                                try {
                                  const newPassword = emp.employee_id || emp.id.slice(0, 4).toUpperCase()
                                  if (isExcel) {
                                    await db.employees.update(emp.id, { password: newPassword })
                                    toast({ title: "Success", description: `Password reset to ${newPassword}` })
                                  } else {
                                    const supabase = createClient()
                                    await supabase.from("employees").update({ password: newPassword }).eq("id", emp.id)
                                    toast({ title: "Success", description: `Password reset to ${newPassword}` })
                                  }
                                  fetchEmployees()
                                } catch (error: any) {
                                  toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" })
                                }
                              }}
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
