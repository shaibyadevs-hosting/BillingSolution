"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getAuthSession, clearAuthSession, getSessionDuration } from "@/lib/utils/auth-session"
import { getActiveDbModeAsync } from "@/lib/utils/db-mode"
import { getSupabaseSessionRemaining } from "@/lib/utils/session-expiry-checker"
import { useToast } from "@/hooks/use-toast"

interface SessionCountdown {
  timeLeft: number // milliseconds remaining
  timeLeftFormatted: string // "1m 30s" format
  isExpired: boolean
  isExpiringSoon: boolean // true if less than 30 seconds remaining
  percentage: number // 0-100 percentage of session remaining
  hasSession: boolean // true if user has a valid session
}

const WARNING_THRESHOLD_MS = 30000 // 30 seconds before expiry
const CHECK_INTERVAL_MS = 1000 // Check every second for UI updates
const SESSION_VALIDATION_INTERVAL_MS = 30000 // Only validate session with getAuthSession every 30 seconds

// Public routes that don't need session countdown
const PUBLIC_ROUTES = ["/auth/login", "/auth/signup", "/auth/employee-login", "/auth/customer-login", "/auth/session-expired", "/license", "/"]

export function useSessionCountdown(): SessionCountdown {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isExpired, setIsExpired] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [sessionDuration, setSessionDuration] = useState<number>(24 * 60 * 60 * 1000) // Default 24 hours
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const warningShownRef = useRef(false)
  const lastValidationRef = useRef<number>(0)
  const cachedSessionRef = useRef<any>(null)

  const formatTime = useCallback((ms: number): string => {
    if (ms <= 0) return "0s"
    
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }, [])

  const checkSession = useCallback(async () => {
    // Don't check on public routes or license seed pages
    if (pathname?.startsWith("/admin/license-seed")) {
      return
    }
    
    // Don't check on public routes
    if (pathname && PUBLIC_ROUTES.includes(pathname)) {
      setHasSession(false)
      setTimeLeft(0)
      setIsExpired(false)
      return
    }

    try {
      // Check database mode first
      const dbMode = await getActiveDbModeAsync()
      
      if (dbMode === "supabase") {
        // Supabase mode: Check based on last_login_time (24 hours)
        const supabaseDuration = 24 * 60 * 60 * 1000
        setSessionDuration(supabaseDuration)
        
        const remaining = await getSupabaseSessionRemaining()
        
        if (remaining === null) {
          // No session or error
          setHasSession(false)
          setIsExpired(true)
          setTimeLeft(0)
          return
        }
        
        if (remaining <= 0) {
          // Session expired
          setIsExpired(true)
          setTimeLeft(0)
          setHasSession(false)
          
          // Clear session and redirect
          await clearAuthSession()
          if (typeof window !== "undefined") {
            localStorage.removeItem("authType")
            localStorage.removeItem("employeeSession")
            localStorage.removeItem("offlineAdminSession")
          }
          
          toast({
            title: "Session Expired",
            description: "Your session has expired (24 hours). Please log in again.",
            variant: "destructive",
          })
          
          router.push("/auth/session-expired")
          return
        }
        
        setTimeLeft(remaining)
        setIsExpired(false)
        setHasSession(true)
        
        // Show warning if expiring soon (only once)
        if (remaining <= WARNING_THRESHOLD_MS && !warningShownRef.current) {
          warningShownRef.current = true
          toast({
            title: "Session Expiring Soon",
            description: `Your session will expire in ${formatTime(remaining)}. Please save your work.`,
            variant: "default",
          })
        }
        
        // Reset warning flag if time increases
        if (remaining > WARNING_THRESHOLD_MS) {
          warningShownRef.current = false
        }
        
        return
      }
      
      // IndexedDB mode: Use existing session duration
      const indexedDbDuration = getSessionDuration()
      setSessionDuration(indexedDbDuration)
      
      // IndexedDB mode: Use existing session expiry mechanism
      // Only call getAuthSession every 30 seconds to reduce API calls
      // Use cached session for countdown updates between validations
      const now = Date.now()
      const timeSinceLastValidation = now - lastValidationRef.current
      
      let session = cachedSessionRef.current
      
      // Only validate session if cache is old or doesn't exist
      if (!session || timeSinceLastValidation >= SESSION_VALIDATION_INTERVAL_MS) {
        session = await getAuthSession()
        cachedSessionRef.current = session
        lastValidationRef.current = now
      }
      
      if (!session) {
        // Check for employee session as fallback
        const authType = typeof window !== "undefined" ? localStorage.getItem("authType") : null
        const employeeSession = typeof window !== "undefined" ? localStorage.getItem("employeeSession") : null
        
        if (authType === "employee" && employeeSession) {
          // Employee session exists but no IndexedDB session
          // Try to get session again - it might have been created after login
          // For now, assume session is valid if employee session exists
          // The AuthGuard will handle expiry checking
          const sessionDuration = getSessionDuration()
          // Use a conservative estimate - assume session started recently
          // We can't know exact expiry without IndexedDB, so show full duration
          setTimeLeft(sessionDuration)
          setHasSession(true)
          setIsExpired(false)
          warningShownRef.current = false
          return
        }

        // Check for offline admin session
        const offlineAdminSession = typeof window !== "undefined" ? localStorage.getItem("offlineAdminSession") : null
        if (offlineAdminSession) {
          try {
            const parsed = JSON.parse(offlineAdminSession)
            if (parsed.email && parsed.role) {
              // Offline session exists but no IndexedDB session
              // Similar to employee - assume valid for now
              const sessionDuration = getSessionDuration()
              setTimeLeft(sessionDuration)
              setHasSession(true)
              setIsExpired(false)
              warningShownRef.current = false
              return
            }
          } catch (e) {
            // Invalid session
          }
        }

        setHasSession(false)
        setIsExpired(true)
        setTimeLeft(0)
        return
      }

      // Calculate remaining time using cached session (no need to call getAuthSession again)
      const remaining = session.expiresAt - Date.now()

      if (remaining <= 0) {
        // Session expired
        setIsExpired(true)
        setTimeLeft(0)
        setHasSession(false)
        
        // Clear session and redirect
        await clearAuthSession()
        if (typeof window !== "undefined") {
          localStorage.removeItem("authType")
          localStorage.removeItem("employeeSession")
          localStorage.removeItem("offlineAdminSession")
        }
        
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        })
        
        router.push("/auth/session-expired")
        return
      }

      setTimeLeft(remaining)
      setIsExpired(false)
      setHasSession(true)

      // Show warning if expiring soon (only once)
      if (remaining <= WARNING_THRESHOLD_MS && !warningShownRef.current) {
        warningShownRef.current = true
        toast({
          title: "Session Expiring Soon",
          description: `Your session will expire in ${formatTime(remaining)}. Please save your work.`,
          variant: "default",
        })
      }

      // Reset warning flag if time increases (session refreshed)
      if (remaining > WARNING_THRESHOLD_MS) {
        warningShownRef.current = false
      }
    } catch (error) {
      console.error("[useSessionCountdown] Error checking session:", error)
      setIsExpired(true)
      setTimeLeft(0)
      setHasSession(false)
    }
  }, [router, toast, formatTime, pathname])

  useEffect(() => {
    // Reset warning flag on pathname change
    warningShownRef.current = false

    // Initial check
    checkSession()

    // Set up interval to check every second
    const interval = setInterval(() => {
      checkSession()
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [checkSession])

  const percentage = sessionDuration > 0 ? Math.max(0, Math.min(100, (timeLeft / sessionDuration) * 100)) : 0
  const isExpiringSoon = timeLeft > 0 && timeLeft <= WARNING_THRESHOLD_MS

  return {
    timeLeft,
    timeLeftFormatted: formatTime(timeLeft),
    isExpired,
    isExpiringSoon,
    percentage,
    hasSession,
  }
}

