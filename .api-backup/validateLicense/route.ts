import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

function maskLicenseKey(key: string) {
  if (!key || key.length < 4) return "***";
  // Keep first 3 and last 3 visible
  const first = key.slice(0, 3);
  const last = key.slice(-3);
  return `${first}***${last}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, macAddress } = body;

    const ua = request.headers.get("user-agent") || "";
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    console.log("[LicenseAPI] Incoming validation request", {
      ts: new Date().toISOString(),
      ip,
      ua,
      macAddress,
      licenseKey: maskLicenseKey(licenseKey),
    });

    if (!licenseKey || !macAddress) {
      return NextResponse.json(
        { valid: false, error: "License key and MAC address are required" },
        { status: 400 }
      );
    }

    // Query Firestore for license
    const licensesRef = collection(db, "licenses");
    const q = query(
      licensesRef,
      where("licenseKey", "==", licenseKey),
      where("macAddress", "==", macAddress),
      where("status", "==", "active")
    );

    const querySnapshot = await getDocs(q);

    console.log("[LicenseAPI] Query result", {
      matches: querySnapshot.size,
      macAddress,
      licenseKey: maskLicenseKey(licenseKey),
    });

    if (querySnapshot.empty) {
      console.warn("[LicenseAPI] No matching active license", {
        macAddress,
        licenseKey: maskLicenseKey(licenseKey),
      });
      return NextResponse.json({
        valid: false,
        error: "License not found or inactive",
      });
    }

    const licenseDoc = querySnapshot.docs[0];
    const licenseData = licenseDoc.data();

    // Check if license is expired
    let expiresOn: Date;
    if (licenseData.expiresOn instanceof Timestamp) {
      expiresOn = licenseData.expiresOn.toDate();
    } else if (licenseData.expiresOn instanceof Date) {
      expiresOn = licenseData.expiresOn;
    } else if (typeof licenseData.expiresOn === "string") {
      expiresOn = new Date(licenseData.expiresOn);
    } else {
      console.error("[LicenseAPI] Invalid expiration date format", {
        macAddress,
        licenseKey: maskLicenseKey(licenseKey),
      });
      return NextResponse.json({
        valid: false,
        error: "Invalid expiration date",
      });
    }

    const now = new Date();
    if (expiresOn < now) {
      console.warn("[LicenseAPI] License expired", {
        macAddress,
        licenseKey: maskLicenseKey(licenseKey),
        expiresOn: expiresOn.toISOString(),
        now: now.toISOString(),
      });
      return NextResponse.json({
        valid: false,
        error: "License has expired",
      });
    }

    // Get activatedOn date
    let activatedOn: string;
    if (licenseData.activatedOn instanceof Timestamp) {
      activatedOn = licenseData.activatedOn.toDate().toISOString();
    } else if (licenseData.activatedOn instanceof Date) {
      activatedOn = licenseData.activatedOn.toISOString();
    } else if (typeof licenseData.activatedOn === "string") {
      activatedOn = licenseData.activatedOn;
    } else {
      activatedOn = new Date().toISOString();
    }

    console.log("[LicenseAPI] License validated OK", {
      macAddress,
      licenseKey: maskLicenseKey(licenseKey),
      status: licenseData.status,
      expiresOn: expiresOn.toISOString(),
    });

    return NextResponse.json({
      valid: true,
      licenseData: {
        licenseKey: licenseData.licenseKey,
        macAddress: licenseData.macAddress,
        clientName: licenseData.clientName || "Unknown",
        activatedOn,
        expiresOn: expiresOn.toISOString(),
        status: licenseData.status,
      },
    });
  } catch (error: any) {
    console.error("[LicenseAPI] Error validating license:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        valid: false,
        error: error.message || "Failed to validate license",
      },
      { status: 500 }
    );
  }
}


