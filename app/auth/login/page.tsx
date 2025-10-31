"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { db } from "@/lib/dexie-client"
import { toast } from "sonner"
import { CheckCircle2, LogOut } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for employee session first
        const authType = localStorage.getItem("authType")
        if (authType === "employee") {
          const employeeSession = localStorage.getItem("employeeSession")
          if (employeeSession) {
            try {
              const session = JSON.parse(employeeSession)
              setCurrentUser({ 
                email: session.employeeName || session.employeeId, 
                name: session.employeeName 
              })
              setCurrentRole("employee")
              setCheckingAuth(false)
              return
            } catch (e) {
              // Invalid session
            }
          }
        }

        // Check for Supabase user
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single()
          
          setCurrentUser({ email: user.email, name: profile?.full_name || user.email })
          setCurrentRole(profile?.role || "admin")
        }
      } catch (error) {
        console.error("Error checking auth:", error)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Get user role and check for store
      const isExcel = getDatabaseType() === 'excel'
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        
        const userRole = profile?.role || "admin"
        
        // Update current user state
        setCurrentUser({ email: user.email, name: profile?.full_name || user.email })
        setCurrentRole(userRole)
        
        // Show login success message with role
        toast.success(`Logged in as ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`)
        
        // For admin users, check if they have a store
        if (userRole === "admin" || !profile) {
          if (isExcel) {
            // Excel mode - check Dexie for stores
            const stores = await db.stores.toArray()
            if (!stores || stores.length === 0) {
              router.push("/settings/store")
              router.refresh()
              return
            }
            // Store exists, save first store to localStorage
            const store = stores[0]
            localStorage.setItem("currentStoreId", store.id)
            router.push("/dashboard")
          } else {
            // Supabase mode - check Supabase for stores
            const { data: stores } = await supabase
              .from("stores")
              .select("*")
              .eq("admin_user_id", user.id)
              .limit(1)
            
            // If no store exists, redirect to store setup
            if (!stores || stores.length === 0) {
              router.push("/settings/store")
              router.refresh()
              return
            }
            
            // Store exists, save to localStorage and go to dashboard
            const store = stores[0]
            localStorage.setItem("currentStoreId", store.id)
            router.push("/dashboard")
          }
        } else {
          // Public user
          router.push("/dashboard")
        }
      } else {
        router.push("/dashboard")
      }
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
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
    
    setCurrentUser(null)
    setCurrentRole(null)
    router.refresh()
  }

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
            <CardTitle className="text-2xl font-bold">Admin/Public Login</CardTitle>
            <CardDescription>
              {currentUser 
                ? "You are already logged in. Logout to sign in with a different account."
                : "Enter your credentials to access your billing dashboard"}
            </CardDescription>
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
                <Input
                  id="password"
                  type="password"
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
                <Link href="/auth/employee-login" className="text-xs text-muted-foreground hover:text-primary">
                  Employee Login
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link href="/auth/customer-login" className="text-xs text-muted-foreground hover:text-primary">
                  Customer Login
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
