"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Database, 
  Users, 
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Admin {
  id: string
  email: string
  full_name: string
  business_name: string
  business_phone: string | null
  business_address: string | null
  database_mode: "supabase" | "indexeddb"
  billing_mode: "b2b" | "b2c" | "both"
  allow_b2b_mode: boolean
  is_active: boolean
  created_at: string
  created_by_admin_id: string | null
}

export default function AdminManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [showLicenseDialog, setShowLicenseDialog] = useState(false)
  const [licenseMacAddress, setLicenseMacAddress] = useState("")
  const [licenseClientName, setLicenseClientName] = useState("")
  const [licenseExpiresDays, setLicenseExpiresDays] = useState("365")
  const [licenseLoading, setLicenseLoading] = useState(false)

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadAdmins = async () => {
    try {
      const response = await fetch("/api/admin/admins")
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push("/auth/login")
          return
        }
        throw new Error("Failed to fetch admins")
      }

      const data = await response.json()
      setAdmins(data.admins || [])
    } catch (error: any) {
      console.error("Error loading admins:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load admins",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (admin: Admin, updates: Partial<Admin>) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("user_profiles")
        .update({
          database_mode: updates.database_mode,
          billing_mode: updates.billing_mode,
          allow_b2b_mode: updates.allow_b2b_mode,
          is_active: updates.is_active,
        })
        .eq("id", admin.id)

      if (error) throw error

      // Update business_settings if exists
      await supabase
        .from("business_settings")
        .upsert({
          user_id: admin.id,
          database_mode: updates.database_mode,
          allow_b2b_mode: updates.allow_b2b_mode,
          is_b2b_enabled: updates.billing_mode === "b2b" || updates.billing_mode === "both",
        }, { onConflict: "user_id" })

      toast({
        title: "Success",
        description: "Admin updated successfully",
      })

      await loadAdmins()
      setEditingAdmin(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin",
        variant: "destructive",
      })
    }
  }

  const handleDeactivate = async (admin: Admin) => {
    if (!confirm(`Deactivate admin "${admin.full_name}" and all their employees?`)) {
      return
    }

    await handleEdit(admin, { is_active: false })
  }

  const handleActivate = async (admin: Admin) => {
    await handleEdit(admin, { is_active: true })
  }

  const handleCreateLicense = async () => {
    if (!licenseMacAddress.trim()) {
      toast({
        title: "Error",
        description: "MAC address is required",
        variant: "destructive",
      })
      return
    }

    setLicenseLoading(true)
    try {
      const response = await fetch("/api/license/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macAddress: licenseMacAddress,
          clientName: licenseClientName || "Default Client",
          expiresInDays: parseInt(licenseExpiresDays) || 365,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create license")
      }

      toast({
        title: "Success",
        description: `License created: ${data.license.licenseKey}`,
      })

      setShowLicenseDialog(false)
      setLicenseMacAddress("")
      setLicenseClientName("")
      setLicenseExpiresDays("365")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create license",
        variant: "destructive",
      })
    } finally {
      setLicenseLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Management
          </h1>
          <p className="text-muted-foreground">Manage admins, settings, and licenses</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showLicenseDialog} onOpenChange={setShowLicenseDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="h-4 w-4 mr-2" />
                Add License
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add License</DialogTitle>
                <DialogDescription>Create a new license for IndexedDB mode admins</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="macAddress">MAC Address *</Label>
                  <Input
                    id="macAddress"
                    value={licenseMacAddress}
                    onChange={(e) => setLicenseMacAddress(e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={licenseClientName}
                    onChange={(e) => setLicenseClientName(e.target.value)}
                    placeholder="Default Client"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresDays">Expires In (Days)</Label>
                  <Input
                    id="expiresDays"
                    type="number"
                    value={licenseExpiresDays}
                    onChange={(e) => setLicenseExpiresDays(e.target.value)}
                    placeholder="365"
                  />
                </div>
                <Button onClick={handleCreateLicense} disabled={licenseLoading} className="w-full">
                  {licenseLoading ? "Creating..." : "Create License"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => router.push("/auth/signup")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Admin
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading admins...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Admins</CardTitle>
            <CardDescription>View and manage all admin accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>DB Mode</TableHead>
                  <TableHead>Billing Mode</TableHead>
                  <TableHead>B2B Enabled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No admins found
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.full_name}</TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>{admin.business_name}</TableCell>
                      <TableCell>
                        <Badge variant={admin.database_mode === "supabase" ? "default" : "secondary"}>
                          <Database className="h-3 w-3 mr-1" />
                          {admin.database_mode === "supabase" ? "Supabase" : "IndexedDB"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{admin.billing_mode.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        {admin.allow_b2b_mode ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.is_active ? "default" : "destructive"}>
                          {admin.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(admin.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <EditAdminDialog
                            admin={admin}
                            onSave={(updates) => handleEdit(admin, updates)}
                          />
                          {admin.is_active ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeactivate(admin)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleActivate(admin)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EditAdminDialog({ admin, onSave }: { admin: Admin; onSave: (updates: Partial<Admin>) => void }) {
  const [open, setOpen] = useState(false)
  const [databaseMode, setDatabaseMode] = useState(admin.database_mode)
  const [billingMode, setBillingMode] = useState(admin.billing_mode)
  const [allowB2B, setAllowB2B] = useState(admin.allow_b2b_mode)

  const handleSave = () => {
    onSave({
      database_mode: databaseMode,
      billing_mode: billingMode,
      allow_b2b_mode: allowB2B,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Admin: {admin.full_name}</DialogTitle>
          <DialogDescription>Update admin settings and permissions</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Database Mode</Label>
            <Select value={databaseMode} onValueChange={(value: "supabase" | "indexeddb") => setDatabaseMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supabase">Supabase (Online)</SelectItem>
                <SelectItem value="indexeddb">IndexedDB (Offline - Requires License)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Billing Mode</Label>
            <Select value={billingMode} onValueChange={(value: "b2b" | "b2c" | "both") => setBillingMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="b2c">B2C Only</SelectItem>
                <SelectItem value="b2b">B2B Only</SelectItem>
                <SelectItem value="both">Both B2B & B2C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Allow B2B Mode</Label>
              <p className="text-xs text-muted-foreground">Enable B2B mode for this admin</p>
            </div>
            <Switch checked={allowB2B} onCheckedChange={setAllowB2B} />
          </div>
          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
