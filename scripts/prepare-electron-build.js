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
  
  // Copy API directory to backup (more reliable than rename on Windows)
  try {
    const copyRecursiveSync = (src, dest) => {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();
      if (isDirectory) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
          copyRecursiveSync(
            path.join(src, childItemName),
            path.join(dest, childItemName)
          );
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    
    copyRecursiveSync(apiDir, apiBackupDir);
    // Remove original after successful copy
    fs.rmSync(apiDir, { recursive: true, force: true });
    console.log('✓ API routes backed up to .api-backup');
  } catch (error) {
    console.error('Error backing up API routes:', error.message);
    // If copy fails, try rename as fallback
    try {
      fs.renameSync(apiDir, apiBackupDir);
      console.log('✓ API routes backed up (using rename)');
    } catch (renameError) {
      console.error('Failed to backup API routes:', renameError.message);
      process.exit(1);
    }
  }
} else {
  console.log('⚠ API directory not found, skipping backup');
}

