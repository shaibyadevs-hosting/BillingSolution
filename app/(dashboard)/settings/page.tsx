"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Building2, User, Palette, Store, Cloud, Database, Shield, LogOut, Users } from "lucide-react"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { useStore } from "@/lib/utils/store-context"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { isOfflineLoginEnabled, setOfflineLoginEnabled } from "@/lib/utils/offline-auth"
import { useUserRole } from "@/lib/hooks/use-user-role"

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const { currentStore } = useStore()
  const router = useRouter()
  const { toast } = useToast()
  const isExcel = false
  // Safe for SSR: getDatabaseType() returns 'indexeddb' when window is undefined
  const dbType = typeof window !== "undefined" ? getDatabaseType() : "indexeddb"
  const [offlineEnabled, setOfflineEnabled] = useState(false)
  const { isEmployee } = useUserRole()

  useEffect(() => {
    setOfflineEnabled(isOfflineLoginEnabled())
  }, [])

  // Check access: admin can access all settings, employees can access employee settings
  useEffect(() => {
    const checkAccess = async () => {
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        // Employees can access settings page (to see employee settings link)
        return
      }
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        const { data: p } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", u.id)
          .single()
        const role = p?.role || "admin"
        if (role !== "admin") {
          // Non-admin, non-employee users redirected to dashboard
          router.push("/dashboard")
        }
      }
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    (async () => {
      if (isExcel) {
        // Excel mode - load profile/settings from localStorage or default
        // Try to get user profile data from Supabase if available
        const supabase = createClient()
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)
        if (u) {
          try {
            const { data: p } = await supabase.from("user_profiles").select("*").eq("id", u.id).single()
            const { data: s } = await supabase.from("business_settings").select("*").eq("user_id", u.id).single()
            setProfile(p)
            setSettings(s)
          } catch (e) {
            // If no profile exists yet, set defaults
            setProfile(null)
            setSettings(null)
          }
        }
      } else {
        const supabase = createClient()
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)
        if (u) {
          const [{ data: p }, { data: s }] = await Promise.all([
            supabase.from("user_profiles").select("*").eq("id", u.id).single(),
            supabase.from("business_settings").select("*").eq("user_id", u.id).single(),
          ])
          setProfile(p)
          setSettings(s)
        }
      }
    })()
  }, [isExcel])


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and business settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Business Settings</CardTitle>
            </div>
            <CardDescription>Configure your business information and invoice settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Business Name</p>
                <p className="text-muted-foreground">{profile?.business_name || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">GSTIN</p>
                <p className="text-muted-foreground">{profile?.business_gstin || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">Invoice Prefix</p>
                <p className="text-muted-foreground">{settings?.invoice_prefix || "INV"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/business">Edit Business Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
            <CardDescription>Update your personal information and account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Name</p>
                <p className="text-muted-foreground">{profile?.full_name || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">{user?.email || "Not available"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/profile">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Employee Settings - Only visible to employees */}
        {isEmployee && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Employee Settings</CardTitle>
              </div>
              <CardDescription>Manage your personal preferences and billing mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <p className="font-medium">Personal Preferences</p>
                  <p className="text-muted-foreground">Configure your billing mode and theme preferences</p>
                </div>
              </div>
              <Button asChild className="w-full bg-transparent" variant="outline">
                <Link href="/settings/employee">Open Employee Settings</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize the look and feel of your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-muted-foreground">{profile?.theme_preference || "Light"}</p>
              </div>
            </div>
            <Button asChild className="mt-4 w-full bg-transparent" variant="outline">
              <Link href="/settings/theme">Customize Theme</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Excel connector removed - IndexedDB is the primary local storage */}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <CardTitle>Store Settings</CardTitle>
            </div>
            <CardDescription>{currentStore ? "Manage your store information" : "Create your store to get started"}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStore ? (
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <p className="font-medium">Store Name</p>
                  <p className="text-muted-foreground">{currentStore.name || "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">Store Code</p>
                  <p className="text-muted-foreground font-mono">{currentStore.store_code || "Not set"}</p>
                </div>
                {currentStore.address && (
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-muted-foreground">{currentStore.address}</p>
                  </div>
                )}
                {currentStore.gstin && (
                  <div>
                    <p className="font-medium">GSTIN</p>
                    <p className="text-muted-foreground">{currentStore.gstin}</p>
                  </div>
                )}
                {currentStore.phone && (
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-muted-foreground">{currentStore.phone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No store created yet. Create your first store to start managing your business.</p>
            )}
            <Button asChild className="w-full bg-transparent" variant="outline">
              <Link href="/settings/store">{currentStore ? "Manage Store" : "Create Store"}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Database Mode</CardTitle>
            </div>
            <CardDescription>
              {dbType === 'supabase' 
                ? "Currently using Supabase cloud storage" 
                : "Currently using local storage (IndexedDB)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <div>
                <p className="font-medium">Current Database</p>
                <p className="text-muted-foreground">{dbType === 'supabase' ? 'Supabase (Cloud)' : 'Local (IndexedDB)'}</p>
              </div>
              <div>
                <p className="font-medium">Storage Location</p>
                <p className="text-muted-foreground">
                  {dbType === 'supabase' 
                    ? 'Data stored in Supabase cloud' 
                    : 'Data stored locally in browser'}
                </p>
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  {dbType === 'supabase' 
                    ? 'Database mode is set during admin creation and cannot be changed here. Contact your administrator for changes.' 
                    : 'Database mode is set during admin creation. IndexedDB mode requires a valid license.'}
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Offline admin login</p>
                  <p className="text-xs text-muted-foreground">
                    Store a hashed password locally so you can sign in without internet. Turn off to remove saved secrets.
                  </p>
                </div>
                <Switch
                  checked={offlineEnabled}
                  onCheckedChange={(checked) => {
                    setOfflineEnabled(checked)
                    setOfflineLoginEnabled(checked)
                    toast({
                      title: checked ? "Offline login enabled" : "Offline login disabled",
                      description: checked
                        ? "Your next successful login will refresh the offline credential."
                        : "All offline credentials were cleared.",
                    })
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
