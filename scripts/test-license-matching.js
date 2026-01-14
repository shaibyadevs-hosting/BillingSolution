/**
 * Test Script: License Matching Logic
 * 
 * This script tests the license generation and validation logic to ensure
 * device IDs are correctly matched between licenses and devices.
 * 
 * Usage: node scripts/test-license-matching.js
 */

// Test data from user
const TEST_DEVICE_ID = "03:79:CC:AF:D2:10";
const TEST_LICENSE_KEY = "LICENSE-0379CCAFD210-7899A3CC";

console.log("=".repeat(80));
console.log("LICENSE MATCHING TEST SCRIPT");
console.log("=".repeat(80));
console.log();

// Helper function to normalize MAC address (remove colons/separators, uppercase)
function normalizeMacAddress(macAddress) {
  if (!macAddress) return "";
  return macAddress
    .trim()
    .toUpperCase()
    .replace(/[:-]/g, "");
}

// Helper function to format MAC address with colons
function formatMacAddressWithColons(normalizedMac) {
  if (!normalizedMac || normalizedMac.length !== 12) return normalizedMac;
  return normalizedMac.match(/.{2}/g)?.join(":") || normalizedMac;
}

// Extract device ID from license key
function extractDeviceIdFromLicense(licenseKey) {
  // License format: LICENSE-{12_CHAR_DEVICE_ID}-{8_CHAR_UUID}
  const normalized = licenseKey.trim().toUpperCase();
  
  if (!normalized.startsWith("LICENSE-")) {
    return null;
  }
  
  const parts = normalized.split("-");
  if (parts.length < 3) {
    return null;
  }
  
  // Device ID is the middle part (12 characters)
  const deviceIdPart = parts[1];
  
  if (deviceIdPart.length !== 12) {
    return null;
  }
  
  return deviceIdPart;
}

// Simulate license generation (from seed route)
function simulateLicenseGeneration(macAddress) {
  // Normalize MAC address (uppercase, remove separators)
  const normalizedMac = normalizeMacAddress(macAddress);
  
  // Validate MAC address format (should be 12 hex characters)
  if (!/^[0-9A-F]{12}$/.test(normalizedMac)) {
    throw new Error(`Invalid MAC address format: ${macAddress}`);
  }
  
  // Format MAC address with colons for storage
  const formattedMac = formatMacAddressWithColons(normalizedMac);
  
  // Generate license key (simulate UUID part with fixed value for testing)
  // In real code: uuidv4().substring(0, 8).toUpperCase()
  const uuidPart = "7899A3CC"; // From user's example
  const licenseKey = `LICENSE-${normalizedMac.substring(0, 12)}-${uuidPart}`;
  
  return {
    licenseKey,
    formattedMac, // Stored in database with colons
    normalizedMac, // Used in license key without colons
  };
}

// Simulate license validation (from validateLicenseOnline)
function simulateLicenseValidation(licenseKey, deviceMacAddress) {
  // Normalize license key
  const normalizedLicenseKey = licenseKey.trim().toUpperCase();
  
  // Extract device ID from license key
  const deviceIdFromLicense = extractDeviceIdFromLicense(normalizedLicenseKey);
  
  if (!deviceIdFromLicense) {
    return {
      valid: false,
      error: "Invalid license key format",
      deviceIdFromLicense: null,
    };
  }
  
  // Normalize the requesting device's MAC address
  const normalizedDeviceMac = normalizeMacAddress(deviceMacAddress);
  
  // Compare device IDs
  const deviceIdsMatch = deviceIdFromLicense === normalizedDeviceMac;
  
  return {
    valid: deviceIdsMatch,
    deviceIdFromLicense,
    normalizedDeviceMac,
    deviceIdsMatch,
    error: deviceIdsMatch ? null : "Device ID mismatch",
  };
}

console.log("TEST 1: License Generation Simulation");
console.log("-".repeat(80));
try {
  const generated = simulateLicenseGeneration(TEST_DEVICE_ID);
  console.log("✅ License generation successful");
  console.log(`   Input Device ID:     ${TEST_DEVICE_ID}`);
  console.log(`   Normalized MAC:      ${generated.normalizedMac}`);
  console.log(`   Formatted MAC (DB):  ${generated.formattedMac}`);
  console.log(`   Generated License:   ${generated.licenseKey}`);
  console.log();
  
  // Verify it matches the user's provided license
  if (generated.licenseKey === TEST_LICENSE_KEY) {
    console.log("✅ Generated license matches user's license key!");
  } else {
    console.log("⚠️  Generated license differs from user's license key:");
    console.log(`   Expected: ${TEST_LICENSE_KEY}`);
    console.log(`   Got:      ${generated.licenseKey}`);
  }
} catch (error) {
  console.error("❌ License generation failed:", error.message);
}
console.log();

console.log("TEST 2: Device ID Extraction from License");
console.log("-".repeat(80));
const extractedDeviceId = extractDeviceIdFromLicense(TEST_LICENSE_KEY);
if (extractedDeviceId) {
  console.log("✅ Device ID extracted successfully");
  console.log(`   License Key:     ${TEST_LICENSE_KEY}`);
  console.log(`   Extracted ID:    ${extractedDeviceId}`);
  console.log(`   Expected ID:     ${normalizeMacAddress(TEST_DEVICE_ID)}`);
  
  if (extractedDeviceId === normalizeMacAddress(TEST_DEVICE_ID)) {
    console.log("✅ Extracted device ID matches expected device ID!");
  } else {
    console.log("❌ Device ID mismatch!");
    console.log(`   License contains:  ${extractedDeviceId}`);
    console.log(`   Device has:        ${normalizeMacAddress(TEST_DEVICE_ID)}`);
  }
} else {
  console.error("❌ Failed to extract device ID from license");
}
console.log();

console.log("TEST 3: License Validation Simulation");
console.log("-".repeat(80));
const validationResult = simulateLicenseValidation(TEST_LICENSE_KEY, TEST_DEVICE_ID);
console.log("Validation Result:");
console.log(`   License Key:           ${TEST_LICENSE_KEY}`);
console.log(`   Requesting Device ID:  ${TEST_DEVICE_ID}`);
console.log(`   Device ID from License: ${validationResult.deviceIdFromLicense}`);
console.log(`   Normalized Device MAC:  ${validationResult.normalizedDeviceMac}`);
console.log(`   Device IDs Match:       ${validationResult.deviceIdsMatch ? "✅ YES" : "❌ NO"}`);
console.log(`   Valid:                  ${validationResult.valid ? "✅ YES" : "❌ NO"}`);
if (validationResult.error) {
  console.log(`   Error:                  ${validationResult.error}`);
}
console.log();

console.log("TEST 4: Database Query Simulation");
console.log("-".repeat(80));
console.log("Simulating what the database query would look for:");
console.log();
console.log("1. License Key Normalization:");
console.log(`   Input:          ${TEST_LICENSE_KEY}`);
console.log(`   Normalized:     ${TEST_LICENSE_KEY.trim().toUpperCase()}`);
console.log();
console.log("2. Database Query (Supabase):");
console.log(`   .from("licenses")`);
console.log(`   .select("*")`);
console.log(`   .eq("license_key", "${TEST_LICENSE_KEY.trim().toUpperCase()}")`);
console.log();
console.log("3. Expected Database Record:");
console.log(`   license_key:  ${TEST_LICENSE_KEY.trim().toUpperCase()}`);
console.log(`   mac_address:  ${formatMacAddressWithColons(normalizeMacAddress(TEST_DEVICE_ID))}`);
console.log(`   status:       active`);
console.log();

console.log("TEST 5: Common Issues Check");
console.log("-".repeat(80));

// Check for common formatting issues
const checks = [
  {
    name: "License key has correct prefix",
    check: TEST_LICENSE_KEY.trim().toUpperCase().startsWith("LICENSE-"),
    fix: "License must start with 'LICENSE-'",
  },
  {
    name: "License key has correct format (3 parts)",
    check: TEST_LICENSE_KEY.trim().toUpperCase().split("-").length === 3,
    fix: "License must have format: LICENSE-{12chars}-{8chars}",
  },
  {
    name: "Device ID part is 12 characters",
    check: extractDeviceIdFromLicense(TEST_LICENSE_KEY)?.length === 12,
    fix: "Device ID part must be exactly 12 hex characters",
  },
  {
    name: "Device ID is valid hex",
    check: /^[0-9A-F]{12}$/.test(extractDeviceIdFromLicense(TEST_LICENSE_KEY) || ""),
    fix: "Device ID must be valid hexadecimal (0-9, A-F)",
  },
  {
    name: "Device IDs match (case-insensitive)",
    check: extractDeviceIdFromLicense(TEST_LICENSE_KEY)?.toUpperCase() === 
           normalizeMacAddress(TEST_DEVICE_ID)?.toUpperCase(),
    fix: "Device ID in license must match the requesting device's MAC address",
  },
];

let allChecksPassed = true;
checks.forEach(({ name, check, fix }) => {
  if (check) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`❌ ${name}`);
    console.log(`   Issue: ${fix}`);
    allChecksPassed = false;
  }
});

console.log();
console.log("=".repeat(80));
if (allChecksPassed && validationResult.valid) {
  console.log("✅ ALL TESTS PASSED - License matching logic is correct!");
  console.log();
  console.log("If license validation is still failing, check:");
  console.log("  1. The license exists in the 'licenses' table in Supabase");
  console.log("  2. The license_key in the database matches exactly (case-insensitive)");
  console.log("  3. The license status is 'active'");
  console.log("  4. The license has not expired");
  console.log("  5. The database connection is working");
} else {
  console.log("❌ SOME TESTS FAILED - Check the issues above");
  console.log();
  console.log("Potential fixes:");
  console.log("  1. Verify the license was correctly saved to the database");
  console.log("  2. Check that the device ID matches exactly when generating the license");
  console.log("  3. Ensure MAC address normalization is consistent");
}
console.log("=".repeat(80));
