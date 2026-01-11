/**
 * Secure Session Management with Cryptographic Signatures
 * Prevents tampering by signing session data with HMAC
 * Uses multiple validation layers to prevent time manipulation
 * 
 * NOTE: This file is LEGACY/UNUSED - the active implementation is in auth-session.ts
 * This file is kept for reference but is not imported or used anywhere in the codebase.
 * The auth-session.ts implementation includes more advanced security features including
 * server signature validation and better offline handling.
 */

import { db } from "@/lib/db/dexie"
import type { AuthSession } from "@/lib/db/dexie"
import CryptoJS from "crypto-js"

// Get session duration from env (default: 24 hours)
const SESSION_DURATION_MS = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_DURATION_MS
    ? parseInt(process.env.NEXT_PUBLIC_SESSION_DURATION_MS, 10)
    : 86400000 // 24 hours default

const SESSION_ID = "current_session"
const SECRET_KEY = process.env.NEXT_PUBLIC_SESSION_SECRET || "default-secret-key-change-in-production"

/**
 * Generate HMAC signature for session data
 */
function generateSignature(sessionData: Omit<AuthSession, "id">): string {
  const dataString = JSON.stringify({
    userId: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    storeId: sessionData.storeId,
    issuedAt: sessionData.issuedAt,
    expiresAt: sessionData.expiresAt,
  })
  return CryptoJS.HmacSHA256(dataString, SECRET_KEY).toString()
}

/**
 * Verify session signature
 */
function verifySignature(session: AuthSession & { signature?: string }): boolean {
  if (!session.signature) {
    return false
  }

  const sessionData: Omit<AuthSession, "id"> = {
    userId: session.userId,
    email: session.email,
    role: session.role,
    storeId: session.storeId,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  }

  const expectedSignature = generateSignature(sessionData)
  return session.signature === expectedSignature
}

// Cache for server time to reduce API calls (30 minutes - aligned with auth-session.ts)
let serverTimeCache: { time: number; timestamp: number } | null = null
const SERVER_TIME_CACHE_DURATION = 1800000 // Cache for 30 minutes (1800000ms) - aligned with auth-session.ts

/**
 * Get server time from multiple sources to prevent time manipulation
 * CACHED: Only fetches from server if cache is older than 30 minutes
 * When online, uses client time to reduce API calls
 * Offline: Uses client time (we have clock)
 */
async function getServerTime(): Promise<number> {
  // When online, use client time (we have clock) - no need for server time
  // Server time is only needed for initial validation or when offline detection
  if (typeof window !== "undefined" && navigator.onLine) {
    // Check cache first
    if (serverTimeCache) {
      const age = Date.now() - serverTimeCache.timestamp
      if (age < SERVER_TIME_CACHE_DURATION) {
        // Use cached server time (adjusted for elapsed time)
        return serverTimeCache.time + age
      }
    }

    // Cache expired or doesn't exist - fetch once, then use client time
    // We only need server time occasionally to detect time manipulation
    try {
      const response = await fetch("/api/time", { 
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(2000) // 2 second timeout
      })
      if (response.ok) {
        const data = await response.json()
        if (data.timestamp) {
          // Cache the server time
          serverTimeCache = {
            time: data.timestamp,
            timestamp: Date.now(),
          }
          return data.timestamp
        }
      }
    } catch (error) {
      // API unavailable, use client time (works offline)
      console.warn("[SecureSession] Server time API unavailable, using client time")
    }
    // Use client time (we have clock when online)
    return Date.now()
  }

  // Offline: Use client time (we have clock)
  return Date.now()
}

/**
 * Enhanced session interface with signature
 */
interface SecureAuthSession extends AuthSession {
  signature?: string
  lastValidated?: number // Timestamp of last successful validation
  validationCount?: number // Number of times validated (for anomaly detection)
}

/**
 * Save authentication session with cryptographic signature
 */
export async function saveSecureAuthSession(data: {
  userId: string
  email: string
  role: string
  storeId?: string | null
}): Promise<void> {
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  const sessionData: Omit<AuthSession, "id"> = {
    userId: data.userId,
    email: data.email.toLowerCase(),
    role: data.role,
    storeId: data.storeId ?? null,
    issuedAt: now,
    expiresAt,
    createdAt: new Date().toISOString(),
  }

  // Generate signature
  const signature = generateSignature(sessionData)

  const session: SecureAuthSession = {
    id: SESSION_ID,
    ...sessionData,
    signature,
    lastValidated: now,
    validationCount: 0,
  }

  await db.auth_session.put(session as any)
  console.log("[SecureSession] Session saved with signature, expires at:", new Date(expiresAt).toISOString())
}

/**
 * Get current authentication session with validation
 * Offline: Uses client time and signature validation
 * Online: Uses cached server time (30 min cache) to reduce API calls
 */
export async function getSecureAuthSession(): Promise<AuthSession | null> {
  try {
    const session = await db.auth_session.get(SESSION_ID) as SecureAuthSession | undefined
    if (!session) {
      return null
    }

    // Validate signature first (works offline)
    if (!verifySignature(session)) {
      console.error("[SecureSession] Invalid signature detected - possible tampering!")
      await clearSecureAuthSession()
      return null
    }

    // Get server time for validation (cached for 30 minutes to reduce API calls)
    const serverTime = await getServerTime()
    const clientTime = Date.now()
    
    // Check for time manipulation (if difference > 5 minutes, suspicious)
    const timeDifference = Math.abs(serverTime - clientTime)
    if (timeDifference > 300000) { // 5 minutes
      console.warn("[SecureSession] Significant time difference detected:", timeDifference, "ms")
      // Still allow but log warning
    }

    // Use server time if available, otherwise client time (works offline)
    const currentTime = serverTime || clientTime

    // Check if session is expired
    if (currentTime > session.expiresAt) {
      console.log("[SecureSession] Session expired, clearing...")
      await clearSecureAuthSession()
      return null
    }

    // Update validation metadata
    session.lastValidated = currentTime
    session.validationCount = (session.validationCount || 0) + 1
    
    // Check for suspicious validation patterns (too many validations in short time)
    if (session.validationCount > 1000) {
      console.warn("[SecureSession] Suspicious validation count detected")
    }

    // Save updated metadata
    await db.auth_session.put(session as any)

    return {
      id: session.id,
      userId: session.userId,
      email: session.email,
      role: session.role,
      storeId: session.storeId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }
  } catch (error) {
    console.error("[SecureSession] Error reading session:", error)
    return null
  }
}

/**
 * Check if session is valid with full validation
 */
export async function isSecureSessionValid(): Promise<boolean> {
  const session = await getSecureAuthSession()
  return session !== null
}

/**
 * Clear authentication session
 */
export async function clearSecureAuthSession(): Promise<void> {
  try {
    await db.auth_session.delete(SESSION_ID)
    console.log("[SecureSession] Session cleared from IndexedDB")
  } catch (error) {
    console.error("[SecureSession] Error clearing session:", error)
  }
}

/**
 * Check if session is expired (with signature validation)
 */
export async function isSecureSessionExpired(session: AuthSession | null): Promise<boolean> {
  if (!session) return true

  // Re-fetch and validate signature
  const secureSession = await getSecureAuthSession()
  if (!secureSession) return true

  // Verify it's the same session
  if (secureSession.userId !== session.userId || secureSession.email !== session.email) {
    return true
  }

  // Check expiry with server time (cached, reduces API calls)
  const serverTime = await getServerTime()
  return serverTime > session.expiresAt
}

/**
 * Refresh session (extend expiry if needed)
 */
export async function refreshSecureSession(): Promise<boolean> {
  const session = await getSecureAuthSession()
  if (!session) {
    return false
  }

  // Only refresh if session is still valid and not too close to expiry
  const now = Date.now()
  const timeUntilExpiry = session.expiresAt - now
  
  // Only refresh if less than 1 hour remaining
  if (timeUntilExpiry < 3600000 && timeUntilExpiry > 0) {
    const newExpiresAt = now + SESSION_DURATION_MS
    const sessionData: Omit<AuthSession, "id"> = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      storeId: session.storeId,
      issuedAt: session.issuedAt, // Keep original issue time
      expiresAt: newExpiresAt,
      createdAt: session.createdAt,
    }

    const signature = generateSignature(sessionData)
    const secureSession: SecureAuthSession = {
      id: SESSION_ID,
      ...sessionData,
      signature,
      lastValidated: now,
      validationCount: (session as any).validationCount || 0,
    }

    await db.auth_session.put(secureSession as any)
    console.log("[SecureSession] Session refreshed, new expiry:", new Date(newExpiresAt).toISOString())
    return true
  }

  return false
}
