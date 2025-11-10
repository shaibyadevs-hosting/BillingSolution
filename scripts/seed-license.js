#!/usr/bin/env node

/**
 * License provisioning script for Firebase Firestore.
 *
 * Usage:
 *   node scripts/seed-license.js <licenseKey> <macAddress> <clientName> [expiresInDays]
 *
 * Requirements:
 *   - Install dependencies: npm install --legacy-peer-deps firebase-admin
 *   - Provide Firebase Admin credentials via:
 *       * GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON, or
 *       * Place service-account.json at project root (scripts will attempt to load it)
 */

const fs = require("fs");
const path = require("path");
const { initializeApp, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function loadCredentials() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    return cert(require(envPath));
  }

  const localPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(localPath)) {
    return cert(require(localPath));
  }

  // Try app/firebase/*.json (user may have dropped generated key here)
  try {
    const firebaseDir = path.join(process.cwd(), "app", "firebase");
    if (fs.existsSync(firebaseDir)) {
      const files = fs
        .readdirSync(firebaseDir)
        .filter((f) => f.toLowerCase().endsWith(".json"));
      if (files.length > 0) {
        const candidate = path.join(firebaseDir, files[0]);
        console.log(`[License Seed] Using credentials at ${candidate}`);
        return cert(require(candidate));
      }
    }
  } catch (e) {
    // fall through to applicationDefault
  }

  console.warn(
    "[License Seed] service-account.json not found. Falling back to applicationDefault credentials."
  );
  return applicationDefault();
}

async function main() {
  const [, , licenseKeyArg, macAddressArg, clientNameArg, expiresArg] = process.argv;

  if (!licenseKeyArg || !macAddressArg || !clientNameArg) {
    console.error(
      "Usage: node scripts/seed-license.js <licenseKey> <macAddress> <clientName> [expiresInDays]"
    );
    process.exit(1);
  }

  const licenseKey = licenseKeyArg.trim();
  const macAddress = macAddressArg.trim().toUpperCase();
  const clientName = clientNameArg.trim();
  const expiresInDays = expiresArg ? Number(expiresArg) : 365;

  if (Number.isNaN(expiresInDays) || expiresInDays <= 0) {
    console.error("expiresInDays must be a positive number");
    process.exit(1);
  }

  initializeApp({
    credential: loadCredentials(),
  });

  const firestore = getFirestore();
  const licensesRef = firestore.collection("licenses");

  const existingSnapshot = await licensesRef.where("licenseKey", "==", licenseKey).limit(1).get();

  const licenseData = {
    licenseKey,
    macAddress,
    clientName,
    activatedOn: Timestamp.now(),
    expiresOn: Timestamp.fromDate(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)),
    status: "active",
  };

  if (!existingSnapshot.empty) {
    const docRef = existingSnapshot.docs[0].ref;
    await docRef.update(licenseData);
    console.log(`[License Seed] Updated existing license ${licenseKey}.`);
  } else {
    const docRef = await licensesRef.add(licenseData);
    console.log(`[License Seed] Created new license ${licenseKey} (doc: ${docRef.id}).`);
  }

  console.log("[License Seed] Done.");
}

main().catch((error) => {
  console.error("[License Seed] Failed:", error);
  process.exit(1);
});


