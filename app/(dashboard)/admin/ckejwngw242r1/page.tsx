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
import { useToast } from "@/hooks/use-toast"
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Database, 
  CheckCircle2,
  XCircle,
  LogOut,
  Lock,
  Copy,
  Check
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PIN_SESSION_KEY = "admin_pin_auth"
const PIN_SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

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
  last_login_time: string | null
  created_by_admin_id: string | null
}

export default function SecretAdminPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [showLicenseDialog, setShowLicenseDialog] = useState(false)
  const [showCreateAdminDialog, setShowCreateAdminDialog] = useState(false)
  const [showLicenseSuccessModal, setShowLicenseSuccessModal] = useState(false)
  const [createdLicenseKey, setCreatedLicenseKey] = useState<string>("")
  const [licenseMacAddress, setLicenseMacAddress] = useState("")
  const [licenseClientName, setLicenseClientName] = useState("")
  const [licenseExpiresDays, setLicenseExpiresDays] = useState("365")
  const [licenseLoading, setLicenseLoading] = useState(false)
  
  // Create admin form state
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [newAdminConfirmPassword, setNewAdminConfirmPassword] = useState("")
  const [newAdminFullName, setNewAdminFullName] = useState("")
  const [newAdminBusinessName, setNewAdminBusinessName] = useState("")
  const [newAdminBusinessPhone, setNewAdminBusinessPhone] = useState("")
  const [newAdminBusinessAddress, setNewAdminBusinessAddress] = useState("")
  const [newAdminDatabaseMode, setNewAdminDatabaseMode] = useState<"supabase" | "indexeddb">("indexeddb")
  const [newAdminBillingMode, setNewAdminBillingMode] = useState<"b2b" | "b2c" | "both">("both")
  const [newAdminAllowB2B, setNewAdminAllowB2B] = useState(false)
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // Check PIN authentication and auto-logout
  useEffect(() => {
    const pinAuth = sessionStorage.getItem(PIN_SESSION_KEY)
    if (!pinAuth) {
      router.push("/admin/ckejwngw242r1/login")
      return
    }

    const { timestamp } = JSON.parse(pinAuth)
    const now = Date.now()
    const elapsed = now - timestamp

    if (elapsed >= PIN_SESSION_DURATION) {
      sessionStorage.removeItem(PIN_SESSION_KEY)
      toast({
        title: "Session Expired",
        description: "Your admin session has expired (30 minutes). Please log in again.",
        variant: "destructive",
      })
      router.push("/admin/ckejwngw242r1/login")
      return
    }

    // Set up single auto-logout timer (no interval, no API calls)
    const remaining = PIN_SESSION_DURATION - elapsed
    const timeout = setTimeout(() => {
      sessionStorage.removeItem(PIN_SESSION_KEY)
      toast({
        title: "Session Expired",
        description: "Your admin session has expired (30 minutes). Please log in again.",
        variant: "destructive",
      })
      router.push("/admin/ckejwngw242r1/login")
    }, remaining)

    return () => clearTimeout(timeout)
  }, [router, toast])

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadAdmins = async () => {
    try {
      // Check PIN auth before making request
      const pinAuth = sessionStorage.getItem(PIN_SESSION_KEY)
      if (!pinAuth) {
        router.push("/admin/ckejwngw242r1/login")
        return
      }

      // Use API route with PIN auth header
      const response = await fetch("/api/admin/admins", {
        headers: {
          "x-pin-auth": "true"
        }
      })
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push("/admin/ckejwngw242r1/login")
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

  const handleLogout = () => {
    sessionStorage.removeItem(PIN_SESSION_KEY)
    router.push("/admin/ckejwngw242r1/login")
  }

  const handleEdit = async (admin: Admin, updates: Partial<Admin>) => {
    try {
      // Check PIN auth
      const pinAuth = sessionStorage.getItem(PIN_SESSION_KEY)
      if (!pinAuth) {
        router.push("/admin/ckejwngw242r1/login")
        return
      }

      const response = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-pin-auth": "true"
        },
        body: JSON.stringify({
          database_mode: updates.database_mode,
          billing_mode: updates.billing_mode,
          allow_b2b_mode: updates.allow_b2b_mode,
          is_active: updates.is_active,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update admin")
      }

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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingAdmin(true)

    if (newAdminPassword !== newAdminConfirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      setCreatingAdmin(false)
      return
    }

    if (newAdminPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      })
      setCreatingAdmin(false)
      return
    }

    try {
      const supabase = createClient()
      
      // Create admin user
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: newAdminFullName,
            business_name: newAdminBusinessName,
            role: "admin",
          },
        },
      })
      
      if (signupError) throw signupError
      
      if (signupData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert({
            id: signupData.user.id,
            username: newAdminEmail,
            full_name: newAdminFullName,
            business_name: newAdminBusinessName,
            business_phone: newAdminBusinessPhone || null,
            business_address: newAdminBusinessAddress || null,
            role: "admin",
            database_mode: newAdminDatabaseMode,
            billing_mode: newAdminBillingMode,
            allow_b2b_mode: newAdminAllowB2B,
            is_active: true,
          }, { onConflict: "id" })

        if (profileError) throw profileError

        // Create business_settings
        await supabase
          .from("business_settings")
          .upsert({
            user_id: signupData.user.id,
            database_mode: newAdminDatabaseMode,
            allow_b2b_mode: newAdminAllowB2B,
            is_b2b_enabled: newAdminBillingMode === "b2b" || newAdminBillingMode === "both",
          }, { onConflict: "user_id" })

        toast({
          title: "Success",
          description: `Admin "${newAdminFullName}" created successfully`,
        })

        // Reset form
        setNewAdminEmail("")
        setNewAdminPassword("")
        setNewAdminConfirmPassword("")
        setNewAdminFullName("")
        setNewAdminBusinessName("")
        setNewAdminBusinessPhone("")
        setNewAdminBusinessAddress("")
        setNewAdminDatabaseMode("indexeddb")
        setNewAdminBillingMode("both")
        setNewAdminAllowB2B(false)
        setShowCreateAdminDialog(false)

        await loadAdmins()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin",
        variant: "destructive",
      })
    } finally {
      setCreatingAdmin(false)
    }
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

      // Store the created license key and show success modal
      setCreatedLicenseKey(data.license.licenseKey)
      setShowLicenseDialog(false)
      setShowLicenseSuccessModal(true)
      setLicenseMacAddress("")
      setLicenseClientName("")
      setLicenseExpiresDays("365")
      
      // Also show toast for quick feedback
      toast({
        title: "Success",
        description: "License created successfully!",
      })
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

  const getSessionTimeRemaining = () => {
    const pinAuth = sessionStorage.getItem(PIN_SESSION_KEY)
    if (!pinAuth) return 0
    const { timestamp } = JSON.parse(pinAuth)
    const elapsed = Date.now() - timestamp
    const remaining = PIN_SESSION_DURATION - elapsed
    return Math.max(0, remaining)
  }

  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(getSessionTimeRemaining())

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getSessionTimeRemaining()
      setSessionTimeRemaining(remaining)
      if (remaining <= 0) {
        handleLogout()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Super Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage all admins, settings, and licenses</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Session: {formatTime(sessionTimeRemaining)}
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="admins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="admins">Admin Management</TabsTrigger>
          <TabsTrigger value="licenses">License Management</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Admins</CardTitle>
                  <CardDescription>View and manage all admin accounts</CardDescription>
                </div>
                <Dialog open={showCreateAdminDialog} onOpenChange={setShowCreateAdminDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Admin</DialogTitle>
                      <DialogDescription>Create a new admin account with configured settings</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateAdmin} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="newFullName">Full Name *</Label>
                          <Input
                            id="newFullName"
                            required
                            value={newAdminFullName}
                            onChange={(e) => setNewAdminFullName(e.target.value)}
                            disabled={creatingAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newBusinessName">Business Name *</Label>
                          <Input
                            id="newBusinessName"
                            required
                            value={newAdminBusinessName}
                            onChange={(e) => setNewAdminBusinessName(e.target.value)}
                            disabled={creatingAdmin}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newEmail">Email *</Label>
                        <Input
                          id="newEmail"
                          type="email"
                          required
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="newPassword">Password *</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            required
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            disabled={creatingAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newConfirmPassword">Confirm Password *</Label>
                          <Input
                            id="newConfirmPassword"
                            type="password"
                            required
                            value={newAdminConfirmPassword}
                            onChange={(e) => setNewAdminConfirmPassword(e.target.value)}
                            disabled={creatingAdmin}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="newBusinessPhone">Business Phone</Label>
                          <Input
                            id="newBusinessPhone"
                            type="tel"
                            value={newAdminBusinessPhone}
                            onChange={(e) => setNewAdminBusinessPhone(e.target.value)}
                            disabled={creatingAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newDatabaseMode">Database Mode *</Label>
                          <Select value={newAdminDatabaseMode} onValueChange={(value: "supabase" | "indexeddb") => setNewAdminDatabaseMode(value)} disabled={creatingAdmin}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="supabase">Supabase (Online)</SelectItem>
                              <SelectItem value="indexeddb">IndexedDB (Offline - Requires License)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newBusinessAddress">Business Address</Label>
                        <Input
                          id="newBusinessAddress"
                          value={newAdminBusinessAddress}
                          onChange={(e) => setNewAdminBusinessAddress(e.target.value)}
                          disabled={creatingAdmin}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newBillingMode">Billing Mode *</Label>
                        <Select value={newAdminBillingMode} onValueChange={(value: "b2b" | "b2c" | "both") => setNewAdminBillingMode(value)} disabled={creatingAdmin}>
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
                        <Switch checked={newAdminAllowB2B} onCheckedChange={setNewAdminAllowB2B} disabled={creatingAdmin} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1" disabled={creatingAdmin}>
                          {creatingAdmin ? "Creating..." : "Create Admin"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowCreateAdminDialog(false)} disabled={creatingAdmin}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading admins...</p>
              ) : (
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
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                            {admin.last_login_time ? formatDate(admin.last_login_time) : "Never"}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>License Management</CardTitle>
                  <CardDescription>Create and manage licenses for IndexedDB mode admins</CardDescription>
                </div>
                <Dialog open={showLicenseDialog} onOpenChange={setShowLicenseDialog}>
                  <DialogTrigger asChild>
                    <Button>
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
                          onChange={(e) => setLicenseMacAddress(e.target.value.toUpperCase().replace(/[^0-9A-F:]/g, ''))}
                          placeholder="AA:BB:CC:DD:EE:FF"
                          pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                          className="font-mono uppercase"
                        />
                        <p className="text-xs text-muted-foreground">
                          Format: XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX (12 hex characters)
                        </p>
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
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Licenses are required for IndexedDB mode admins. Supabase mode admins don't need licenses.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* License Success Modal with Copy Button */}
      <Dialog open={showLicenseSuccessModal} onOpenChange={setShowLicenseSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              License Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Your license has been created. Copy the license key below to share with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>License Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={createdLicenseKey}
                  readOnly
                  className="font-mono text-sm uppercase"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <CopyLicenseButton licenseKey={createdLicenseKey} />
              </div>
              <p className="text-xs text-muted-foreground">
                Share this license key with the user. They can enter it on the License Activation page.
              </p>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-muted-foreground mb-1">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Share this license key with the user</li>
                <li>User should go to the License Activation page</li>
                <li>User enters the license key to activate</li>
              </ol>
            </div>
            <Button
              onClick={() => setShowLicenseSuccessModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Copy License Button Component
function CopyLicenseButton({ licenseKey }: { licenseKey: string }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "License key copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy license key",
        variant: "destructive",
      })
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
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
