/** @type {import('next').NextConfig} */
const isElectronBuild = process.env.ELECTRON_BUILD === 'true';
const isTauriBuild = process.env.TAURI_BUILD === 'true';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    unoptimized: true,
  },
  // Enable static export for Electron or Tauri
  ...((isElectronBuild || isTauriBuild) && {
    output: 'export',
    trailingSlash: true,
    // Skip API routes during static export (they won't work anyway)
    skipTrailingSlashRedirect: true,
    // Generate static params for dynamic routes
    generateBuildId: async () => {
      return 'static-export'
    },
  }),
}

export default nextConfig
