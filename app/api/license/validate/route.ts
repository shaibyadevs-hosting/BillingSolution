import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * POST /api/license/validate
 * Validates a license key (server-side with service role key to bypass RLS)
 * 
 * Body: {
 *   licenseKey: string (required)
 *   macAddress?: string (optional)
 * }
 */
export async function POST(request: Request) {
	try {
		// Check if Supabase is configured
		if (
			!process.env.NEXT_PUBLIC_SUPABASE_URL ||
			!process.env.SUPABASE_SERVICE_ROLE_KEY
		) {
			return NextResponse.json(
				{
					error: "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
				},
				{ status: 500 }
			);
		}

		// Parse request body
		let body;
		try {
			body = await request.json();
		} catch (parseError: any) {
			return NextResponse.json(
				{ error: "Invalid request body. Expected JSON format." },
				{ status: 400 }
			);
		}

		const { licenseKey, macAddress } = body;

		if (!licenseKey || !licenseKey.trim()) {
			return NextResponse.json(
				{ error: "License key is required" },
				{ status: 400 }
			);
		}

		// Normalize license key
		const normalizedLicenseKey = licenseKey.trim().toUpperCase();

		// Create Supabase client with service role key (bypasses RLS)
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

		// Validate license (logs removed for security)

		// Query license from database
		let { data: licenses, error } = await supabase
			.from("licenses")
			.select("*")
			.eq("license_key", normalizedLicenseKey)
			.limit(1);

		// If no results, try case-insensitive search
		if ((!licenses || licenses.length === 0) && !error) {
			const caseInsensitiveQuery = await supabase
				.from("licenses")
				.select("*")
				.ilike("license_key", normalizedLicenseKey)
				.limit(1);

			licenses = caseInsensitiveQuery.data;
			error = caseInsensitiveQuery.error;
		}

		if (error) {
			console.error("[API /license/validate] Database error");
			return NextResponse.json(
				{
					valid: false,
					error: "Failed to validate license. Please check your internet connection.",
				},
				{ status: 500 }
			);
		}

		if (!licenses || licenses.length === 0) {
			return NextResponse.json({
				valid: false,
				error: "License not found. Please check the license key and try again.",
			});
		}

		const licenseData = licenses[0];

		// Check if license status is active
		if (licenseData.status !== "active") {
			return NextResponse.json({
				valid: false,
				error: `License is ${licenseData.status}. Please contact support.`,
			});
		}

		// Check if this is a special license (works on any machine)
		const isSpecialLicenseData =
			licenseData.mac_address === "EMERGENCY" ||
			licenseData.license_key.startsWith("SPECIAL-") ||
			licenseData.mac_address === "MASTER";

		// For regular licenses, validate MAC address by comparing device ID
		if (!isSpecialLicenseData && macAddress) {
			const licenseParts = normalizedLicenseKey.split("-");
			if (licenseParts.length >= 2) {
				const deviceIdFromLicense = licenseParts[1]; // 12-character device ID

				// Normalize the requesting device's MAC address
				const normalizedDeviceMac = macAddress
					.trim()
					.toUpperCase()
					.replace(/[:-]/g, "");

				// Compare device IDs
				if (deviceIdFromLicense.length === 12 && normalizedDeviceMac.length === 12) {
					if (deviceIdFromLicense !== normalizedDeviceMac) {
						return NextResponse.json({
							valid: false,
							error: "License is not valid for this device. The license key does not match this device's ID.",
						});
					}
				}
			}
		}

		// Check if license is expired
		const expiresOn = new Date(licenseData.expires_on);
		const now = new Date();

		if (expiresOn < now) {
			return NextResponse.json({
				valid: false,
				error: "License has expired",
			});
		}

		// License is valid
		return NextResponse.json({
			valid: true,
			licenseData: {
				licenseKey: licenseData.license_key,
				macAddress: isSpecialLicenseData
					? "MASTER"
					: licenseData.mac_address || macAddress || "ANY",
				clientName: licenseData.client_name || "Unknown",
				activatedOn: new Date(licenseData.activated_on).toISOString(),
				expiresOn: expiresOn.toISOString(),
				status: licenseData.status,
			},
		});
	} catch (error: any) {
		console.error("[API /license/validate] Validation error");
		return NextResponse.json(
			{
				valid: false,
				error: error.message || "Failed to validate license",
			},
			{ status: 500 }
		);
	}
}
