import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

/**
 * POST /api/license/seed
 * Seeds a license for a given MAC address or creates an emergency license
 * 
 * Body: {
 *   macAddress: string (required for regular licenses, or "EMERGENCY"/"ANY" for emergency)
 *   clientName?: string (optional, defaults to "Default Client")
 *   expiresInDays?: number (optional, defaults to 365)
 *   isEmergency?: boolean (optional, if true creates emergency license that works on any machine)
 * }
 * 
 * License Types:
 * - Regular License: Format LICENSE-{MAC12chars}-{UUID8chars}, tied to specific MAC address
 * - Emergency License: Format EMERGENCY-{UUID12chars}-{UUID8chars}, works on any machine
 */
export async function POST(request: Request) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        {
          error: "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
        },
        { status: 500 }
      );
    }

    // Check if service role key is configured (required for admin operations)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured. This is required for license creation. Please add it to your environment variables.",
          hint: "The service role key bypasses RLS (Row Level Security) and is needed for admin operations like license creation.",
        },
        { status: 500 }
      );
    }

    // License seed API is accessible without authentication
    // This allows seeding licenses in a separate environment from the main app
    // Authentication is optional - if user is authenticated, we'll record who created it
    let user = null;
    
    try {
      const supabase = await createClient();
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user; // Will be null if not authenticated, which is fine
    } catch (fetchError: any) {
      // Silently handle auth errors - license seed doesn't require auth
      console.log("[API /license/seed] No authentication (this is allowed for license seeding)");
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error("[API /license/seed] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON format." },
        { status: 400 }
      );
    }

    const { macAddress, clientName, expiresInDays, isEmergency } = body;

    // Check if this is an emergency/master license (works on any machine)
    const isEmergencyLicense = isEmergency === true || macAddress?.trim().toUpperCase() === "EMERGENCY" || macAddress?.trim().toUpperCase() === "ANY";
    
    let formattedMac: string;
    
    if (isEmergencyLicense) {
      // Emergency license: use "EMERGENCY" as MAC address (works on any machine)
      formattedMac = "EMERGENCY";
    } else {
      // Regular license: validate MAC address
      if (!macAddress || !macAddress.trim()) {
        return NextResponse.json(
          { error: "MAC address is required (or set isEmergency: true for emergency license)" },
          { status: 400 }
        );
      }

      // Normalize MAC address (uppercase, remove separators if any)
      const normalizedMac = macAddress.trim().toUpperCase().replace(/[:-]/g, "");
      
      // Validate MAC address format (should be 12 hex characters)
      if (!/^[0-9A-F]{12}$/.test(normalizedMac)) {
        return NextResponse.json(
          { error: "Invalid MAC address format. Expected format: XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX" },
          { status: 400 }
        );
      }

      // Format MAC address with colons for storage
      formattedMac = normalizedMac.match(/.{2}/g)?.join(":") || normalizedMac;
    }

    // Set defaults
    const finalClientName = clientName?.trim() || "Default Client";
    const finalExpiresInDays = expiresInDays ? Number(expiresInDays) : 365;

    if (Number.isNaN(finalExpiresInDays) || finalExpiresInDays <= 0) {
      return NextResponse.json(
        { error: "expiresInDays must be a positive number" },
        { status: 400 }
      );
    }

    // Generate license key (UUID-based)
    // Special licenses use "SPECIAL" prefix, regular licenses use MAC-based prefix
    let licenseKey: string;
    if (isEmergencyLicense) {
      licenseKey = `SPECIAL-${uuidv4().substring(0, 12).toUpperCase()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    } else {
      const normalizedMac = formattedMac.replace(/:/g, "");
      licenseKey = `LICENSE-${normalizedMac.substring(0, 12)}-${uuidv4().substring(0, 8).toUpperCase()}`;
    }

    // Initialize Supabase client with service role key
    // This bypasses RLS (Row Level Security) which is required for admin operations
    // Service role key is checked above, so we know it exists here
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // No-op for API routes
          },
        },
      }
    );

    // Check if license already exists
    // For special licenses, we allow multiple (they're universal)
    // For regular licenses, check by MAC address
    let existingLicenses: any[] = [];
    let queryError: any = null;
    
    if (!isEmergencyLicense) {
      // For regular licenses, check if one already exists for this MAC
      const result = await supabase
        .from("licenses")
        .select("id")
        .eq("mac_address", formattedMac)
        .limit(1);
      existingLicenses = result.data || [];
      queryError = result.error;
    }
    // For special licenses, we don't check - allow multiple universal licenses

    if (queryError) {
      console.error("[API /license/seed] Supabase query error:", queryError);
      return NextResponse.json(
        {
          error: "Failed to query licenses. Please check your Supabase configuration.",
          details: process.env.NODE_ENV === "development" ? queryError.message : undefined,
        },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const expiresOn = new Date(Date.now() + finalExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const licenseData = {
      license_key: licenseKey,
      mac_address: formattedMac,
      client_name: finalClientName,
      activated_on: now,
      expires_on: expiresOn,
      status: "active",
      created_by: user?.id || null,
    };

    let licenseId: string;
    let isUpdate = false;

    try {
      if (existingLicenses && existingLicenses.length > 0) {
        // Update existing license
        const { data: updated, error: updateError } = await supabase
          .from("licenses")
          .update(licenseData)
          .eq("id", existingLicenses[0].id)
          .select("id, license_key, status")
          .single();

        if (updateError) {
          console.error("[API /license/seed] Update error details:", {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
            licenseData,
          });
          throw updateError;
        }

        if (!updated) {
          throw new Error("License was updated but no data returned");
        }

        console.log("[API /license/seed] License updated successfully:", {
          id: updated.id,
          license_key: updated.license_key,
          status: updated.status,
        });

        licenseId = updated.id;
        isUpdate = true;
      } else {
        // Create new license
        const { data: created, error: insertError } = await supabase
          .from("licenses")
          .insert(licenseData)
          .select("id, license_key, status")
          .single();

        if (insertError) {
          console.error("[API /license/seed] Insert error details:", {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint,
            licenseData,
          });
          throw insertError;
        }

        if (!created) {
          throw new Error("License was created but no data returned");
        }

        console.log("[API /license/seed] License created successfully:", {
          id: created.id,
          license_key: created.license_key,
          status: created.status,
        });

        licenseId = created.id;
      }
    } catch (dbError: any) {
      console.error("[API /license/seed] Supabase write error:", dbError);
      console.error("[API /license/seed] License data that failed:", licenseData);
      
      // Provide more helpful error messages
      let errorMessage = "Failed to save license to Supabase.";
      if (dbError.message) {
        if (dbError.message.includes("permission denied") || dbError.message.includes("RLS")) {
          errorMessage = "Permission denied. Please ensure SUPABASE_SERVICE_ROLE_KEY is configured in your environment variables.";
        } else if (dbError.message.includes("relation") && dbError.message.includes("does not exist")) {
          errorMessage = "Licenses table not found. Please run the database migration script.";
        } else {
          errorMessage = `Database error: ${dbError.message}`;
        }
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          details: process.env.NODE_ENV === "development" ? {
            message: dbError.message,
            code: dbError.code,
            hint: dbError.hint,
            hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          } : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: isUpdate
          ? "License updated successfully"
          : "License created successfully",
        license: {
          licenseKey,
          macAddress: formattedMac,
          clientName: finalClientName,
          expiresInDays: finalExpiresInDays,
          status: "active",
          id: licenseId,
        },
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("[API /license/seed] Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to seed license",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/license/seed
 * Returns method not allowed - this endpoint only accepts POST
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. This endpoint only accepts POST requests.",
      message: "Use POST method to seed a license. Example: POST /api/license/seed with body { macAddress: 'AA:BB:CC:DD:EE:FF' }",
    },
    { status: 405 }
  );
}

