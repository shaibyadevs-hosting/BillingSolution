const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../app/api');
const apiBackupDir = path.join(__dirname, '../.api-backup');

// Restore API directory if backup exists
if (fs.existsSync(apiBackupDir) && !fs.existsSync(apiDir)) {
  console.log('Restoring API routes from backup...');
  fs.renameSync(apiBackupDir, apiDir);
  console.log('API routes restored');
} else if (fs.existsSync(apiBackupDir)) {
  // If both exist, just remove backup
  fs.rmSync(apiBackupDir, { recursive: true, force: true });
  console.log('API backup removed');
}

