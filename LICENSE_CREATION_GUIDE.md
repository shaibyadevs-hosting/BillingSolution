# License Creation Guide

## Problem Identified

Based on the console logs, the licenses are **not in the database**. The validation logic is working correctly, but the licenses need to be created first.

## How to Create a License

### Option 1: Using the API Endpoint (Recommended)

**Endpoint**: `POST /api/license/seed`

**Example using cURL**:
```bash
curl -X POST https://your-app-url.com/api/license/seed \
  -H "Content-Type: application/json" \
  -d '{
    "macAddress": "AE:CA:F0:0F:2B:0D",
    "clientName": "Test Client",
    "expiresInDays": 365
  }'
```

**Example using JavaScript**:
```javascript
const response = await fetch('/api/license/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    macAddress: 'AE:CA:F0:0F:2B:0D',
    clientName: 'Test Client',
    expiresInDays: 365
  })
});

const data = await response.json();
console.log('Created License:', data.license.licenseKey);
```

### Option 2: Using the Admin Panel

If you have access to the admin panel:
1. Go to `/admin/ckejwngw242r1` (or your admin route)
2. Use the "Create License" section
3. Enter the MAC address: `AE:CA:F0:0F:2B:0D`
4. Click "Create License"
5. Copy the generated license key

### Option 3: Direct Database Insert (Advanced)

Only use this if you have direct database access:

```sql
INSERT INTO licenses (
  license_key,
  mac_address,
  client_name,
  activated_on,
  expires_on,
  status
) VALUES (
  'LICENSE-AECAF00F2B0D-XXXXXXXX',  -- Replace X with UUID
  'AE:CA:F0:0F:2B:0D',
  'Client Name',
  NOW(),
  NOW() + INTERVAL '365 days',
  'active'
);
```

## Current Situation

From your logs:
- **Device ID**: `AE:CA:F0:0F:2B:0D` → Normalized: `AECAF00F2B0D` ✅
- **License Key Tried**: `LICENSE-AECAF00F2B0D-4DE43EA9` ❌ (Not in database)
- **License Key Tried**: `LICENSE-AECAF00F2B0D-5246D027` ❌ (Not in database)

## Steps to Fix

1. **Create the license** using one of the methods above with MAC address: `AE:CA:F0:0F:2B:0D`
2. **Copy the generated license key** from the response
3. **Use that exact license key** when activating on the device

## Verification

After creating the license, verify it exists:

```sql
SELECT * FROM licenses WHERE mac_address = 'AE:CA:F0:0F:2B:0D';
```

Or check in the Supabase dashboard:
1. Go to your Supabase project
2. Navigate to Table Editor
3. Open the `licenses` table
4. Search for the MAC address or license key

## Important Notes

- The license key format is: `LICENSE-{12_CHAR_DEVICE_ID}-{8_CHAR_UUID}`
- The device ID is extracted from the MAC address (without colons)
- The UUID part is randomly generated during creation
- Each license is tied to a specific MAC address (device ID)
- You cannot use a license key from one device on another device (unless it's a special/emergency license)

## Troubleshooting

If you still get "License not found" after creating:

1. **Check the license was actually saved**:
   - Go to Supabase dashboard
   - Check the `licenses` table
   - Verify the license_key matches exactly

2. **Check environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` is set
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
   - `SUPABASE_SERVICE_ROLE_KEY` is set (for creation)

3. **Check RLS policies**:
   - Make sure RLS policies allow reading licenses
   - The anon key should have SELECT permission on the licenses table

4. **Check database connection**:
   - Ensure your app is connected to the correct Supabase project
   - Verify the table name is `licenses` (not `license` or `Licenses`)
