# Electron Environment Variables

This document describes the environment variables needed for the Electron desktop application.

## Important Note

**Electron does NOT require any special secrets or environment variables.** It uses the same environment variables as your web application. The variables you already have in your `.env` file are sufficient.

## Required Environment Variables

Your existing `.env` file already contains everything needed:

```env
# Supabase Configuration (Already in your .env)
NEXT_PUBLIC_SUPABASE_URL=https://rvtjiswpymvptlzbtydf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**No additional Electron-specific variables are needed!**

### For Development

Your current `.env` file works for both web and Electron development. No changes needed.

### For Production Build

When building the Electron app, it uses your existing `.env` file. The build process automatically:

1. Reads variables from `.env` (or `.env.production` if it exists)
2. Embeds `NEXT_PUBLIC_*` variables into the static build
3. Creates the EXE with these variables baked in

**You don't need to do anything special** - just make sure your `.env` file has the correct values.

If you want to use different values for production, create `.env.production`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rvtjiswpymvptlzbtydf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then run: `npm run dist:win`

## Environment Variable Details

### `NEXT_PUBLIC_SUPABASE_URL`
- **Required**: Yes
- **Description**: Your Supabase project URL
- **Example**: `https://xxxxx.supabase.co`
- **Note**: Must start with `https://`

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Required**: Yes
- **Description**: Supabase anonymous/public key for client-side operations
- **Note**: This is safe to expose in client-side code

### `SUPABASE_SERVICE_ROLE_KEY`
- **Required**: Yes (for server-side operations)
- **Description**: Supabase service role key for admin operations
- **Warning**: Keep this secret! Never commit to version control
- **Note**: Used for server-side API routes (not used in Electron static build)

### `NEXT_PUBLIC_APP_URL`
- **Required**: No
- **Description**: Base URL of your application
- **Default**: `http://localhost:3000`
- **Note**: Used for generating absolute URLs (e.g., email links)

### `ELECTRON_BUILD`
- **Required**: No (automatically set by build script)
- **Description**: Flag to enable static export for Electron
- **Set by**: `npm run build:export` script automatically
- **Value**: `true` during Electron builds
- **You don't need to set this manually**

## How Environment Variables Work in Electron

1. **Build Time**: Environment variables prefixed with `NEXT_PUBLIC_` are embedded into the static export during `npm run build:export`
2. **Runtime**: The Electron app reads these variables from the built JavaScript files
3. **Security**: Only `NEXT_PUBLIC_*` variables are accessible in the client-side code

## Important Notes

⚠️ **Security Warning**:
- `NEXT_PUBLIC_*` variables are exposed in the built application
- Never put sensitive secrets in `NEXT_PUBLIC_*` variables
- `SUPABASE_SERVICE_ROLE_KEY` is only used during development/build, not in the final Electron app

✅ **Best Practices**:
- Use `.env.local` for local development (already in `.gitignore`)
- Use `.env.production` for production builds
- Never commit `.env` files to version control
- Use different Supabase projects for development and production if possible

## Checking Environment Variables

To verify environment variables are loaded correctly:

1. **During Development**:
   ```bash
   npm run dev
   ```
   Check browser console for `process.env.NEXT_PUBLIC_SUPABASE_URL`

2. **In Electron Build**:
   - Open DevTools in Electron (Ctrl+Shift+I)
   - Check console for environment variables
   - Or add a debug page that displays env vars

## Troubleshooting

### Variables not loading in Electron
- Ensure variables are prefixed with `NEXT_PUBLIC_`
- Rebuild the app: `npm run build:export && npm run dist:win`
- Check `.env.production` file exists and has correct values

### Supabase connection fails
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is valid
- Ensure Supabase project is active

### Build fails
- Check all required variables are set
- Verify no syntax errors in `.env` files
- Ensure `.env` files are in project root (not in subdirectories)

