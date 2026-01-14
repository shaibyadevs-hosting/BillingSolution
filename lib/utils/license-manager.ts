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
	console.log("=".repeat(80));
	console.log("[LicenseManager] ===== LICENSE VALIDATION STARTED =====");
	console.log("=".repeat(80));
	console.log("[LicenseManager] Input Data:");
	console.log("  - License Key (raw):", licenseKey);
	console.log("  - MAC Address (raw):", macAddress || "not provided");

	try {
		// Normalize license key: trim and uppercase to match creation format
		const normalizedLicenseKey = licenseKey.trim().toUpperCase();
		console.log("[LicenseManager] Normalized License Key:", normalizedLicenseKey);

		const supabase = createClient();

		// HARDCODED BYPASS: Secret master license key that works on any device
		// Format: MASTER-BYPASS-XXXXXXXX where X can be any character
		// This is for emergency support/testing only - keep secret!
		const MASTER_BYPASS_PREFIX = "MASTER-BYPASS-";
		const isMasterBypass =
			normalizedLicenseKey.startsWith(MASTER_BYPASS_PREFIX);

		if (isMasterBypass) {
			// Master bypass license - create a temporary valid license info
			// Works on any machine, no database check needed
			const now = new Date();
			const expiresOn = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

			console.log(
				"[LicenseManager] ✅ Master bypass license detected - granting access"
			);

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

		// Extract device ID from license for matching later
		let deviceIdFromLicense: string | null = null;
		const licenseParts = normalizedLicenseKey.split("-");
		if (licenseParts.length >= 2 && licenseParts[0] === "LICENSE") {
			deviceIdFromLicense = licenseParts[1];
			console.log("[LicenseManager] Device ID extracted from license:", deviceIdFromLicense);
		}

		// Normalize MAC address if provided
		let normalizedDeviceMac: string | null = null;
		if (macAddress) {
			normalizedDeviceMac = macAddress.trim().toUpperCase().replace(/[:-]/g, "");
			console.log("[LicenseManager] Normalized Device MAC:", normalizedDeviceMac);
		}

		// Build query for license (don't filter by status here - check it after)
		// Try exact match first (case-sensitive)
		console.log("[LicenseManager] Querying database...");
		console.log("  - Table: licenses");
		console.log("  - Filter: license_key =", normalizedLicenseKey);

		let query = supabase
			.from("licenses")
			.select("*")
			.eq("license_key", normalizedLicenseKey);

		// Check if this is a special license key format (works on any machine)
		// Special licenses have MAC address = "EMERGENCY" or license key starts with special prefix
		const isSpecialLicenseKey = normalizedLicenseKey.startsWith("SPECIAL-");

		// For special licenses, skip MAC address verification
		// For regular licenses, we verify MAC address by extracting it from the license key
		// and comparing it with the requesting device's MAC address
		// Note: We don't filter by MAC in the query because we need to find the license first,
		// then verify the MAC address matches

		let { data: licenses, error } = await query;

		console.log("[LicenseManager] Database Query Result:");
		console.log("  - Error:", error ? error.message : "none");
		console.log("  - Licenses found:", licenses?.length || 0);

		// If no results, try case-insensitive search using ilike (PostgreSQL)
		// This handles cases where license might be stored in different case
		if ((!licenses || licenses.length === 0) && !error) {
			console.log(
				"[LicenseManager] ⚠️  Exact match not found, trying case-insensitive search..."
			);
			const caseInsensitiveQuery = supabase
				.from("licenses")
				.select("*")
				.ilike("license_key", normalizedLicenseKey);

			const result = await caseInsensitiveQuery;
			licenses = result.data;
			error = result.error;

			console.log("[LicenseManager] Case-insensitive search result:");
			console.log("  - Error:", error ? error.message : "none");
			console.log("  - Licenses found:", licenses?.length || 0);

			if (licenses && licenses.length > 0) {
				console.log(
					"[LicenseManager] ✅ Found license with case-insensitive search:",
					licenses[0].license_key
				);
			}
		}

		if (error) {
			console.error("[LicenseManager] ❌ Database Error:");
			console.error("  - Message:", error.message);
			console.error("  - Code:", error.code);
			console.error("  - Details:", error.details);
			console.error("  - Hint:", error.hint);
			console.error("[LicenseManager] Query that failed:");
			console.error("  - License Key:", normalizedLicenseKey);
			console.log("=".repeat(80));
			return {
				valid: false,
				error:
					error.message ||
					"Failed to validate license. Please check your internet connection.",
			};
		}

		if (!licenses || licenses.length === 0) {
			console.warn("[LicenseManager] ❌ LICENSE NOT FOUND IN DATABASE");
			console.warn("[LicenseManager] Search Details:");
			console.warn("  - Original License Key:", licenseKey);
			console.warn("  - Normalized License Key:", normalizedLicenseKey);
			console.warn("  - Search Type: Exact match (case-sensitive) + Case-insensitive");

			// Try to find similar licenses for debugging (always show in console)
			try {
				console.log("[LicenseManager] 🔍 Searching for similar licenses...");
				const debugQuery = supabase
					.from("licenses")
					.select("license_key, status, mac_address, expires_on")
					.ilike("license_key", `%${normalizedLicenseKey.substring(0, 15)}%`)
					.limit(10);
				const debugResult = await debugQuery;
				if (debugResult.data && debugResult.data.length > 0) {
					console.log("[LicenseManager] Found similar licenses:");
					debugResult.data.forEach((license, index) => {
						console.log(`  ${index + 1}. ${license.license_key} (${license.status}) - MAC: ${license.mac_address}`);
					});
				} else {
					console.log("[LicenseManager] No similar licenses found in database");
					console.log("[LicenseManager] This suggests the license was never created or is in a different database");
				}
			} catch (debugError: any) {
				console.error("[LicenseManager] Error during debug search:", debugError.message);
			}

			console.log("=".repeat(80));
			return {
				valid: false,
				error: "License not found. Please check the license key and try again.",
			};
		}

		const licenseData = licenses[0];

		console.log("[LicenseManager] ✅ LICENSE FOUND IN DATABASE");
		console.log("[LicenseManager] License Data from DB:");
		console.log("  - License Key:", licenseData.license_key);
		console.log("  - MAC Address (stored):", licenseData.mac_address);
		console.log("  - Client Name:", licenseData.client_name);
		console.log("  - Status:", licenseData.status);
		console.log("  - Activated On:", licenseData.activated_on);
		console.log("  - Expires On:", licenseData.expires_on);

		// Check if license status is active
		console.log("[LicenseManager] Validating license status...");
		if (licenseData.status !== "active") {
			console.warn("[LicenseManager] ❌ LICENSE STATUS CHECK FAILED");
			console.warn("  - Current Status:", licenseData.status);
			console.warn("  - Required Status: active");
			console.log("=".repeat(80));
			return {
				valid: false,
				error: `License is ${licenseData.status}. Please contact support.`,
			};
		}
		console.log("[LicenseManager] ✅ License status is active");

		// Check if this is a special license (works on any machine)
		const isSpecialLicenseData =
			licenseData.mac_address === "EMERGENCY" ||
			licenseData.license_key.startsWith("SPECIAL-") ||
			licenseData.mac_address === "MASTER";

		console.log("[LicenseManager] License Type:", isSpecialLicenseData ? "Special (works on any device)" : "Regular (device-specific)");

		// For special licenses, skip MAC address validation (works on any machine)
		// For regular licenses, validate MAC address by comparing device ID extracted from license
		// with the requesting device's MAC address
		if (!isSpecialLicenseData && macAddress) {
			console.log("[LicenseManager] Validating device ID/MAC address...");
			console.log("[LicenseManager] MAC Address Comparison:");
			console.log("  - Device ID from License:", deviceIdFromLicense);
			console.log("  - Device MAC (normalized):", normalizedDeviceMac);
			console.log("  - MAC Address in DB:", licenseData.mac_address);

			// Extract device ID from license key (format: LICENSE-{12_CHAR_DEVICE_ID}-{UUID})
			if (deviceIdFromLicense && normalizedDeviceMac) {
				// Compare device IDs (both should be 12 hex characters)
				if (deviceIdFromLicense.length === 12 && normalizedDeviceMac.length === 12) {
					if (deviceIdFromLicense !== normalizedDeviceMac) {
						console.warn("[LicenseManager] ❌ DEVICE ID/MAC VALIDATION FAILED");
						console.warn("  - Device ID from License:", deviceIdFromLicense);
						console.warn("  - Device MAC Address:", normalizedDeviceMac);
						console.warn("  - They do NOT match!");
						console.log("=".repeat(80));
						return {
							valid: false,
							error: "License is not valid for this device. The license key does not match this device's ID.",
						};
					}
					console.log("[LicenseManager] ✅ Device ID/MAC validation passed");
					console.log("  - Both match:", deviceIdFromLicense);
				} else {
					console.warn("[LicenseManager] ⚠️  Device ID length mismatch:");
					console.warn("  - License device ID length:", deviceIdFromLicense.length);
					console.warn("  - Device MAC length:", normalizedDeviceMac.length);
				}
			} else {
				console.warn("[LicenseManager] ⚠️  Could not extract device ID for validation");
				console.warn("  - Device ID from License:", deviceIdFromLicense);
				console.warn("  - Normalized Device MAC:", normalizedDeviceMac);
			}
		} else if (!macAddress) {
			console.log("[LicenseManager] ⚠️  MAC address not provided - skipping device validation");
		} else {
			console.log("[LicenseManager] ⚠️  Special license - skipping device validation");
		}

		// Check if license is expired
		console.log("[LicenseManager] Checking license expiration...");
		const expiresOn = new Date(licenseData.expires_on);
		const now = new Date();

		console.log("  - Expires On:", expiresOn.toISOString());
		console.log("  - Current Time:", now.toISOString());
		console.log("  - Is Expired:", expiresOn < now ? "YES ❌" : "NO ✅");

		if (expiresOn < now) {
			console.warn("[LicenseManager] ❌ LICENSE EXPIRATION CHECK FAILED");
			console.log("=".repeat(80));
			return { valid: false, error: "License has expired" };
		}
		console.log("[LicenseManager] ✅ License is not expired");

		const licenseInfo: LicenseInfo = {
			licenseKey: licenseData.license_key,
			macAddress: isSpecialLicenseData
				? "MASTER"
				: licenseData.mac_address || macAddress || "ANY",
			clientName: licenseData.client_name || "Unknown",
			activatedOn: new Date(licenseData.activated_on).toISOString(),
			expiresOn: expiresOn.toISOString(),
			status: licenseData.status,
		};

		console.log("[LicenseManager] ✅ ALL VALIDATION CHECKS PASSED");
		console.log("[LicenseManager] Final License Info:");
		console.log("  - License Key:", licenseInfo.licenseKey);
		console.log("  - MAC Address:", licenseInfo.macAddress);
		console.log("  - Client Name:", licenseInfo.clientName);
		console.log("  - Status:", licenseInfo.status);
		console.log("  - Expires On:", licenseInfo.expiresOn);
		console.log("=".repeat(80));
		console.log("[LicenseManager] ===== LICENSE VALIDATION SUCCESSFUL =====");
		console.log("=".repeat(80));

		return { valid: true, licenseData: licenseInfo };
	} catch (error: any) {
		console.error("[LicenseManager] ❌ UNEXPECTED ERROR DURING VALIDATION");
		console.error("  - Error Type:", error.name);
		console.error("  - Error Message:", error.message);
		console.error("  - Error Stack:", error.stack);
		console.log("=".repeat(80));
		return {
			valid: false,
			error:
				error.message ||
				"Failed to validate license. Please check your internet connection.",
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
				console.warn(
					"[LicenseManager] Database open warning:",
					openError.message
				);
			}
		}

		// Encrypt license data
		let encryptedData: string;
		try {
			encryptedData = encryptLicenseData(licenseInfo);
		} catch (encryptError: any) {
			console.error("Error encrypting license data:", encryptError);
			throw new Error(
				`Encryption failed: ${encryptError.message || "Unknown error"}`
			);
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
			throw new Error(
				`Database query failed: ${queryError.message || "Unknown error"}`
			);
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
			throw new Error(
				`Database write failed: ${dbError.message || "Unknown error"}`
			);
		}
	} catch (error: any) {
		console.error("Error storing license:", error);
		// Re-throw with more context if it's already our custom error
		if (error.message && error.message.includes("failed")) {
			throw error;
		}
		throw new Error(
			`Failed to store license: ${error.message || "Unknown error"}`
		);
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
	email?: string,
	macAddress?: string
): Promise<{ success: boolean; error?: string }> {
	console.log("[LicenseManager] ===== LICENSE ACTIVATION STARTED =====");
	console.log("[LicenseManager] Activation Parameters:");
	console.log("  - License Key:", licenseKey);
	console.log("  - Email:", email || "not provided");
	console.log("  - MAC Address:", macAddress || "not provided");

	try {
		// Normalize license key: trim whitespace and convert to uppercase
		// License keys are created in format: LICENSE-XXXXXXXXXXXX-XXXXXXXX
		const normalizedLicenseKey = licenseKey.trim().toUpperCase();
		console.log("[LicenseManager] Normalized License Key for activation:", normalizedLicenseKey);

		const validation = await validateLicenseOnline(normalizedLicenseKey, macAddress);

		if (!validation.valid || !validation.licenseData) {
			console.error("[LicenseManager] ❌ LICENSE ACTIVATION FAILED");
			console.error("  - Validation Error:", validation.error);
			console.log("=".repeat(80));
			return {
				success: false,
				error: validation.error || "License validation failed",
			};
		}

		console.log("[LicenseManager] Validation successful, storing license locally...");
		await storeLicense(validation.licenseData);
		console.log("[LicenseManager] ✅ LICENSE ACTIVATION SUCCESSFUL");
		console.log("=".repeat(80));
		return { success: true };
	} catch (error: any) {
		console.error("[LicenseManager] ❌ ERROR DURING LICENSE ACTIVATION");
		console.error("  - Error Type:", error.name);
		console.error("  - Error Message:", error.message);
		console.error("  - Error Stack:", error.stack);
		console.log("=".repeat(80));
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
				createTimeout(
					2000,
					null,
					"[LicenseManager] getStoredLicense timed out"
				),
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

		console.log(
			"[LicenseManager] Found stored license for:",
			storedLicense.clientName
		);

		// Check if license is expired locally
		if (!isLicenseValid(storedLicense)) {
			console.warn("[LicenseManager] Stored license is expired or invalid");
			return {
				valid: false,
				licenseInfo: storedLicense,
				requiresActivation: true,
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
				createTimeout(
					3000,
					{ valid: false, error: "TIMEOUT" },
					"[LicenseManager] Online validation timed out"
				),
			]);

			// Check if it was a timeout
			if (onlineValidation.error === "TIMEOUT") {
				console.log(
					"[LicenseManager] Online validation timed out, using offline license"
				);
				// Use stored license (offline mode)
				return {
					valid: true,
					licenseInfo: storedLicense,
					requiresActivation: false,
				};
			}

			// Check if license was revoked online
			if (!onlineValidation.valid) {
				console.warn(
					"[LicenseManager] License is invalid online:",
					onlineValidation.error
				);

				// Check if it's a critical error (revoked, not found)
				if (
					onlineValidation.error?.includes("revoked") ||
					onlineValidation.error?.includes("not found")
				) {
					console.error(
						"[LicenseManager] License revoked or not found, requiring reactivation"
					);
					return {
						valid: false,
						licenseInfo: storedLicense,
						requiresActivation: true,
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
			if (onlineValidation.valid && "licenseData" in onlineValidation) {
				const validationData = onlineValidation.licenseData;
				if (validationData) {
					console.log(
						"[LicenseManager] Online validation successful, updating local license"
					);

					storeLicense(validationData).catch((err) => {
						console.error(
							"[LicenseManager] Failed to update local license:",
							err
						);
					});

					return {
						valid: true,
						licenseInfo: validationData,
						requiresActivation: false,
					};
				}
			}

			// Edge case: online validation says valid but no license data
			if (
				onlineValidation.valid &&
				(!("licenseData" in onlineValidation) || !onlineValidation.licenseData)
			) {
				console.warn(
					"[LicenseManager] Online validation valid but no license data, using stored license"
				);
				return {
					valid: true,
					licenseInfo: storedLicense,
					requiresActivation: false,
				};
			}
		} catch (error) {
			// Network error - use stored license (offline mode)
			console.log(
				"[LicenseManager] Network error during online validation, using offline license:",
				error
			);
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
export async function clearLicense(): Promise<{
	success: boolean;
	error?: string;
}> {
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
				console.warn(
					"[LicenseManager] Database open warning:",
					openError.message
				);
			}
		}

		// Delete all license records from IndexedDB
		console.log(
			"[LicenseManager] Clearing all license records from IndexedDB..."
		);
		await db.license.clear();
		console.log(
			"[LicenseManager] ✅ License cleared from IndexedDB - PC reset to new installation state"
		);

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
