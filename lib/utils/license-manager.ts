import { db, type License } from "@/lib/db/dexie";
import { encryptLicenseData, decryptLicenseData } from "./license-encryption";
import { createClient } from "@/lib/supabase/client";

/**
 * Helper to create a timeout promise
 */
function createTimeout<T>(ms: number, value: T, message?: string): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (message) console.warn(message);
      resolve(value);
    }, ms);
  });
}

export interface LicenseInfo {
  licenseKey: string;
  macAddress: string;
  clientName: string;
  activatedOn: string;
  expiresOn: string;
  status: "active" | "expired" | "revoked";
}

/**
 * Validate license against Supabase
 * Only validates licenses for IndexedDB mode admins (Supabase mode doesn't need licenses)
 */
export async function validateLicenseOnline(
  licenseKey: string,
  macAddress?: string
): Promise<{ valid: boolean; licenseData?: LicenseInfo; error?: string }> {
  try {
    // Normalize license key: trim and uppercase to match creation format
    const normalizedLicenseKey = licenseKey.trim().toUpperCase();
    
    const supabase = createClient();
    
    // HARDCODED BYPASS: Secret master license key that works on any device
    // Format: MASTER-BYPASS-XXXXXXXX where X can be any character
    // This is for emergency support/testing only - keep secret!
    const MASTER_BYPASS_PREFIX = "MASTER-BYPASS-";
    const isMasterBypass = normalizedLicenseKey.startsWith(MASTER_BYPASS_PREFIX);
    
    if (isMasterBypass) {
      // Master bypass license - create a temporary valid license info
      // Works on any machine, no database check needed
      const now = new Date();
      const expiresOn = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      
      console.log("[LicenseManager] Master bypass license detected - granting access");
      
      return {
        valid: true,
        licenseData: {
          licenseKey: normalizedLicenseKey,
          macAddress: "MASTER",
          clientName: "Master License",
          activatedOn: now.toISOString(),
          expiresOn: expiresOn.toISOString(),
          status: "active",
        },
      };
    }
    
    // Build query for license (don't filter by status here - check it after)
    let query = supabase
      .from("licenses")
      .select("*")
      .eq("license_key", normalizedLicenseKey);

    // Check if this is a special license (works on any machine)
    // Special licenses have MAC address = "EMERGENCY" or license key starts with special prefix
    const isSpecialLicense = normalizedLicenseKey.startsWith("SPECIAL-");
    
    // For special licenses, skip MAC address verification
    // For regular licenses, MAC address verification is optional (currently disabled)
    // MAC address verification can be enabled later if needed:
    // if (macAddress && !isSpecialLicense) {
    //   query = query.eq("mac_address", macAddress);
    // }

    const { data: licenses, error } = await query;

    if (error) {
      console.error("[LicenseManager] Error validating license:", error);
      console.error("[LicenseManager] Query details:", {
        licenseKey: normalizedLicenseKey,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      return {
        valid: false,
        error: error.message || "Failed to validate license. Please check your internet connection.",
      };
    }

    if (!licenses || licenses.length === 0) {
      console.warn("[LicenseManager] License not found:", normalizedLicenseKey);
      return { valid: false, error: "License not found. Please check the license key and try again." };
    }

    const licenseData = licenses[0];
    
    console.log("[LicenseManager] License found:", {
      license_key: licenseData.license_key,
      status: licenseData.status,
      mac_address: licenseData.mac_address,
      expires_on: licenseData.expires_on,
    });

    // Check if license status is active
    if (licenseData.status !== "active") {
      console.warn("[LicenseManager] License is not active:", licenseData.status);
      return { valid: false, error: `License is ${licenseData.status}. Please contact support.` };
    }

    // Check if this is a special license (works on any machine)
    const isSpecialLicense = licenseData.mac_address === "EMERGENCY" || 
                             licenseData.license_key.startsWith("SPECIAL-") ||
                             licenseData.mac_address === "MASTER";

    // For special licenses, skip MAC address validation (works on any machine)
    // For regular licenses, MAC address validation is optional (currently disabled)
    // You can enable MAC address validation for regular licenses if needed:
    // if (!isSpecialLicense && macAddress && licenseData.mac_address !== macAddress) {
    //   return { valid: false, error: "License is not valid for this device (MAC address mismatch)" };
    // }

    // Check if license is expired
    const expiresOn = new Date(licenseData.expires_on);
    const now = new Date();

    if (expiresOn < now) {
      return { valid: false, error: "License has expired" };
    }

    const licenseInfo: LicenseInfo = {
      licenseKey: licenseData.license_key,
      macAddress: isSpecialLicense ? "MASTER" : (licenseData.mac_address || macAddress || "ANY"),
      clientName: licenseData.client_name || "Unknown",
      activatedOn: new Date(licenseData.activated_on).toISOString(),
      expiresOn: expiresOn.toISOString(),
      status: licenseData.status,
    };

    return { valid: true, licenseData: licenseInfo };
  } catch (error: any) {
    console.error("Error validating license:", error);
    return {
      valid: false,
      error: error.message || "Failed to validate license. Please check your internet connection.",
    };
  }
}

/**
 * Store license in IndexedDB (encrypted)
 */
export async function storeLicense(licenseInfo: LicenseInfo): Promise<void> {
  try {
    // Verify database is ready
    if (!db) {
      throw new Error("Database instance not available");
    }
    
    if (!db.license) {
      throw new Error("License table not available in database");
    }
    
    // Wait for database to be ready (in case it's still opening)
    try {
      await db.open();
    } catch (openError: any) {
      // Database might already be open, that's fine
      if (!openError.message?.includes("already open")) {
        console.warn("[LicenseManager] Database open warning:", openError.message);
      }
    }

    // Encrypt license data
    let encryptedData: string;
    try {
      encryptedData = encryptLicenseData(licenseInfo);
    } catch (encryptError: any) {
      console.error("Error encrypting license data:", encryptError);
      throw new Error(`Encryption failed: ${encryptError.message || "Unknown error"}`);
    }

    const now = new Date().toISOString();

    // Check if license already exists
    let existing;
    try {
      existing = await db.license
        .where("licenseKey")
        .equals(licenseInfo.licenseKey)
        .first();
    } catch (queryError: any) {
      console.error("Error querying existing license:", queryError);
      throw new Error(`Database query failed: ${queryError.message || "Unknown error"}`);
    }

    const licenseRecord: License = {
      licenseKey: licenseInfo.licenseKey,
      macAddress: licenseInfo.macAddress,
      clientName: licenseInfo.clientName,
      activatedOn: licenseInfo.activatedOn,
      expiresOn: licenseInfo.expiresOn,
      status: licenseInfo.status,
      encryptedData,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    try {
      if (existing?.id) {
        await db.license.update(existing.id, licenseRecord);
        console.log("[LicenseManager] Updated existing license in database");
      } else {
        await db.license.add(licenseRecord);
        console.log("[LicenseManager] Added new license to database");
      }
    } catch (dbError: any) {
      console.error("Error writing to database:", dbError);
      console.error("Database error details:", {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack,
      });
      throw new Error(`Database write failed: ${dbError.message || "Unknown error"}`);
    }
  } catch (error: any) {
    console.error("Error storing license:", error);
    // Re-throw with more context if it's already our custom error
    if (error.message && error.message.includes("failed")) {
      throw error;
    }
    throw new Error(`Failed to store license: ${error.message || "Unknown error"}`);
  }
}

/**
 * Get stored license from IndexedDB
 */
export async function getStoredLicense(): Promise<LicenseInfo | null> {
  try {
    const license = await db.license.orderBy("updated_at").reverse().first();

    if (!license) {
      return null;
    }

    // Try to decrypt if encrypted data exists
    if (license.encryptedData) {
      const decrypted = decryptLicenseData(license.encryptedData);
      if (decrypted) {
        return {
          ...decrypted,
          status: decrypted.status as "active" | "expired" | "revoked",
        };
      }
    }

    // Fallback to plain data (for backward compatibility)
    return {
      licenseKey: license.licenseKey,
      macAddress: license.macAddress,
      clientName: license.clientName,
      activatedOn: license.activatedOn,
      expiresOn: license.expiresOn,
      status: license.status as "active" | "expired" | "revoked", // Type assertion for TypeScript
    };
  } catch (error) {
    console.error("Error getting stored license:", error);
    return null;
  }
}

/**
 * Check if license is valid (checks expiration)
 */
export function isLicenseValid(licenseInfo: LicenseInfo | null): boolean {
  if (!licenseInfo) {
    return false;
  }

  if (licenseInfo.status !== "active") {
    return false;
  }

  const expiresOn = new Date(licenseInfo.expiresOn);
  const now = new Date();

  return expiresOn >= now;
}

/**
 * Activate license (online validation + local storage)
 */
export async function activateLicense(
  licenseKey: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalize license key: trim whitespace and convert to uppercase
    // License keys are created in format: LICENSE-XXXXXXXXXXXX-XXXXXXXX
    const normalizedLicenseKey = licenseKey.trim().toUpperCase();
    
    const validation = await validateLicenseOnline(normalizedLicenseKey);

    if (!validation.valid || !validation.licenseData) {
      return {
        success: false,
        error: validation.error || "License validation failed",
      };
    }

    await storeLicense(validation.licenseData);
    return { success: true };
  } catch (error: any) {
    console.error("Error activating license:", error);
    return {
      success: false,
      error: error.message || "Failed to activate license",
    };
  }
}

/**
 * Check license on app launch (offline-first)
 */
export async function checkLicenseOnLaunch(): Promise<{
  valid: boolean;
  licenseInfo?: LicenseInfo;
  requiresActivation: boolean;
}> {
  try {
    // First, try to get stored license (with timeout protection)
    let storedLicense: LicenseInfo | null = null;
    try {
      storedLicense = await Promise.race([
        getStoredLicense(),
        createTimeout(2000, null, "[LicenseManager] getStoredLicense timed out"),
      ]);
    } catch (error) {
      console.error("[LicenseManager] Error getting stored license:", error);
      return { valid: false, requiresActivation: true };
    }

    // No stored license found
    if (!storedLicense) {
      console.log("[LicenseManager] No stored license found");
      return { valid: false, requiresActivation: true };
    }

    console.log("[LicenseManager] Found stored license for:", storedLicense.clientName);

    // Check if license is expired locally
    if (!isLicenseValid(storedLicense)) {
      console.warn("[LicenseManager] Stored license is expired or invalid");
      return { 
        valid: false, 
        licenseInfo: storedLicense, 
        requiresActivation: true 
      };
    }

    console.log("[LicenseManager] Stored license is valid locally");

    // Try to validate online (optional - for revocation check)
    // This runs in background and doesn't block if offline
    try {
      const onlineValidationPromise = validateLicenseOnline(
        storedLicense.licenseKey
      );

      const onlineValidation = await Promise.race([
        onlineValidationPromise,
        createTimeout(3000, { valid: false, error: "TIMEOUT" }, "[LicenseManager] Online validation timed out"),
      ]);

      // Check if it was a timeout
      if (onlineValidation.error === "TIMEOUT") {
        console.log("[LicenseManager] Online validation timed out, using offline license");
        // Use stored license (offline mode)
        return {
          valid: true,
          licenseInfo: storedLicense,
          requiresActivation: false,
        };
      }

      // Check if license was revoked online
      if (!onlineValidation.valid) {
        console.warn("[LicenseManager] License is invalid online:", onlineValidation.error);
        
        // Check if it's a critical error (revoked, not found)
        if (onlineValidation.error?.includes("revoked") || 
            onlineValidation.error?.includes("not found")) {
          console.error("[LicenseManager] License revoked or not found, requiring reactivation");
          return { 
            valid: false, 
            licenseInfo: storedLicense, 
            requiresActivation: true 
          };
        }
        
        // For other errors (network, etc), allow offline use
        console.log("[LicenseManager] Network error, allowing offline use");
        return {
          valid: true,
          licenseInfo: storedLicense,
          requiresActivation: false,
        };
      }

      // Online validation successful - check both valid and licenseData
      if (onlineValidation.valid && onlineValidation.licenseData) {
        console.log("[LicenseManager] Online validation successful, updating local license");
        
        storeLicense(onlineValidation.licenseData).catch(err => {
          console.error("[LicenseManager] Failed to update local license:", err);
        });
        
        return {
          valid: true,
          licenseInfo: onlineValidation.licenseData,
          requiresActivation: false,
        };
      }

      // Edge case: online validation says valid but no license data
      if (onlineValidation.valid && !onlineValidation.licenseData) {
        console.warn("[LicenseManager] Online validation valid but no license data, using stored license");
        return {
          valid: true,
          licenseInfo: storedLicense,
          requiresActivation: false,
        };
      }
    } catch (error) {
      // Network error - use stored license (offline mode)
      console.log("[LicenseManager] Network error during online validation, using offline license:", error);
    }

    // Default: Use stored license (offline mode)
    console.log("[LicenseManager] Using stored license (offline mode)");
    return {
      valid: true,
      licenseInfo: storedLicense,
      requiresActivation: false,
    };
  } catch (error) {
    console.error("[LicenseManager] Critical error checking license:", error);
    return { valid: false, requiresActivation: true };
  }
}

/**
 * Clear/Reset license from IndexedDB
 * This completely removes the license from local storage and resets the PC to a new installation state
 */
export async function clearLicense(): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify database is ready
    if (!db || !db.license) {
      throw new Error("Database not initialized");
    }
    
    // Wait for database to be ready
    try {
      await db.open();
    } catch (openError: any) {
      if (!openError.message?.includes("already open")) {
        console.warn("[LicenseManager] Database open warning:", openError.message);
      }
    }
    
    // Delete all license records from IndexedDB
    console.log("[LicenseManager] Clearing all license records from IndexedDB...");
    await db.license.clear();
    console.log("[LicenseManager] ✅ License cleared from IndexedDB - PC reset to new installation state");
    
    return { success: true };
  } catch (error: any) {
    console.error("[LicenseManager] Error clearing license:", error);
    console.error("[LicenseManager] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: error.message || "Failed to reset license",
    };
  }
}


