"use client"

import { useEffect } from "react"

/**
 * Service Worker Registration Component
 * Simplified: Registers once on app load, only when online
 * Removed: Complex cleanup, visibility change re-registration, excessive checks
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    // Only register when online - SW is primarily for offline IndexedDB mode
    if (!navigator.onLine) {
      console.log("[SW] Offline - skipping service worker registration")
      return
    }

    const registerSW = async () => {
      try {
        // Check if already registered and active
        const registrations = await navigator.serviceWorker.getRegistrations()
        const existing = registrations.find(
          (reg) =>
            reg.scope === window.location.origin + "/" &&
            reg.active?.scriptURL.includes("sw.js")
        )

        if (existing?.active?.state === "activated") {
          console.log("[SW] Service worker already registered and active")
          return
        }

        // Register service worker (simple, no complex validation)
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })

        console.log("[SW] Service Worker registered:", registration.scope)
      } catch (error) {
        // Fail silently - app works without service worker
        console.warn("[SW] Registration failed (non-critical):", error)
      }
    }

    // Register once after page load
    setTimeout(() => {
      registerSW()
    }, 100)
  }, [])

  return null
}
