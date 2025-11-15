# Tauri Setup Guide

This project is configured to use **Tauri** for building lightweight desktop applications (5-15 MB instead of 120-200 MB for Electron).

## 🚀 Quick Start

### Development

Run the Tauri app in development mode:

```bash
npm run dev:tauri
```

This will:
1. Start the Next.js dev server on `http://localhost:3000`
2. Launch the Tauri app with hot-reload

### Building the EXE

Build the Windows executable:

```bash
npm run tauri:build:win
```

Or build for all platforms:

```bash
npm run tauri:build
```

**Note**: The build process automatically:
1. Backs up API routes (they can't be in static export)
2. Exports Next.js to `/out` folder
3. Restores API routes
4. Builds the Tauri executable

## 📦 Output

After building, you'll find the executable in:
```
src-tauri/target/release/
```

The EXE file will be approximately **5-15 MB** (much smaller than Electron builds).

## 🔧 How It Works

1. **Next.js Static Export**: The app is built as static files in the `/out` folder
2. **Tauri Wrapper**: Tauri loads the static files from `/out` into a native WebView
3. **Native Binary**: The final EXE uses the system's WebView (no Chromium download needed)

## 📝 Available Scripts

- `npm run dev:tauri` - Run in development mode
- `npm run export` - Export Next.js to static files (`/out` folder)
- `npm run build:tauri` - Build Next.js for Tauri (with API route handling)
- `npm run tauri:build` - Build Tauri app for all platforms
- `npm run tauri:build:win` - Build Tauri app for Windows

## ⚙️ Configuration

### Tauri Config
Located in `src-tauri/tauri.conf.json`:
- **frontendDist**: `../out` - Points to Next.js static export
- **devUrl**: `http://localhost:3000` - Development server URL
- **beforeBuildCommand**: `npm run export` - Runs before building

### Next.js Config
The `next.config.mjs` is configured to:
- Enable static export when `TAURI_BUILD=true`
- Export to `/out` folder
- Handle API routes appropriately

## 🎯 Benefits Over Electron

✅ **Smaller size**: 5-15 MB vs 120-200 MB  
✅ **Faster startup**: Uses system WebView  
✅ **Lower memory usage**: No bundled Chromium  
✅ **Better performance**: Native WebView integration  
✅ **Works with Next.js static export**: Perfect fit!

## 🔍 Troubleshooting

### Build fails with API route errors
- The build script automatically handles this by backing up API routes
- Make sure `scripts/prepare-electron-build.js` ran successfully

### EXE not found after build
- Check `src-tauri/target/release/` folder
- Look for files like `billing-solutions.exe`

### Environment variables not working
- Make sure `.env` file exists in project root
- Variables must start with `NEXT_PUBLIC_` to be included in build
- Rebuild after changing `.env` file

### Rust/Cargo not found
- Install Rust: https://www.rust-lang.org/tools/install
- Tauri requires Rust to build the native wrapper

## 📚 Additional Resources

- [Tauri Documentation](https://tauri.app/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Tauri + Next.js Guide](https://tauri.app/v1/guides/frontend/nextjs)

