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
import { excelSheetManager } from "@/lib/utils/excel-sync-controller";

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string>("")
  const [initials, setInitials] = useState<string>("U")
  const [storageMode, setStorageMode] = useState<"database" | "excel">("database");
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
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
    const supabase = createClient()
    await supabase.auth.signOut()
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
      const { syncExcelWithDexieAndSupabase } = await import("@/lib/utils/excel-sync-controller")
      await syncExcelWithDexieAndSupabase(storageMode)
    } catch (_) {}
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">{title && <h1 className="text-2xl font-bold">{title}</h1>}</div>

      <div className="flex items-center gap-4">
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

        <Button variant="outline" className="bg-transparent" onClick={() => {
          if (storageMode === 'excel') {
            const before = {
              workbook: !!excelSheetManager.workbook,
              sheets: excelSheetManager.workbook?.SheetNames ?? [],
            }
            excelSheetManager.ensureWorkbookIfNeeded(true)
            const after = {
              workbook: !!excelSheetManager.workbook,
              sheets: excelSheetManager.workbook?.SheetNames ?? [],
            }
            console.log('[ExcelIntegrity][Check] Before:', before, 'After:', after)
            if (after.workbook && after.sheets.length === 4) {
              window.alert('Excel workbook integrity OK: all required sheets present!')
            } else {
              window.alert('Excel workbook auto-repaired. See console logs for details.')
            }
          } else {
            window.alert('Excel Integrity: Switch to Excel mode to check and repair sheets.')
          }
        }}>Check Excel Integrity</Button>

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
                <p className="text-sm font-medium">My Account</p>
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
