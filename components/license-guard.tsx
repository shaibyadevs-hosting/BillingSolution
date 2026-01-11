"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkLicenseOnLaunch, getStoredLicense, isLicenseValid } from "@/lib/utils/license-manager";
import { getActiveDbModeAsync } from "@/lib/utils/db-mode";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface LicenseGuardProps {
  children: React.ReactNode;
}

// Global cache to prevent re-checking on every navigation
let licenseCache: { valid: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function LicenseGuard({ children }: LicenseGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const hasCheckedRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);
  const renderCountRef = useRef(0);
  const hasLoggedRef = useRef(false);
  
  // Only log on pathname change (not on every render)
  if (pathname !== lastPathnameRef.current) {
    if (process.env.NODE_ENV === 'development' && !hasLoggedRef.current) {
      console.log('[LicenseGuard] Pathname changed to:', pathname);
      hasLoggedRef.current = true;
    }
    lastPathnameRef.current = pathname || null;
    renderCountRef.current = 0; // Reset render count on pathname change
  }
  
  renderCountRef.current += 1;

  useEffect(() => {
    // Skip check on license page, admin license-seed page, and auth pages
    // These pages should be accessible without license validation
    // Also skip in development/localhost
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.includes('localhost'));
    
    const skipLicenseCheck = 
      isLocalhost ||
      pathname === "/license" || 
      pathname?.includes("/license") || 
      pathname === "/admin/license-seed" ||
      pathname?.startsWith("/admin/license-seed") ||
      pathname?.startsWith("/admin/ckejwngw242r1") ||
      pathname?.startsWith("/auth/") ||
      pathname?.startsWith("/i/"); // Public invoice viewing routes
    
    if (skipLicenseCheck) {
      // Only set state if it's different to prevent unnecessary re-renders
      if (checking || !isValid) {
        if (process.env.NODE_ENV === 'development' && renderCountRef.current <= 1) {
      console.log('[LicenseGuard] On exempt page or localhost, skipping license check:', pathname);
        }
      setChecking(false);
      setIsValid(true); // Allow page to render
      // Reset check ref when on exempt pages to avoid stale state
      hasCheckedRef.current = false;
        hasLoggedRef.current = false; // Reset log flag
      }
      return;
    }

    // If we already validated and cache is still valid, skip re-check
    if (hasCheckedRef.current && licenseCache && 
        (Date.now() - licenseCache.timestamp) < CACHE_DURATION && 
        licenseCache.valid) {
      if (process.env.NODE_ENV === 'development') {
      console.log('[LicenseGuard] Using cached license validation');
      }
      // Only update state if needed to prevent re-renders
      if (checking || !isValid) {
      setChecking(false);
      setIsValid(true);
      }
      return;
    }

    let isMounted = true;

    const verifyLicense = async () => {
      console.log('[LicenseGuard] Starting license verification...');
      
      try {
        // First, check database mode - Supabase mode doesn't need licenses
        const dbMode = await getActiveDbModeAsync();
        if (dbMode === 'supabase') {
          console.log('[LicenseGuard] Supabase mode detected - no license required (only periodic checks)');
          if (isMounted) {
            setChecking(false);
            setIsValid(true);
            hasCheckedRef.current = true;
            licenseCache = { valid: true, timestamp: Date.now() };
          }
          return;
        }

        // For IndexedDB mode, check license
        console.log('[LicenseGuard] IndexedDB mode detected - license required');
        
        // First, quickly check if we have a valid stored license (fast path)
        try {
          const storedLicense = await Promise.race([
            getStoredLicense(),
            new Promise<null>((resolve) => setTimeout(() => {
              console.warn('[LicenseGuard] getStoredLicense timeout after 1 second');
              resolve(null);
            }, 1000)),
          ]);

          if (storedLicense && isLicenseValid(storedLicense)) {
            console.log('[LicenseGuard] Found valid stored license, allowing access');
            if (isMounted) {
              setChecking(false);
              setIsValid(true);
              hasCheckedRef.current = true;
              licenseCache = { valid: true, timestamp: Date.now() };
            }
            
            // Do online validation in background (non-blocking)
            checkLicenseOnLaunch().then((result) => {
              if (result.valid && !result.requiresActivation) {
                licenseCache = { valid: true, timestamp: Date.now() };
              } else if (result.requiresActivation) {
                // Only update cache if license was revoked
                licenseCache = { valid: false, timestamp: Date.now() };
                console.warn('[LicenseGuard] Background check found license requires activation');
              }
            }).catch((err) => {
              console.warn('[LicenseGuard] Background license check failed:', err);
              // Don't redirect on background check failure
            });
            
            return;
          }
        } catch (err) {
          console.warn('[LicenseGuard] Quick check failed, doing full check:', err);
        }
        
        // If no stored license found, allow access in development (fallback)
        if (typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          console.log('[LicenseGuard] No stored license but on localhost, allowing access');
          if (isMounted) {
            setChecking(false);
            setIsValid(true);
            hasCheckedRef.current = true;
            licenseCache = { valid: true, timestamp: Date.now() };
          }
          return;
        }

        // Full license check with timeout
        const timeoutPromise = new Promise<{ valid: boolean; requiresActivation: boolean }>((resolve) => {
          setTimeout(() => {
            console.warn("[LicenseGuard] License check timed out after 3 seconds");
            // On timeout, check if we have a stored license (with its own timeout)
            Promise.race([
              getStoredLicense(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
            ]).then((stored) => {
              if (stored && isLicenseValid(stored)) {
                // Allow access with stored license (offline mode)
                resolve({ valid: true, requiresActivation: false });
              } else {
                // No stored license - allow access in development, require activation in production
                const isLocalhost = typeof window !== 'undefined' && 
                  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                resolve({ valid: isLocalhost, requiresActivation: !isLocalhost });
              }
            }).catch(() => {
              const isLocalhost = typeof window !== 'undefined' && 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
              resolve({ valid: isLocalhost, requiresActivation: !isLocalhost });
            });
          }, 3000); // Reduced timeout to 3 seconds
        });

        const result = await Promise.race([
          checkLicenseOnLaunch(),
          timeoutPromise,
        ]);

        console.log('[LicenseGuard] License check result:', result);

        if (!isMounted) return;

        if (!result.valid || result.requiresActivation) {
          console.log('[LicenseGuard] License invalid, redirecting to /license');
          setChecking(false);
          setIsValid(false);
          hasCheckedRef.current = true;
          licenseCache = { valid: false, timestamp: Date.now() };
          router.push("/license");
          return;
        }

        // License is valid - allow access
        console.log('[LicenseGuard] License valid, allowing access');
        setChecking(false);
        setIsValid(true);
        hasCheckedRef.current = true;
        licenseCache = { valid: true, timestamp: Date.now() };
        
      } catch (error) {
        console.error("[LicenseGuard] Error verifying license:", error);
        
        // On error, check if we have a stored license (offline fallback)
        try {
          const storedLicense = await getStoredLicense();
          if (storedLicense && isLicenseValid(storedLicense)) {
            console.log('[LicenseGuard] Error occurred but stored license is valid, allowing access');
            if (isMounted) {
              setChecking(false);
              setIsValid(true);
              hasCheckedRef.current = true;
              licenseCache = { valid: true, timestamp: Date.now() };
            }
            return;
          }
        } catch (storedErr) {
          console.error("[LicenseGuard] Error checking stored license:", storedErr);
        }
        
        if (isMounted) {
          setChecking(false);
          setIsValid(false);
          hasCheckedRef.current = true;
          licenseCache = { valid: false, timestamp: Date.now() };
          router.push("/license");
        }
      }
    };

    verifyLicense();

    return () => {
      isMounted = false;
    };
    // Only depend on pathname - router is stable, checking/isValid would cause loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Show loading state while checking
  if (checking) {
    // Don't log loading state - it's expected during checks
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-transparent">
        <div className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Billing Solutions</h2>
            <p className="text-sm text-muted-foreground">Verifying license...</p>
          </div>
        </div>
      </div>
    );
  }

  // Only render children if license is valid
  if (!isValid) {
    // Don't log - this is expected behavior
    return null;
  }

  // Don't log every render - only log important state changes
  return <>{children}</>;
}
