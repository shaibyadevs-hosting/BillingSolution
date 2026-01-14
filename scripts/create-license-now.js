/**
 * Quick Script to Create a License
 * 
 * Usage: 
 *   Set environment variables or edit the script:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or use API endpoint)
 * 
 *   Run: node scripts/create-license-now.js AE:CA:F0:0F:2B:0D
 */

const macAddress = process.argv[2] || "AE:CA:F0:0F:2B:0D";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

console.log("=".repeat(80));
console.log("CREATE LICENSE SCRIPT");
console.log("=".repeat(80));
console.log();
console.log("MAC Address:", macAddress);
console.log("App URL:", appUrl);
console.log();

async function createLicense() {
  try {
    console.log("Creating license via API endpoint...");
    
    const response = await fetch(`${appUrl}/api/license/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        macAddress: macAddress,
        clientName: 'Auto-generated License',
        expiresInDays: 365,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error creating license:");
      console.error("  Status:", response.status);
      console.error("  Error:", data.error);
      if (data.details) {
        console.error("  Details:", JSON.stringify(data.details, null, 2));
      }
      process.exit(1);
    }

    console.log("✅ License created successfully!");
    console.log();
    console.log("License Details:");
    console.log("  - License Key:", data.license.licenseKey);
    console.log("  - MAC Address:", data.license.macAddress);
    console.log("  - Client Name:", data.license.clientName);
    console.log("  - Status:", data.license.status);
    console.log("  - Expires In:", data.license.expiresInDays, "days");
    console.log();
    console.log("📋 COPY THIS LICENSE KEY:");
    console.log("─".repeat(80));
    console.log(data.license.licenseKey);
    console.log("─".repeat(80));
    console.log();
    console.log("✅ Use this license key on the device with MAC address:", macAddress);
    
  } catch (error) {
    console.error("❌ Failed to create license:");
    console.error("  Error:", error.message);
    console.error();
    console.error("Troubleshooting:");
    console.error("  1. Make sure the app is running");
    console.error("  2. Check NEXT_PUBLIC_APP_URL environment variable");
    console.error("  3. Verify SUPABASE_SERVICE_ROLE_KEY is set on the server");
    process.exit(1);
  }
}

createLicense();
