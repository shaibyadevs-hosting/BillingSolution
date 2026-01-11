"use client"

import { useEffect } from "react"

/**
 * Service Worker Registration Component
 * Registers the service worker for PWA offline functionality
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return

    if ("serviceWorker" in navigator) {
      // Check if we just did a cleanup - wait a bit before re-registering
      const cleanupTime = sessionStorage.getItem("sw_cleanup_done")
      if (cleanupTime) {
        const timeSinceCleanup = Date.now() - parseInt(cleanupTime, 10)
        if (timeSinceCleanup < 3000) {
          console.log("[SW] Recent cleanup detected, waiting before re-registration...")
          // Wait before attempting registration
          setTimeout(() => {
            sessionStorage.removeItem("sw_cleanup_done")
            // Registration will happen on next page load or visibility change
          }, 3000)
          return
        } else {
          sessionStorage.removeItem("sw_cleanup_done")
        }
      }
      const registerSW = async () => {
          // Check if we're offline and already have a service worker
          const isOnline = navigator.onLine
          const existingRegistrations = await navigator.serviceWorker.getRegistrations()
          const currentOrigin = window.location.origin
          
          // Find registrations for this app
          const appRegistrations = existingRegistrations.filter((reg) => {
            const isSameOrigin = reg.scope.startsWith(currentOrigin)
            const isOurSW = reg.active?.scriptURL.includes("sw.js") ||
                           reg.installing?.scriptURL.includes("sw.js") ||
                           reg.waiting?.scriptURL.includes("sw.js")
            return isSameOrigin && isOurSW
          })

          // If we have exactly one active registration, check if it's working
          if (appRegistrations.length === 1) {
            const existing = appRegistrations[0]
            if (existing.active && existing.active.state === "activated") {
              console.log("[SW] Service worker already registered and active:", existing.scope)
              return // Don't register again
            }
          }

          // If offline and we have any registration, don't try to register new one
          if (!isOnline && appRegistrations.length > 0) {
            console.log("[SW] Offline and service worker exists, skipping registration")
            return
          }

          // If offline and no registration exists, we can't register (need sw.js file)
          if (!isOnline && appRegistrations.length === 0) {
            console.warn("[SW] Offline and no service worker found. Cannot register without network.")
            return
          }

          // If we have multiple or broken registrations, clean them up (only when online)
          if (isOnline && (appRegistrations.length > 1 || (appRegistrations.length === 1 && !appRegistrations[0].active))) {
            console.log(`[SW] Found ${appRegistrations.length} registration(s), cleaning up...`)
            for (const registration of appRegistrations) {
              try {
                await registration.unregister()
                console.log("[SW] Unregistered:", registration.scope)
              } catch (err) {
                console.warn("[SW] Failed to unregister:", err)
              }
            }
            // Wait a bit for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          // Only register when online (or if sw.js is cached)
          if (!isOnline) {
            console.log("[SW] Skipping registration - offline")
            return
          }

          // Try to fetch the service worker file first to check if it's accessible
          try {
            const swResponse = await fetch("/sw.js", { 
              cache: "no-store",
              headers: {
                'Cache-Control': 'no-cache'
              }
            })
            if (!swResponse.ok) {
              console.error("[SW] Service worker file not accessible:", swResponse.status, swResponse.statusText)
              return
            }
            
            // Check content type
            const contentType = swResponse.headers.get('content-type')
            if (contentType && !contentType.includes('javascript') && !contentType.includes('text/plain')) {
              console.warn("[SW] Unexpected content type:", contentType)
            }
            
            const swText = await swResponse.text()
            if (!swText || swText.trim().length === 0) {
              console.error("[SW] Service worker file is empty")
              return
            }
            
            // Basic validation - check for required service worker code
            if (swText.indexOf('self.addEventListener') === -1 && swText.indexOf('self') === -1) {
              console.error("[SW] Service worker file doesn't appear to be a valid service worker")
              console.error("[SW] File preview (first 200 chars):", swText.substring(0, 200))
              return
            }
            
            // Check for BOM (Byte Order Mark) which can cause issues
            if (swText.charCodeAt(0) === 0xFEFF) {
              console.warn("[SW] Service worker file has BOM, this might cause issues")
            }
            
            console.log("[SW] Service worker file validated:", {
              size: swText.length,
              contentType: contentType || 'unknown',
              hasAddEventListener: swText.indexOf('addEventListener') !== -1
            })
          } catch (fetchError) {
            console.error("[SW] Failed to fetch service worker file:", fetchError)
            if (fetchError instanceof Error) {
              console.error("[SW] Fetch error details:", {
                message: fetchError.message,
                name: fetchError.name,
                stack: fetchError.stack
              })
            }
            return
          }

          // Check for existing registrations - only register if none exist or if existing is broken
          const preRegistrations = await navigator.serviceWorker.getRegistrations()
          const preAppRegs = preRegistrations.filter(reg => 
            reg.scope.startsWith(window.location.origin) &&
            (reg.active?.scriptURL.includes("sw.js") || reg.installing?.scriptURL.includes("sw.js") || reg.waiting?.scriptURL.includes("sw.js"))
          )
          
          // If we have a working registration, don't register again
          const hasWorkingSW = preAppRegs.some(reg => 
            reg.active && reg.active.state === "activated"
          )
          
          if (hasWorkingSW) {
            console.log("[SW] Working service worker already exists, skipping registration")
            return
          }
          
          // If we have broken registrations, clean them up first
          if (preAppRegs.length > 0) {
            console.log(`[SW] Found ${preAppRegs.length} broken registration(s), cleaning up...`)
            for (const reg of preAppRegs) {
              try {
                await reg.unregister()
                console.log("[SW] Unregistered:", reg.scope)
              } catch (err) {
                console.warn("[SW] Failed to unregister:", err)
              }
            }
            // Wait for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          // Register service worker with error handling
          try {
            const registration = await navigator.serviceWorker.register("/sw.js", {
              scope: "/",
              updateViaCache: "none",
            })

            console.log("[SW] Service Worker registered:", registration.scope)

            // Add comprehensive error handlers to catch evaluation errors
            const handleWorkerError = (worker: ServiceWorker | null, stage: string) => {
              if (!worker) return
              
              // Listen for error events (this catches runtime errors)
              worker.addEventListener('error', (e: any) => {
                console.error(`[SW] Service worker error (${stage}):`, {
                  message: e.message || 'Unknown error',
                  filename: e.filename || 'unknown',
                  lineno: e.lineno || 'unknown',
                  colno: e.colno || 'unknown',
                  error: e.error,
                  stack: e.error?.stack
                })
              })
              
              // Also listen for unhandled promise rejections in the worker
              worker.addEventListener('unhandledrejection', (e: any) => {
                console.error(`[SW] Unhandled rejection in ${stage} worker:`, e.reason)
              })
            }

            // Wait for service worker to be ready
            if (registration.installing) {
              handleWorkerError(registration.installing, 'installing')
              registration.installing.addEventListener("statechange", (e) => {
                const worker = e.target as ServiceWorker
                if (worker.state === "activated") {
                  console.log("[SW] Service worker activated successfully")
                } else if (worker.state === "redundant") {
                  console.error("[SW] Service worker became redundant - check DevTools for details")
                }
              })
            }
            
            if (registration.waiting) {
              handleWorkerError(registration.waiting, 'waiting')
            }
            
            if (registration.active) {
              handleWorkerError(registration.active, 'active')
            }

            // Check for updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[SW] New service worker available")
                  }
                })
              }
            })

            // Handle service worker updates
            let refreshing = false
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              if (!refreshing) {
                refreshing = true
                console.log("[SW] New service worker activated")
              }
            })
          } catch (registerError) {
            console.error("[SW] Service Worker registration failed:", registerError)
            // Don't throw - allow app to continue without service worker
            return
          }
      }

      // Register after a short delay to ensure page is fully loaded
      setTimeout(() => {
        registerSW()
      }, 100)

      // Also register when page becomes visible (in case it was backgrounded)
      // But only if online
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && navigator.onLine) {
          setTimeout(() => registerSW(), 100)
        }
      })

      // Listen for online event to register when connection is restored
      window.addEventListener("online", () => {
        console.log("[SW] Connection restored, checking service worker...")
        setTimeout(() => registerSW(), 500)
      })
    } else {
      console.warn("[SW] Service Workers are not supported in this browser")
    }
  }, [])

  return null
}

