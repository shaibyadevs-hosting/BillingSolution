#!/usr/bin/env node

/**
 * Debug script to check if a license exists in Supabase
 * Usage: node scripts/debug-license.js LICENSE-18AB4B6EA35C-D7CBB131
 */

const { createClient } = require('@supabase/supabase-js');

const licenseKey = process.argv[2];

if (!licenseKey) {
  console.error('Usage: node scripts/debug-license.js <license-key>');
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLicense() {
  const normalizedKey = licenseKey.trim().toUpperCase();
  
  console.log('\n=== License Debug Tool ===\n');
  console.log('Searching for license:', normalizedKey);
  console.log('Original input:', licenseKey);
  console.log('');

  // Try exact match (case-sensitive)
  console.log('1. Trying exact match (case-sensitive)...');
  const { data: exactMatch, error: exactError } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', normalizedKey);

  if (exactError) {
    console.error('Error:', exactError);
  } else if (exactMatch && exactMatch.length > 0) {
    console.log('✅ Found with exact match!');
    console.log('License data:', JSON.stringify(exactMatch[0], null, 2));
    return;
  } else {
    console.log('❌ Not found with exact match');
  }

  // Try case-insensitive
  console.log('\n2. Trying case-insensitive search...');
  const { data: caseInsensitive, error: caseError } = await supabase
    .from('licenses')
    .select('*')
    .ilike('license_key', normalizedKey);

  if (caseError) {
    console.error('Error:', caseError);
  } else if (caseInsensitive && caseInsensitive.length > 0) {
    console.log('✅ Found with case-insensitive search!');
    console.log('License data:', JSON.stringify(caseInsensitive[0], null, 2));
    return;
  } else {
    console.log('❌ Not found with case-insensitive search');
  }

  // Try partial match for debugging
  console.log('\n3. Searching for similar licenses (first 10 chars)...');
  const prefix = normalizedKey.substring(0, 10);
  const { data: similar, error: similarError } = await supabase
    .from('licenses')
    .select('license_key, status, mac_address, expires_on')
    .ilike('license_key', `%${prefix}%`)
    .limit(10);

  if (similarError) {
    console.error('Error:', similarError);
  } else if (similar && similar.length > 0) {
    console.log(`Found ${similar.length} similar license(s):`);
    similar.forEach((lic, idx) => {
      console.log(`  ${idx + 1}. ${lic.license_key} (status: ${lic.status})`);
    });
  } else {
    console.log('❌ No similar licenses found');
  }

  // List all licenses (for debugging)
  console.log('\n4. Listing all licenses in database (first 20)...');
  const { data: allLicenses, error: allError } = await supabase
    .from('licenses')
    .select('license_key, status, mac_address, expires_on')
    .limit(20)
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('Error:', allError);
  } else if (allLicenses && allLicenses.length > 0) {
    console.log(`Found ${allLicenses.length} license(s) in database:`);
    allLicenses.forEach((lic, idx) => {
      console.log(`  ${idx + 1}. ${lic.license_key} (status: ${lic.status}, mac: ${lic.mac_address})`);
    });
  } else {
    console.log('❌ No licenses found in database');
  }

  console.log('\n=== Debug Complete ===\n');
}

debugLicense().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
