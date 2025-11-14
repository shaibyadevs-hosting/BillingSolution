# Building the Electron EXE File

## Quick Start

To build the Windows EXE installer, simply run:

```bash
npm run dist:win
```

This command will:
1. Backup API routes (they can't be in static export)
2. Build Next.js as static export
3. Restore API routes
4. Package everything into a Windows installer EXE

## Output Location

After building, you'll find the EXE in:
```
dist/Billing Solutions Setup 0.1.0.exe
```

## Prerequisites

1. **Environment Variables**: Make sure your `.env` file has:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://rvtjiswpymvptlzbtydf.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **Dependencies**: Install all dependencies first:
   ```bash
   npm install
   ```

## Build Commands

### Windows EXE
```bash
npm run dist:win
```

### macOS DMG
```bash
npm run dist:mac
```

### Linux AppImage
```bash
npm run dist:linux
```

### All Platforms
```bash
npm run dist
```

## What Gets Built

The build process:
1. **Static Export**: Converts Next.js app to static HTML/JS files
2. **Electron Packaging**: Wraps the static files in Electron
3. **Installer Creation**: Creates an installer (NSIS for Windows)

## Troubleshooting

### Build Fails with API Route Errors
- The build script automatically handles this by backing up API routes
- If you see errors, make sure `scripts/prepare-electron-build.js` ran successfully

### EXE Not Found After Build
- Check the `dist/` folder
- Look for files like `Billing Solutions Setup 0.1.0.exe`

### Environment Variables Not Working
- Make sure `.env` file exists in project root
- Variables must start with `NEXT_PUBLIC_` to be included in build
- Rebuild after changing `.env` file

## Testing the EXE

1. Run the installer: `dist/Billing Solutions Setup 0.1.0.exe`
2. Install the application
3. Launch and verify:
   - App opens correctly
   - Supabase connection works
   - IndexedDB storage works (offline mode)
   - No console errors

## File Size

The EXE will be approximately 100-200 MB because it includes:
- Electron runtime (~50-80 MB)
- Next.js static files (~20-40 MB)
- Node.js dependencies (~30-80 MB)

