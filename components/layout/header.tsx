"use client"

import { Bell, RefreshCw, WifiOff, Wifi, Clock, AlertTriangle } from "lucide-react"
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
import { useUserRole } from "@/lib/hooks/use-user-role"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getActiveDbMode } from "@/lib/utils/db-mode"
import { clearOfflineSession } from "@/lib/utils/offline-auth"
import { useSessionCountdown } from "@/lib/hooks/use-session-countdown"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string>("")
  const [storeName, setStoreName] = useState<string>("")
  const [initials, setInitials] = useState<string>("U")
  const [hasMounted, setHasMounted] = useState(false);
  const [databaseType, setDatabaseType] = useState<'Local' | 'Supabase'>('Local');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { role, isAdmin, isEmployee, isPublic, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true)
  const [b2bMode, setB2bMode] = useState<boolean | null>(null)
  const [dbMode, setDbMode] = useState<'indexeddb' | 'supabase' | null>(null)
  const sessionCountdown = useSessionCountdown()

  useEffect(() => {
    const fetchUser = async () => {
      // Import B2B mode utility
      const { getB2BModeConfig } = await import("@/lib/utils/b2b-mode")
      
      // Check for employee session first
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            setUserEmail(session.employeeName || session.employeeId || "Employee")
            setInitials(session.employeeName?.charAt(0).toUpperCase() || session.employeeId?.charAt(0).toUpperCase() || "E")

            // Fetch store name for employee
            const storeId = session.storeId || localStorage.getItem("currentStoreId")
            if (storeId) {
              const supabase = createClient()
              const { data: storeData } = await supabase.from("stores").select("name").eq("id", storeId).single()
              if (storeData) {
                setStoreName(storeData.name)
              }
            }

            // Fetch B2B mode config for employee
            try {
              const b2bConfig = await getB2BModeConfig()
              console.log("[Header] Employee B2B Config:", b2bConfig)
              // For employees, show their personal B2B mode preference
              setB2bMode(b2bConfig.isB2BEnabled)
              
              // Also fetch DB mode for employee
              const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
              const dbType = await getActiveDbModeAsync()
              console.log("[Header] Employee DB Mode:", dbType)
              setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local')
              setDbMode(dbType)
            } catch (error) {
              console.error("[Header] Error fetching employee B2B/DB config:", error)
            }
            return
          } catch (e) {
            console.error("[Header] Error parsing employee session:", e)
            // Fall through to Supabase check
          }
        }
      }

      // Check for Supabase user (admin)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setInitials(user.email.charAt(0).toUpperCase())

        // Fetch store name for admin
        const storeId = localStorage.getItem("currentStoreId")
        if (storeId) {
          const { data: storeData } = await supabase.from("stores").select("name").eq("id", storeId).eq("admin_user_id", user.id).single()
          if (storeData) {
            setStoreName(storeData.name)
          }
        }

        // Fetch B2B mode config for admin (admin's own mode)
        try {
          const b2bConfig = await getB2BModeConfig()
          console.log("[Header] Admin B2B Config:", b2bConfig)
          setB2bMode(b2bConfig.isB2BEnabled)
          
          // Also ensure DB mode is set for admin
          const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
          const dbType = await getActiveDbModeAsync()
          console.log("[Header] Admin DB Mode:", dbType)
          setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local')
          setDbMode(dbType)
        } catch (error) {
          console.error("[Header] Error fetching admin B2B/DB config:", error)
        }
      }
    }
    fetchUser()

    // Listen for storage changes to refresh B2B mode when updated
    const handleStorageRefresh = () => {
      fetchUser()
    }
    window.addEventListener('storage', handleStorageRefresh)

    return () => {
      window.removeEventListener('storage', handleStorageRefresh)
    }
  }, [])


  useEffect(() => {
    setHasMounted(true);
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true)

    // Get current database type (async for employees to get admin's mode)
    const updateDbMode = async () => {
      try {
        const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
        const dbType = await getActiveDbModeAsync()
        console.log("[Header] DB Mode fetched:", dbType)
        setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local')
        setDbMode(dbType)
      } catch (error) {
        console.error("[Header] Error fetching DB mode:", error)
        // Fallback to sync version
        const dbType = getActiveDbMode();
        setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local');
        setDbMode(dbType);
      }
    }
    updateDbMode()

    // Set initial value synchronously (may be stale for employees, but will update)
    const dbType = getActiveDbMode();
    setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local');
    setDbMode(dbType);

    // Listen for database type changes
    const handleStorageChange = async () => {
      const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
      const dbType = await getActiveDbModeAsync()
      setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local')
      setDbMode(dbType)
    };

    window.addEventListener('storage', handleStorageChange);
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Also check periodically (in case changed in same tab) - async for employees
    const interval = setInterval(async () => {
      try {
        const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode")
        const dbType = await getActiveDbModeAsync()
        setDatabaseType(dbType === 'supabase' ? 'Supabase' : 'Local')
        setDbMode(dbType)
        
        // Also refresh B2B mode
        const { getB2BModeConfig } = await import("@/lib/utils/b2b-mode")
        const b2bConfig = await getB2BModeConfig()
        setB2bMode(b2bConfig.isB2BEnabled)
      } catch (error) {
        console.error("[Header] Error in periodic refresh:", error)
      }
    }, 3000); // Check every 3 seconds for real-time sync

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval);
    };
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
    clearOfflineSession()

    // Clear IndexedDB session
    const { clearAuthSession } = await import("@/lib/utils/auth-session")
    await clearAuthSession()

    // Redirect to login
    router.push("/auth/login")
    router.refresh()
  }

  // no storage mode persistence anymore


  const handleRefresh = () => {
    setIsRefreshing(true)
    console.log("[Header] Manual refresh triggered")
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">{title && <h1 className="text-2xl font-bold">{title}</h1>}</div>

      <div className="flex items-center gap-4">
        {/* Show current database type */}
        {hasMounted && (
          <Badge
            variant={databaseType === 'Supabase' ? "default" : "secondary"}
            className="text-xs font-semibold"
          >
            {databaseType}
          </Badge>
        )}

        {/* Show role badge prominently */}
        {role && !roleLoading && (
          <Badge
            variant={isAdmin ? "default" : isEmployee ? "secondary" : "outline"}
            className="text-xs font-semibold"
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Badge>
        )}


        {/* Store name badge */}
        {storeName && (
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-primary/10"
          >
            🏪 {storeName}
          </Badge>
        )}

        {/* Session Countdown Timer - Only show if authenticated and not expired */}
        {!isPublic && sessionCountdown.hasSession && !sessionCountdown.isExpired && sessionCountdown.timeLeft > 0 && (
          <Badge
            variant={sessionCountdown.isExpiringSoon ? "destructive" : "outline"}
            className="flex items-center gap-1.5 text-xs font-semibold min-w-[80px] justify-center"
            title={`Session expires in ${sessionCountdown.timeLeftFormatted}`}
          >
            {sessionCountdown.isExpiringSoon ? (
              <AlertTriangle className="h-3 w-3 animate-pulse" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            <span className={sessionCountdown.isExpiringSoon ? "font-bold" : ""}>
              {sessionCountdown.timeLeftFormatted}
            </span>
          </Badge>
        )}

        {/* Connection status */}
        <Badge
          variant={isOnline ? "outline" : "destructive"}
          className="flex items-center gap-1 text-xs font-semibold"
        >
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              Online
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Offline
            </>
          )}
        </Badge>

        {/* Manual refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Reload current data"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>


        {/* Mode Indicators: B2B/B2C and Database Mode */}
        <div className="flex items-center gap-2 ml-2">
          {b2bMode !== null && (
            <Badge 
              variant={b2bMode ? "default" : "secondary"} 
              title={
                isEmployee 
                  ? (b2bMode ? "Your B2B (Business-to-Business) mode is enabled" : "Your B2C (Business-to-Consumer) mode is active")
                  : (b2bMode ? "B2B (Business-to-Business) mode is enabled" : "B2C (Business-to-Consumer) mode is active")
              }
            >
              Mode: {b2bMode ? "B2B" : "B2C"}
            </Badge>
          )}
          {dbMode && (
            <Badge 
              variant="outline" 
              title={
                isEmployee 
                  ? `Database: ${dbMode === 'supabase' ? 'Supabase (Cloud) - Inherited from admin' : 'IndexedDB (Local) - Inherited from admin'}`
                  : `Database: ${dbMode === 'supabase' ? 'Supabase (Cloud)' : 'IndexedDB (Local)'}`
              }
            >
              DB: {dbMode === 'supabase' ? 'Supabase' : 'IndexedDB'}
            </Badge>
          )}
        </div>

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
            {isAdmin && (
              <DropdownMenuItem onClick={() => router.push("/settings/business")}>Business Settings</DropdownMenuItem>
            )}
            {isEmployee && (
              <DropdownMenuItem onClick={() => router.push("/settings/employee")}>Employee Settings</DropdownMenuItem>
            )}
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
