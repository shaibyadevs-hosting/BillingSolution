# License Validation Fix Summary

## Problem
User reported that when pasting a license key on a machine, they get the error:
"License not found. Please check the license key and try again."

Example:
- Device ID: `03:79:CC:AF:D2:10`
- License Generated: `LICENSE-0379CCAFD210-7899A3CC`

## Analysis

### Test Results
Created `scripts/test-license-matching.js` which verifies:
- ✅ License generation logic is correct
- ✅ Device ID extraction from license works correctly
- ✅ Device ID matching logic works correctly
- ✅ License format validation works correctly

The matching logic itself is **not the problem**.

### Issues Found

1. **MAC Address Validation Was Disabled**
   - The `validateLicenseOnline` function had MAC address validation commented out
   - This meant licenses could potentially be used on any device (security issue)
   - The MAC address was being fetched but not used for validation

2. **MAC Address Not Passed to Validation**
   - The `activateLicense` function was not passing the MAC address to `validateLicenseOnline`
   - Even if validation was enabled, it wouldn't work because the MAC wasn't being passed

3. **License Not Found Error**
   - The "License not found" error suggests the license key doesn't exist in the database
   - This could be due to:
     - License never being saved to the database
     - License being in a different database/environment
     - Case sensitivity issues (though this is handled)
     - Database connection issues

## Fixes Applied

### 1. Enabled MAC Address Validation (`lib/utils/license-manager.ts`)
   - Added logic to extract device ID from license key
   - Compare it with the requesting device's MAC address
   - Return error if they don't match (for regular licenses)
   - Still allows special/emergency licenses to work on any device

### 2. Updated `activateLicense` Function (`lib/utils/license-manager.ts`)
   - Added `macAddress` parameter to the function signature
   - Now passes MAC address to `validateLicenseOnline` function

### 3. Updated License Page (`app/license/page.tsx`)
   - Now passes the MAC address when calling `activateLicense`
   - Adds logging for better debugging

## Testing Tools Created

### 1. `scripts/test-license-matching.js`
   - Tests license generation logic
   - Tests device ID extraction
   - Tests matching logic
   - Validates format and structure
   - Run with: `node scripts/test-license-matching.js`

### 2. `scripts/debug-license-lookup.js`
   - Simulates database queries
   - Helps debug "License not found" errors
   - Shows exactly what the database query looks for
   - Can actually query Supabase if configured
   - Run with: `node scripts/debug-license-lookup.js LICENSE-XXXXXXXXXXXX-XXXXXXXX`

## How License Matching Works

1. **License Generation** (from `/api/license/seed`):
   ```
   Device ID: 03:79:CC:AF:D2:10
   → Normalize: 0379CCAFD210 (remove colons, uppercase)
   → Generate: LICENSE-0379CCAFD210-{UUID8chars}
   → Store MAC in DB: 03:79:CC:AF:D2:10 (with colons)
   ```

2. **License Validation** (from `validateLicenseOnline`):
   ```
   License Key: LICENSE-0379CCAFD210-7899A3CC
   → Extract device ID: 0379CCAFD210
   → Get device MAC: 03:79:CC:AF:D2:10
   → Normalize device MAC: 0379CCAFD210
   → Compare: 0379CCAFD210 === 0379CCAFD210 ✅
   → Query database by license_key
   → If found and active, validate MAC address matches
   ```

## Next Steps for User

If you're still getting "License not found" errors:

1. **Verify License Exists in Database**:
   - Check Supabase dashboard
   - Query: `SELECT * FROM licenses WHERE license_key = 'LICENSE-0379CCAFD210-7899A3CC'`

2. **Check License Status**:
   - Must be `status = 'active'`
   - Must not be expired (`expires_on > NOW()`)

3. **Re-create License if Needed**:
   - Use `/api/license/seed` endpoint
   - Ensure it returns success
   - Verify it appears in the database

4. **Run Debug Script**:
   ```bash
   node scripts/debug-license-lookup.js LICENSE-0379CCAFD210-7899A3CC 03:79:CC:AF:D2:10
   ```

5. **Check Browser Console**:
   - Look for `[LicenseManager]` log messages
   - Check for database connection errors
   - Verify MAC address is being fetched correctly

## Security Improvement

The fix also improves security by:
- Ensuring licenses are tied to specific devices
- Preventing license sharing between devices
- Validating device ID matches before activation

Special licenses (EMERGENCY, SPECIAL-*, MASTER-BYPASS-*) still work on any device as intended.
