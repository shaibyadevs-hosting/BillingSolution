# Install Visual Studio Build Tools - Step by Step

## Quick Install Guide

The Tauri build requires Visual Studio Build Tools. Follow these steps:

### Method 1: Direct Download (Recommended)

1. **Download the installer:**
   - Go to: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Click "Build Tools for Visual Studio 2022"
   - This will download `vs_buildtools.exe`

2. **Run the installer:**
   - Double-click `vs_buildtools.exe`
   - When prompted, select **"Desktop development with C++"**
   - Make sure these components are checked:
     - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
     - ✅ Windows 10/11 SDK (latest version)
     - ✅ C++ CMake tools for Windows
   - Click **Install**

3. **Wait for installation** (this may take 10-20 minutes)

4. **Restart your terminal/VS Code** after installation completes

5. **Build the EXE:**
   ```bash
   npm run tauri:build:win
   ```

### Method 2: Command Line Install (If you have admin rights)

Open PowerShell **as Administrator** and run:

```powershell
# Download installer
Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_buildtools.exe" -OutFile "$env:TEMP\vs_buildtools.exe"

# Install with C++ tools
& "$env:TEMP\vs_buildtools.exe" --quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
```

Then restart your terminal and run:
```bash
npm run tauri:build:win
```

## Verify Installation

After installation, verify it works:

```bash
where.exe link.exe
```

You should see a path like: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\bin\Hostx64\x64\link.exe`

## Alternative: Use Electron Instead

If you don't want to install Build Tools, you can use Electron (which is already set up):

```bash
npm run dist:win
```

This will create an EXE in the `dist/` folder (though it will be larger, ~120-200 MB vs 5-15 MB for Tauri).

## Troubleshooting

- **"link.exe not found"**: Build Tools not installed or terminal not restarted
- **Installation fails**: Make sure you have admin rights and enough disk space (5+ GB)
- **Still getting errors**: Restart your computer after installation

