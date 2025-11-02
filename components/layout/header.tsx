"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { storageManager } from "@/lib/storage-manager"
import { SyncStatus } from "@/components/sync-status"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string>("")
  const [initials, setInitials] = useState<string>("U")
  const [storageMode, setStorageMode] = useState<"database" | "excel">("database");
  const [hasMounted, setHasMounted] = useState(false);
  const { role, isAdmin, isEmployee, isPublic, isLoading: roleLoading } = useUserRole();

  useEffect(() => {
    const fetchUser = async () => {
      // Check for employee session first
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            setUserEmail(session.employeeName || session.employeeId || "Employee")
            setInitials(session.employeeName?.charAt(0).toUpperCase() || session.employeeId?.charAt(0).toUpperCase() || "E")
            return
          } catch (e) {
            // Fall through to Supabase check
          }
        }
      }

      // Check for Supabase user
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setInitials(user.email.charAt(0).toUpperCase())
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("storageMode");
      if (stored === "database" || stored === "excel") {
        setStorageMode(stored);
      }
    }
  }, []);

  const handleLogout = async () => {
    // Clear employee session if exists
    const authType = localStorage.getItem("authType")
    if (authType === "employee") {
      localStorage.removeItem("employeeSession")
      localStorage.removeItem("currentStoreId")
      localStorage.removeItem("authType")
    }

    // Sign out from Supabase
    const supabase = createClient()
    await supabase.auth.signOut()

    // Redirect to login
    router.push("/auth/login")
    router.refresh()
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("storageMode", storageMode)
    }
  }, [storageMode])

  const handleSyncNow = async () => {
    try {
      const result = await storageManager.saveNowToExcel()
      // The sync:saved or sync:error event will be dispatched by storageManager
      // SyncStatus component will pick it up and display it
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('sync:error', { detail: { error: error?.message || 'Sync failed' } }))
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">{title && <h1 className="text-2xl font-bold">{title}</h1>}</div>

      <div className="flex items-center gap-4">
        {/* Show role badge prominently */}
        {role && !roleLoading && (
          <Badge 
            variant={isAdmin ? "default" : isEmployee ? "secondary" : "outline"} 
            className="text-xs font-semibold"
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Badge>
        )}

        {/* DropdownMenu for storage mode */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-transparent">
              {hasMounted ? `Storage: ${storageMode === "database" ? "Database" : "Excel"}` : "Storage: ..."}
            </Button>
          </DropdownMenuTrigger>
          {hasMounted && (
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStorageMode("database")}>Use Database</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStorageMode("excel")}>Use Excel</DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        <Button variant="outline" className="bg-transparent" onClick={handleSyncNow}>
          Sync Now
        </Button>

        <SyncStatus />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">My Account</p>
                  {role && (
                    <Badge variant={isAdmin ? "default" : isEmployee ? "secondary" : "outline"} className="text-xs">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings/profile")}>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings/business")}>Business Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
