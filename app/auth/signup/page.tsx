"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { ArrowLeft, Shield, Lock } from "lucide-react"

const ADMIN_PIN = "1234"

export default function SignupPage() {
  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [fullName, setFullName] = useState("")
  const [businessPhone, setBusinessPhone] = useState("")
  const [businessAddress, setBusinessAddress] = useState("")
  const [databaseMode, setDatabaseMode] = useState<"supabase" | "indexeddb">("indexeddb")
  const [billingMode, setBillingMode] = useState<"b2b" | "b2c" | "both">("both")
  const [allowB2BMode, setAllowB2BMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  // Signup page is publicly accessible (no auth required, just PIN check)
  useEffect(() => {
    setIsCheckingAuth(false)
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    // Validate PIN first
    if (!pin || pin.trim() !== ADMIN_PIN) {
      setError("Invalid security PIN. Please enter the correct 4-digit PIN.")
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      // Get current admin user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        throw new Error("Authentication required")
      }

      // Create new admin user
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            business_name: businessName,
            role: "admin",
          },
        },
      })
      
      if (signupError) throw signupError
      
      if (signupData.user) {
        // Create user profile with admin management fields
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert({
            id: signupData.user.id,
            username: email, // Store email as username for easier access
            full_name: fullName,
            business_name: businessName,
            business_phone: businessPhone || null,
            business_address: businessAddress || null,
            role: "admin",
            database_mode: databaseMode,
            billing_mode: billingMode,
            allow_b2b_mode: allowB2BMode,
            is_active: true,
            created_by_admin_id: currentUser.id,
          }, { onConflict: "id" })

        if (profileError) throw profileError

        // Create business_settings with database mode
        const { error: settingsError } = await supabase
          .from("business_settings")
          .upsert({
            user_id: signupData.user.id,
            database_mode: databaseMode,
            allow_b2b_mode: allowB2BMode,
            is_b2b_enabled: billingMode === "b2b" || billingMode === "both",
          }, { onConflict: "user_id" })

        if (settingsError) {
          console.warn("Settings creation error:", settingsError)
          // Non-critical, continue
        }

        router.push("/admin/manage?created=true")
      } else {
        throw new Error("Failed to create admin user")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Checking permissions...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/admin/manage")}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Shield className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold">Create New Admin</CardTitle>
                <CardDescription>Create a new admin account with configured settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Security PIN Section */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <Label htmlFor="pin" className="text-sm font-semibold">
                    Security PIN *
                  </Label>
                </div>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  required
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                    setPin(value)
                    if (error && error.includes("PIN")) {
                      setError(null)
                    }
                  }}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 4-digit security PIN to create an admin account
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="My Business"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <PasswordInput
                    id="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <PasswordInput
                    id="confirmPassword"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    type="tel"
                    placeholder="+1234567890"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="databaseMode">Database Mode *</Label>
                  <Select value={databaseMode} onValueChange={(value: "supabase" | "indexeddb") => setDatabaseMode(value)} disabled={isLoading}>
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
                <Label htmlFor="businessAddress">Business Address</Label>
                <Input
                  id="businessAddress"
                  type="text"
                  placeholder="123 Main St, City, State"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingMode">Billing Mode *</Label>
                <Select value={billingMode} onValueChange={(value: "b2b" | "b2c" | "both") => setBillingMode(value)} disabled={isLoading}>
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
                  <Label htmlFor="allowB2B">Allow B2B Mode</Label>
                  <p className="text-xs text-muted-foreground">Enable B2B mode for this admin</p>
                </div>
                <Switch
                  id="allowB2B"
                  checked={allowB2BMode}
                  onCheckedChange={setAllowB2BMode}
                  disabled={isLoading}
                />
              </div>

              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Creating admin..." : "Create Admin"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/admin/manage")} disabled={isLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
