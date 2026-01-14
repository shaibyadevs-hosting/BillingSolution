/**
 * Integration Test: License Validation
 * 
 * Tests the actual license validation logic with various scenarios
 * 
 * Run with: node scripts/test-license-validation.js
 */

// Simulate the validation logic from license-manager.ts

// Simulate the validation function
function validateLicenseOnline(licenseKey, macAddress, mockLicenseFromDB) {
  try {
    // Normalize license key: trim and uppercase to match creation format
    const normalizedLicenseKey = licenseKey.trim().toUpperCase();

    // Simulate database lookup - in real code this queries Supabase
    if (!mockLicenseFromDB) {
      return {
        valid: false,
        error: "License not found. Please check the license key and try again.",
      };
    }

    const licenseData = mockLicenseFromDB;

    // Check if license status is active
    if (licenseData.status !== "active") {
      return {
        valid: false,
        error: `License is ${licenseData.status}. Please contact support.`,
      };
    }

    // Check if this is a special license (works on any machine)
    const isSpecialLicenseData =
      licenseData.mac_address === "EMERGENCY" ||
      licenseData.license_key.startsWith("SPECIAL-") ||
      licenseData.mac_address === "MASTER";

    // For special licenses, skip MAC address validation (works on any machine)
    // For regular licenses, validate MAC address by comparing device ID extracted from license
    // with the requesting device's MAC address
    if (!isSpecialLicenseData && macAddress) {
      // Extract device ID from license key (format: LICENSE-{12_CHAR_DEVICE_ID}-{UUID})
      const licenseParts = normalizedLicenseKey.split("-");
      if (licenseParts.length >= 2) {
        const deviceIdFromLicense = licenseParts[1]; // 12-character device ID

        // Normalize the requesting device's MAC address (remove colons, uppercase)
        const normalizedDeviceMac = macAddress
          .trim()
          .toUpperCase()
          .replace(/[:-]/g, "");

        // Compare device IDs (both should be 12 hex characters)
        if (deviceIdFromLicense.length === 12 && normalizedDeviceMac.length === 12) {
          if (deviceIdFromLicense !== normalizedDeviceMac) {
            return {
              valid: false,
              error: "License is not valid for this device. The license key does not match this device's ID.",
            };
          }
        }
      }
    }

    // Check if license is expired
    const expiresOn = new Date(licenseData.expires_on);
    const now = new Date();

    if (expiresOn < now) {
      return { valid: false, error: "License has expired" };
    }

    return {
      valid: true,
      licenseData: {
        licenseKey: licenseData.license_key,
        macAddress: licenseData.mac_address,
        clientName: licenseData.client_name,
        activatedOn: licenseData.activated_on,
        expiresOn: licenseData.expires_on,
        status: licenseData.status,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message || "Failed to validate license",
    };
  }
}

// Test cases
const testCases = [
  {
    name: "✅ Valid license with matching device ID",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "03:79:CC:AF:D2:10",
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC",
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "active",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: true,
  },
  {
    name: "❌ License not found in database",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "03:79:CC:AF:D2:10",
    mockLicense: null,
    expectedValid: false,
    expectedError: "License not found",
  },
  {
    name: "❌ Device ID mismatch",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "AA:BB:CC:DD:EE:FF", // Different MAC
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC",
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "active",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: false,
    expectedError: "not valid for this device",
  },
  {
    name: "❌ License status is revoked",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "03:79:CC:AF:D2:10",
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC",
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "revoked",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: false,
    expectedError: "revoked",
  },
  {
    name: "❌ License expired",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "03:79:CC:AF:D2:10",
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC",
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "active",
      activated_on: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      expires_on: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(), // Expired 50 days ago
    },
    expectedValid: false,
    expectedError: "expired",
  },
  {
    name: "✅ Special license (EMERGENCY) works on any device",
    licenseKey: "SPECIAL-ABCDEF123456-7899A3CC",
    macAddress: "AA:BB:CC:DD:EE:FF", // Different MAC, but should work
    mockLicense: {
      license_key: "SPECIAL-ABCDEF123456-7899A3CC",
      mac_address: "EMERGENCY",
      client_name: "Emergency License",
      status: "active",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: true,
  },
  {
    name: "✅ MAC address with different format (colon vs dash)",
    licenseKey: "LICENSE-0379CCAFD210-7899A3CC",
    macAddress: "03-79-CC-AF-D2-10", // Dashes instead of colons
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC",
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "active",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: true, // Should work because we normalize both
  },
  {
    name: "✅ License key with different case",
    licenseKey: "license-0379ccafd210-7899a3cc", // Lowercase
    macAddress: "03:79:CC:AF:D2:10",
    mockLicense: {
      license_key: "LICENSE-0379CCAFD210-7899A3CC", // Uppercase in DB
      mac_address: "03:79:CC:AF:D2:10",
      client_name: "Test Client",
      status: "active",
      activated_on: new Date().toISOString(),
      expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedValid: true, // Should work because we normalize to uppercase
  },
];

// Run tests
console.log("=".repeat(80));
console.log("LICENSE VALIDATION INTEGRATION TESTS");
console.log("=".repeat(80));
console.log();

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log("-".repeat(80));

  const result = validateLicenseOnline(
    testCase.licenseKey,
    testCase.macAddress,
    testCase.mockLicense || undefined
  );

  const testPassed =
    result.valid === testCase.expectedValid &&
    (!testCase.expectedError ||
      (result.error && result.error.toLowerCase().includes(testCase.expectedError.toLowerCase())));

  if (testPassed) {
    console.log("✅ PASSED");
    passed++;
  } else {
    console.log("❌ FAILED");
    console.log(`   Expected valid: ${testCase.expectedValid}, Got: ${result.valid}`);
    if (testCase.expectedError) {
      console.log(`   Expected error to contain: "${testCase.expectedError}"`);
    }
    if (result.error) {
      console.log(`   Got error: "${result.error}"`);
    }
    failed++;
  }

  if (result.valid) {
    console.log(`   License validated successfully`);
  } else {
    console.log(`   Error: ${result.error}`);
  }

  console.log();
});

console.log("=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${testCases.length}`);
console.log();

if (failed === 0) {
  console.log("🎉 ALL TESTS PASSED!");
} else {
  console.log("⚠️  SOME TESTS FAILED - Please review the results above");
}

console.log("=".repeat(80));
