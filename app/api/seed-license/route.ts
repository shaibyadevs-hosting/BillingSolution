import { NextRequest, NextResponse } from "next/server";
import { seedInitialLicense, createLicense } from "@/lib/utils/firestore-seed";

/**
 * API route to provision licenses in Firestore.
 *
 * POST /api/seed-license
 * Body: { licenseKey?: string, macAddress?: string, clientName?: string, expiresInDays?: number }
 *
 * If no body is provided, creates an initial placeholder license (macAddress=00:00:00:00:00:00).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const ua = request.headers.get("user-agent") || "";
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const maskedKey =
      typeof body.licenseKey === "string" && body.licenseKey.length >= 6
        ? `${body.licenseKey.slice(0, 3)}***${body.licenseKey.slice(-3)}`
        : "***";

    console.log("[SeedAPI] Incoming seed request", {
      ts: new Date().toISOString(),
      ip,
      ua,
      macAddress: body.macAddress,
      licenseKey: maskedKey,
      clientName: body.clientName,
    });

    // If specific license data is provided, create that license
    if (body.licenseKey && body.macAddress && body.clientName) {
      const result = await createLicense({
        licenseKey: body.licenseKey,
        macAddress: body.macAddress,
        clientName: body.clientName,
        expiresInDays: body.expiresInDays || 365,
      });

      if (result.success) {
        console.log("[SeedAPI] License created/updated", {
          licenseKey: maskedKey,
          macAddress: body.macAddress,
          licenseId: result.licenseId,
        });
        return NextResponse.json({
          success: true,
          message: result.message,
          licenseId: result.licenseId,
        });
      } else {
        console.warn("[SeedAPI] License create failed", {
          licenseKey: maskedKey,
          macAddress: body.macAddress,
          message: result.message,
        });
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 }
        );
      }
    }

    // Otherwise, seed a default license placeholder
    const result = await seedInitialLicense();
    console.log("[SeedAPI] Initial license seeding attempted", {
      message: result.message,
      success: result.success,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[SeedAPI] Error in seed-license API:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to seed license",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if licenses exist
 */
export async function GET() {
  try {
    const result = await seedInitialLicense();
    console.log("[SeedAPI] GET seed/license check", {
      message: result.message,
      success: result.success,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to check licenses",
      },
      { status: 500 }
    );
  }
}


