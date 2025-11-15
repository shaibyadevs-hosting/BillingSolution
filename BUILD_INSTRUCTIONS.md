# Building Tauri EXE - Required Setup

## ⚠️ Important: You need Visual Studio Build Tools

To build the Tauri executable on Windows, you need **Visual Studio Build Tools** with C++ support.

### Option 1: Install Visual Studio Build Tools (Recommended)

1. Download Visual Studio Build Tools from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Run the installer
3. Select "Desktop development with C++" workload
4. Click Install
5. After installation, restart your terminal/VS Code
6. Run: `npm run tauri:build:win`

### Option 2: Use Pre-built Static Files

If you just need the static Next.js files (without the EXE wrapper):

```bash
npm run build:tauri
```

The static files will be in the `/out` folder, which you can deploy to any static hosting.

### Option 3: Use Electron Instead

If you already have Electron working, you can continue using it:

```bash
npm run dist:win
```

## Current Status

✅ Next.js static export is working  
✅ Tauri configuration is complete  
❌ Rust compilation requires Visual Studio Build Tools

Once Visual Studio Build Tools is installed, the EXE will be generated in:
`src-tauri/target/release/billing-solutions.exe`

