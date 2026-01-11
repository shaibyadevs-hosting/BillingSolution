"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { db } from "@/lib/dexie-client"
import { toast } from "sonner"
import { CheckCircle2, LogOut, ArrowLeft, Loader2 } from "lucide-react"
import {
  attemptOfflineLogin,
  clearOfflineSession,
  getOfflineSession,
  isOfflineLoginEnabled,
  persistOfflineCredential,
  saveOfflineSession,
} from "@/lib/utils/offline-auth"
import { clearLicense } from "@/lib/utils/license-manager"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [offlineEnabled, setOfflineEnabled] = useState(false)
  const [clearingLicense, setClearingLicense] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setOfflineEnabled(isOfflineLoginEnabled())
  }, [])

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isExcel = false
        
        // First, check if IndexedDB session exists and is valid
        const { getAuthSession, isSessionExpired } = await import("@/lib/utils/auth-session")
        const indexedDbSession = await getAuthSession()
        
        // If IndexedDB session is expired or missing, but Supabase session exists,
        // we need to logout from Supabase first
        if (!indexedDbSession || isSessionExpired(indexedDbSession)) {
          // Check if Supabase thinks user is logged in
          const supabase = createClient()
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
            // Supabase session exists but IndexedDB session expired
            // Auto-logout from Supabase to prevent "already logged in" message (only if online)
            if (typeof window !== "undefined" && navigator.onLine) {
              console.log("[Login] IndexedDB session expired but Supabase session exists, logging out from Supabase")
              try {
                await supabase.auth.signOut()
                console.log("[Login] Supabase logout successful")
              } catch (error) {
                console.error("[Login] Supabase logout failed:", error)
              }
            } else {
              console.log("[Login] Offline - Cannot logout from Supabase, will clear local sessions only")
            }
              // Clear all local storage
              localStorage.removeItem("authType")
              localStorage.removeItem("employeeSession")
              localStorage.removeItem("offlineAdminSession")
              localStorage.removeItem("currentStoreId")
              // Don't redirect, let user login fresh
              setCheckingAuth(false)
              return
            }
          } catch (error) {
            // Supabase unavailable, continue with normal flow
            console.log("[Login] Supabase unavailable, continuing")
          }
        }
        
        // Check for employee session first
        const authType = localStorage.getItem("authType")
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            try {
              const session = JSON.parse(employeeSession)
              // Verify IndexedDB session is still valid
              if (indexedDbSession && !isSessionExpired(indexedDbSession)) {
              setCurrentUser({ 
                email: session.employeeName || session.employeeId, 
                name: session.employeeName 
              })
              setCurrentRole("employee")
              
              console.log("[Login] Employee session found, redirecting to /dashboard")
              router.push("/dashboard")
              router.refresh()
              setCheckingAuth(false)
              return
              } else {
                // Session expired, clear employee session
                localStorage.removeItem("employeeSession")
                localStorage.removeItem("authType")
              }
            } catch (e) {
              // Invalid session
              console.error("[Login] Invalid employee session:", e)
            }
          }
        }

        // Check for Supabase user
        const supabase = createClient()
        let userResponse
        try {
          userResponse = await supabase.auth.getUser()
        } catch (error) {
          console.warn("[Login] Supabase unavailable, checking offline session", error)
          const offlineSession = getOfflineSession()
          if (offlineSession && indexedDbSession && !isSessionExpired(indexedDbSession)) {
            setCurrentUser({ email: offlineSession.email, name: offlineSession.email })
            setCurrentRole(offlineSession.role)
            router.push("/dashboard")
            router.refresh()
            setCheckingAuth(false)
            return
          }
          throw error
        }
        const { data: { user } } = userResponse
        
        // Only auto-redirect if IndexedDB session is also valid
        if (user && indexedDbSession && !isSessionExpired(indexedDbSession)) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single()
          
          const userRole = profile?.role || "admin"
          
          setCurrentUser({ email: user.email, name: user.email })
          setCurrentRole(userRole)
          
          console.log("[Login] Authenticated user detected, role:", userRole)
          
          // Auto-redirect based on role
          if (userRole === "admin" || !profile) {
            console.log("[Login] Admin user authenticated")
            
            // On login, don't check for stores - just redirect to dashboard/analytics
            // Store setup should only happen on first signup, not on every login
            if (isExcel) {
              const stores = await db.stores.toArray()
              if (stores && stores.length > 0) {
                const store = stores[0]
                localStorage.setItem("currentStoreId", store.id)
              }
              console.log("[Login] Redirecting admin to /admin/analytics")
              router.push("/admin/analytics")
            } else {
              // Supabase mode - check for stores but don't redirect to setup
              const { data: stores } = await supabase
                .from("stores")
                .select("*")
                .eq("admin_user_id", user.id)
                .limit(1)
              
              if (stores && stores.length > 0) {
                const store = stores[0]
                localStorage.setItem("currentStoreId", store.id)
              }
              
              console.log("[Login] Redirecting admin to /admin/analytics")
              router.push("/admin/analytics")
            }
            router.refresh()
          } else {
            // Public user
            console.log("[Login] Public user authenticated, redirecting to /dashboard")
            router.push("/dashboard")
            router.refresh()
          }
        }
      } catch (error) {
        console.error("[Login] Error checking auth:", error)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tryOfflineFallback = async () => {
    try {
      console.log("[Login] Attempting offline login fallback")
      const result = await attemptOfflineLogin(email, password)
      if (result.success) {
        toast.success("Logged in (offline mode)")
        router.push("/dashboard")
        router.refresh()
        return true
      }
      return false
    } catch (error) {
      console.error("[Login] Offline fallback failed:", error)
      return false
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      let resolvedStoreId: string | null = localStorage.getItem("currentStoreId")
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Get user role and check for store
      const isExcel = false
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        
        const userRole = profile?.role || "admin"
        
        // Update last login time in user_profiles
        await supabase
          .from("user_profiles")
          .update({ last_login_time: new Date().toISOString() })
          .eq("id", user.id)
        
        // Update current user state
        setCurrentUser({ email: user.email, name: user.email })
        setCurrentRole(userRole)
        
        // Show login success message with role
        toast.success(`Logged in as ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`)
        
        console.log("[Login] User role detected:", userRole)
        console.log("[Login] Database mode:", isExcel ? "Excel" : "Supabase")
        
        // For admin users, check if they have a store
        if (userRole === "admin" || !profile) {
          console.log("[Login] Admin user detected, checking for stores...")
          if (isExcel) {
            // Excel mode - check Dexie for stores
            const stores = await db.stores.toArray()
            
            // Don't redirect to store setup on every login - only on first signup
            // For Excel mode, we can't easily detect first signup, so just don't redirect
            // Users can manually navigate to settings if they need to set up a store
            if (stores && stores.length > 0) {
              // Store exists, save first store to localStorage
              const store = stores[0]
              localStorage.setItem("currentStoreId", store.id)
              resolvedStoreId = store.id
            }
            console.log("[Login] Redirecting admin to /admin/analytics")
            router.push("/admin/analytics")
          } else {
            // Supabase mode - check for stores but only redirect to setup on first signup
            const { data: stores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            // Check if this is a new account (created within last hour) - first login after signup
            const { data: userProfile } = await supabase
              .from("user_profiles")
              .select("created_at")
              .eq("id", user.id)
              .single()
            
            const isNewAccount = userProfile?.created_at && 
              (new Date().getTime() - new Date(userProfile.created_at).getTime()) < 3600000 // 1 hour
            
            // Only redirect to store setup if: no stores exist AND it's a new account (first login)
            if ((!stores || stores.length === 0) && isNewAccount) {
              console.log("[Login] New account with no stores, redirecting to store setup")
              router.push("/settings/store")
              router.refresh()
              return
            }
            
            // Store exists or not a new account - save store if exists and go to analytics
            if (stores && stores.length > 0) {
              const store = stores[0]
              localStorage.setItem("currentStoreId", store.id)
              resolvedStoreId = store.id
            }
            console.log("[Login] Redirecting admin to /admin/analytics")
            router.push("/admin/analytics")
          }
        } else {
          // Public user
          console.log("[Login] Public user detected, redirecting to /dashboard")
          router.push("/dashboard")
        }
        // Save session to IndexedDB for offline access
        if (user) {
          const { saveAuthSession } = await import("@/lib/utils/auth-session")
          await saveAuthSession({
            userId: user.id,
            email: user.email || email,
            role: userRole,
            storeId: resolvedStoreId,
          })
          console.log("[Login] Session saved to IndexedDB")
        }

        if (offlineEnabled) {
          await persistOfflineCredential(email, password, { role: userRole, storeId: resolvedStoreId })
          saveOfflineSession({
            email,
            role: userRole,
            storeId: resolvedStoreId,
          })
        }
      } else {
        console.log("[Login] Warning: User not found after successful login")
        router.push("/dashboard")
      }
      router.refresh()
    } catch (error: unknown) {
      const offlineSuccess = await tryOfflineFallback()
      if (!offlineSuccess) {
        setError(error instanceof Error ? error.message : "An error occurred")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    const authType = localStorage.getItem("authType")
    
    if (authType === "employee") {
      localStorage.removeItem("employeeSession")
      localStorage.removeItem("currentStoreId")
      localStorage.removeItem("authType")
    } else {
      await supabase.auth.signOut()
    }
    
    // Clear IndexedDB session
    const { clearAuthSession } = await import("@/lib/utils/auth-session")
    await clearAuthSession()
    
    clearOfflineSession()
    setCurrentUser(null)
    setCurrentRole(null)
    router.push("/auth/login")
    router.refresh()
  }

  const handleClearLicense = async () => {
    if (!confirm("Are you sure you want to reset the license?\n\nThis will:\n- Remove all license data from this computer\n- Reset this PC to a completely new installation state\n- Require you to activate with a license key again\n\nThis action cannot be undone.")) {
      return;
    }

    setClearingLicense(true);
    setError(null);

    try {
      console.log('[LoginPage] Clearing license...');
      
      // Clear license from IndexedDB
      const result = await clearLicense();
      
      if (result.success) {
        console.log('[LoginPage] License cleared successfully');
        
        // Also clear any cached license data in localStorage (if any)
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            // Clear any license-related localStorage items
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i);
              if (key && (key.toLowerCase().includes('license') || key.toLowerCase().includes('activation'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => {
              window.localStorage.removeItem(key);
              console.log('[LoginPage] Removed localStorage key:', key);
            });
          }
        } catch (localStorageError) {
          console.warn('[LoginPage] Error clearing localStorage:', localStorageError);
        }
        
        toast.success("License reset successfully. Redirecting to license page...");
        
        // Redirect to license page
        setTimeout(() => {
          console.log('[LoginPage] Redirecting to license page...');
          router.push("/license");
        }, 1500);
      } else {
        console.error('[LoginPage] Failed to clear license:', result.error);
        toast.error(result.error || "Failed to reset license");
      }
    } catch (err: any) {
      console.error("[LoginPage] Error clearing license:", err);
      toast.error(err.message || "An unexpected error occurred while resetting license");
    } finally {
      setClearingLicense(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Show current login status */}
        {currentUser && currentRole && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Currently logged in as {currentUser.name || currentUser.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={currentRole === "admin" ? "default" : currentRole === "employee" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{currentUser.email}</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold">Admin/Public Login</CardTitle>
                <CardDescription>
                  {currentUser 
                    ? "You are already logged in. Logout to sign in with a different account."
                    : "Enter your credentials to access your billing dashboard"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={isLoading || !!currentUser}>
                {isLoading ? "Signing in..." : currentUser ? "Already Logged In" : "Sign in"}
              </Button>
            </form>
            <div className="mt-4 space-y-2">
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign up
                </Link>
              </div>
              <div className="flex items-center justify-center gap-4 pt-2">
                <Link href="/" className="text-xs text-muted-foreground hover:text-primary">
                  Home
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link href="/auth/employee-login" className="text-xs text-muted-foreground hover:text-primary">
                  Employee Login
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link href="/auth/customer-login" className="text-xs text-muted-foreground hover:text-primary">
                  Customer Login
                </Link>
              </div>
            </div>

            {/* Reset License Button */}
            <div className="mt-6 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
                onClick={handleClearLicense}
                disabled={clearingLicense || isLoading}
              >
                {clearingLicense ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting License...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Reset License
                  </>
                )}
              </Button>
              <p className="mt-2 text-xs text-center text-muted-foreground">
                This will completely remove the license and reset this PC to a new installation state. You will need to activate again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
