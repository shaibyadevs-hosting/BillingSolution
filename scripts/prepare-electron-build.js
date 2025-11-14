const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../app/api');
const apiBackupDir = path.join(__dirname, '../.api-backup');

// This script is called before Electron build to backup API routes
// (API routes can't be statically exported)
console.log('Preparing for Electron build: backing up API routes...');

// Backup API directory if it exists
if (fs.existsSync(apiDir)) {
  // Remove old backup if exists
  if (fs.existsSync(apiBackupDir)) {
    fs.rmSync(apiBackupDir, { recursive: true, force: true });
  }
  
  // Move API directory to backup
  fs.renameSync(apiDir, apiBackupDir);
  console.log('✓ API routes backed up to app/api.backup');
} else {
  console.log('⚠ API directory not found, skipping backup');
}

