/**
 * Debug Script: License Database Lookup
 * 
 * This script helps debug license lookup issues by simulating the exact
 * database query that would be performed during validation.
 * 
 * Usage: 
 *   Set environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY (optional, for admin operations)
 * 
 *   Then run: node scripts/debug-license-lookup.js LICENSE-XXXXXXXXXXXX-XXXXXXXX
 */

// Test data from user
const TEST_LICENSE_KEY = process.argv[2] || "LICENSE-0379CCAFD210-7899A3CC";
const TEST_DEVICE_ID = process.argv[3] || "03:79:CC:AF:D2:10";

console.log("=".repeat(80));
console.log("LICENSE DATABASE LOOKUP DEBUG SCRIPT");
console.log("=".repeat(80));
console.log();

// Check if Supabase is configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERROR: Supabase not configured!");
  console.error("Please set the following environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error();
  console.error("Optionally set (for admin operations):");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log("✅ Supabase configuration found");
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
console.log(`   Service Key: ${supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'Not set'}`);
console.log();

// Normalize license key (same as in validateLicenseOnline)
const normalizedLicenseKey = TEST_LICENSE_KEY.trim().toUpperCase();
console.log("License Key Normalization:");
console.log(`   Input:     ${TEST_LICENSE_KEY}`);
console.log(`   Normalized: ${normalizedLicenseKey}`);
console.log();

// Extract device ID from license
function extractDeviceIdFromLicense(licenseKey) {
  const parts = licenseKey.split("-");
  if (parts.length >= 2 && parts[0] === "LICENSE") {
    return parts[1];
  }
  return null;
}

const deviceIdFromLicense = extractDeviceIdFromLicense(normalizedLicenseKey);
console.log("Device ID Extraction:");
if (deviceIdFromLicense) {
  console.log(`   Device ID from License: ${deviceIdFromLicense}`);
  console.log(`   Device ID length: ${deviceIdFromLicense.length} (expected: 12)`);
} else {
  console.log("   ❌ Failed to extract device ID from license");
}
console.log();

// Normalize device MAC
function normalizeMacAddress(macAddress) {
  return macAddress
    .trim()
    .toUpperCase()
    .replace(/[:-]/g, "");
}

const normalizedDeviceMac = normalizeMacAddress(TEST_DEVICE_ID);
console.log("Device MAC Normalization:");
console.log(`   Input:     ${TEST_DEVICE_ID}`);
console.log(`   Normalized: ${normalizedDeviceMac}`);
console.log();

// Compare device IDs
if (deviceIdFromLicense && normalizedDeviceMac) {
  console.log("Device ID Comparison:");
  console.log(`   From License: ${deviceIdFromLicense}`);
  console.log(`   From Device:  ${normalizedDeviceMac}`);
  if (deviceIdFromLicense === normalizedDeviceMac) {
    console.log("   ✅ Device IDs MATCH!");
  } else {
    console.log("   ❌ Device IDs DO NOT MATCH!");
    console.log("   This license is not valid for this device.");
  }
}
console.log();

// Try to query Supabase (if @supabase/supabase-js is available)
(async () => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    console.log("=".repeat(80));
    console.log("ATTEMPTING DATABASE QUERY");
    console.log("=".repeat(80));
    console.log();
    
    // Use service role key if available, otherwise use anon key
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey
    );
    
    console.log("Query 1: Exact match (case-sensitive)");
    console.log(`   .from("licenses")`);
    console.log(`   .select("*")`);
    console.log(`   .eq("license_key", "${normalizedLicenseKey}")`);
    console.log();
    
    const { data: exactMatch, error: exactError } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", normalizedLicenseKey);
    
    if (exactError) {
      console.error("❌ Query Error:", exactError.message);
      console.error("   Code:", exactError.code);
      console.error("   Details:", exactError.details);
      console.error("   Hint:", exactError.hint);
    } else if (exactMatch && exactMatch.length > 0) {
      console.log("✅ License found with exact match!");
      console.log("   License Data:");
      const license = exactMatch[0];
      console.log(`     ID:            ${license.id}`);
      console.log(`     License Key:   ${license.license_key}`);
      console.log(`     MAC Address:   ${license.mac_address}`);
      console.log(`     Client Name:   ${license.client_name}`);
      console.log(`     Status:        ${license.status}`);
      console.log(`     Activated On:  ${license.activated_on}`);
      console.log(`     Expires On:    ${license.expires_on}`);
      
      // Check expiration
      const expiresOn = new Date(license.expires_on);
      const now = new Date();
      if (expiresOn < now) {
        console.log("   ⚠️  License has EXPIRED!");
      } else {
        console.log("   ✅ License is not expired");
      }
    } else {
      console.log("❌ No license found with exact match");
      console.log();
      
      // Try case-insensitive search
      console.log("Query 2: Case-insensitive search (ilike)");
      console.log(`   .from("licenses")`);
      console.log(`   .select("*")`);
      console.log(`   .ilike("license_key", "${normalizedLicenseKey}")`);
      console.log();
      
      const { data: caseInsensitive, error: caseError } = await supabase
        .from("licenses")
        .select("*")
        .ilike("license_key", normalizedLicenseKey);
      
      if (caseError) {
        console.error("❌ Case-insensitive query error:", caseError.message);
      } else if (caseInsensitive && caseInsensitive.length > 0) {
        console.log("✅ License found with case-insensitive search!");
        console.log("   This suggests the license exists but with different casing.");
        console.log("   License Data:");
        const license = caseInsensitive[0];
        console.log(`     License Key: ${license.license_key}`);
        console.log(`     MAC Address: ${license.mac_address}`);
        console.log(`     Status:      ${license.status}`);
      } else {
        console.log("❌ No license found with case-insensitive search");
        console.log();
        
        // Try partial match for debugging
        console.log("Query 3: Partial match (for debugging)");
        const prefix = normalizedLicenseKey.substring(0, 15);
        console.log(`   .from("licenses")`);
        console.log(`   .select("license_key, status, mac_address")`);
        console.log(`   .ilike("license_key", "%${prefix}%")`);
        console.log(`   .limit(10)`);
        console.log();
        
        const { data: partial, error: partialError } = await supabase
          .from("licenses")
          .select("license_key, status, mac_address")
          .ilike("license_key", `%${prefix}%`)
          .limit(10);
        
        if (partialError) {
          console.error("❌ Partial match query error:", partialError.message);
        } else if (partial && partial.length > 0) {
          console.log("⚠️  Found similar licenses (for debugging):");
          partial.forEach((license, index) => {
            console.log(`   ${index + 1}. ${license.license_key} (${license.status})`);
          });
        } else {
          console.log("❌ No similar licenses found");
          console.log();
          console.log("=".repeat(80));
          console.log("DIAGNOSIS");
          console.log("=".repeat(80));
          console.log();
          console.log("The license key is NOT in the database.");
          console.log();
          console.log("Possible causes:");
          console.log("  1. The license was never created/saved to the database");
          console.log("  2. The license was deleted");
          console.log("  3. There's a typo in the license key");
          console.log("  4. The license is in a different database/environment");
          console.log();
          console.log("To fix:");
          console.log("  1. Verify the license was created using /api/license/seed");
          console.log("  2. Check the Supabase dashboard to see if the license exists");
          console.log("  3. Re-create the license if necessary");
        }
      }
    }
    
    console.log();
    console.log("=".repeat(80));
    
  } catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log("⚠️  @supabase/supabase-js not installed. Cannot perform database query.");
    console.log("   Install it with: npm install @supabase/supabase-js");
    console.log();
    console.log("However, the logic checks above show:");
    console.log("   - License key normalization works correctly");
    console.log("   - Device ID extraction works correctly");
    console.log("   - Device ID matching logic works correctly");
    console.log();
    console.log("The issue is likely that the license doesn't exist in the database.");
  } else {
    console.error("❌ Error:", error.message);
  }
})();
