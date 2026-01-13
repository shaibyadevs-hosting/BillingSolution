"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { activateLicense, getStoredLicense, isLicenseValid, clearLicense } from "@/lib/utils/license-manager";
import { getMacAddress } from "@/lib/utils/mac-address";
import { Loader2, CheckCircle2, XCircle, Shield, LogOut } from "lucide-react";

export default function LicensePage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [macAddress, setMacAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const router = useRouter();

  // Check if license already exists on mount
  useEffect(() => {
    console.log('[LicensePage] useEffect started - checking for existing license');
    
    // Set immediate timeout to show form quickly (500ms)
    const immediateTimeout = setTimeout(() => {
      console.log('[LicensePage] Immediate timeout (500ms) - setting checking to false');
      setChecking(false);
    }, 500);
    
    const checkExistingLicense = async () => {
      console.log('[LicensePage] checkExistingLicense started');
      try {
        console.log('[LicensePage] Getting stored license from IndexedDB...');
        
        // Add timeout to getStoredLicense call (1 second max)
        const licensePromise = getStoredLicense();
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('[LicensePage] getStoredLicense timeout after 1 second');
            resolve(null);
          }, 1000);
        });
        
        const stored = await Promise.race([licensePromise, timeoutPromise]);
        console.log('[LicensePage] Stored license result:', stored ? 'found' : 'not found', stored);
        
        if (stored && isLicenseValid(stored)) {
          console.log('[LicensePage] License is valid, redirecting to homepage');
          router.push("/");
          return;
        }
        console.log('[LicensePage] No valid license found, will show form');
      } catch (error) {
        console.error("[LicensePage] Error checking existing license:", error);
      } finally {
        console.log('[LicensePage] Finally block - setting checking to false');
        clearTimeout(immediateTimeout);
        setChecking(false);
      }
    };

    // Add longer timeout as backup (2 seconds)
    const backupTimeout = setTimeout(() => {
      console.warn('[LicensePage] Backup timeout (2s) - forcing checking to false');
      setChecking(false);
    }, 2000);

    checkExistingLicense().finally(() => {
      clearTimeout(backupTimeout);
    });
  }, [router]);

  // Get MAC address on mount
  useEffect(() => {
    console.log('[LicensePage] Fetching MAC address...');
    const fetchMacAddress = async () => {
      try {
        const mac = await getMacAddress();
        console.log('[LicensePage] MAC address fetched:', mac ? 'success' : 'failed');
        setMacAddress(mac);
      } catch (error) {
        console.error("[LicensePage] Error getting MAC address:", error);
      }
    };
    
    // Add timeout for MAC address fetch
    const timeout = setTimeout(() => {
      console.warn('[LicensePage] MAC address fetch timeout');
    }, 2000);
    
    fetchMacAddress().finally(() => {
      clearTimeout(timeout);
    });
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setLoading(true);

    try {
      console.log('[LicensePage] Activating license:', licenseKey.trim());
      const result = await activateLicense(licenseKey.trim(), email.trim() || undefined);
      console.log('[LicensePage] Activation result:', result);

      if (result.success) {
        setSuccess(true);
        console.log('[LicensePage] License activated successfully');
        // Redirect to homepage after a short delay
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setError(result.error || "Failed to activate license");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLicense = async () => {
    if (!confirm("Are you sure you want to reset the license?\n\nThis will:\n- Remove all license data from this computer\n- Reset this PC to a completely new installation state\n- Require you to activate with a license key again\n\nThis action cannot be undone.")) {
      return;
    }

    setClearing(true);
    setError(null);
    setSuccess(false);
    setLicenseKey("");
    setEmail("");

    try {
      console.log('[LicensePage] Clearing license...');
      
      // Clear license from IndexedDB
      const result = await clearLicense();
      
      if (result.success) {
        console.log('[LicensePage] License cleared successfully');
        
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
              console.log('[LicensePage] Removed localStorage key:', key);
            });
          }
        } catch (localStorageError) {
          console.warn('[LicensePage] Error clearing localStorage:', localStorageError);
        }
        
        setSuccess(true);
        setError(null);
        
        // Show success message and redirect
        setTimeout(() => {
          console.log('[LicensePage] Redirecting to show activation form...');
          router.push("/license");
          router.refresh();
        }, 1500);
      } else {
        console.error('[LicensePage] Failed to clear license:', result.error);
        setError(result.error || "Failed to reset license");
      }
    } catch (err: any) {
      console.error("[LicensePage] Error clearing license:", err);
      setError(err.message || "An unexpected error occurred while resetting license");
    } finally {
      setClearing(false);
    }
  };

  if (checking) {
    console.log('[LicensePage] Rendering loading state (checking:', checking, ')');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking license...</p>
          <p className="text-xs text-muted-foreground">This should only take a moment...</p>
        </div>
      </div>
    );
  }
  
  console.log('[LicensePage] Rendering license form - checking:', checking, 'loading:', loading, 'error:', error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">License Activation</CardTitle>
          <CardDescription>
            Enter your license key to activate the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">
                License Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseKey"
                type="text"
                placeholder="LICENSE-XXXXXXXXXXXX-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={loading || success}
                required
                className="font-mono uppercase"
                style={{ textTransform: 'uppercase' }}
              />
              <p className="text-xs text-muted-foreground">
                Format: LICENSE-XXXXXXXXXXXX-XXXXXXXX (case-insensitive)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
              />
            </div>

            {macAddress && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground mb-1">Device ID:</p>
                <p className="font-mono text-xs break-all">{macAddress}</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  License activated successfully! Redirecting...
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Activated
                </>
              ) : (
                "Activate License"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Need a license? Contact support for assistance.
            </p>
          </div>

          {/* Reset License Button */}
          <div className="mt-6 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
              onClick={handleClearLicense}
              disabled={clearing || loading || success}
            >
              {clearing ? (
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
  );
}


