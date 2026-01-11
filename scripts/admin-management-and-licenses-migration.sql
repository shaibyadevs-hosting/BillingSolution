-- ============================================
-- ADMIN MANAGEMENT & LICENSES MIGRATION
-- ============================================
-- Run this script in Supabase SQL Editor
-- Adds: licenses table, admin management fields, removes Firebase dependency

-- ============================================
-- 1. UPDATE USER_PROFILES TABLE (MUST BE FIRST - other parts depend on these columns)
-- ============================================

-- Add admin management fields
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS database_mode TEXT DEFAULT 'indexeddb' CHECK (database_mode IN ('supabase', 'indexeddb')),
  ADD COLUMN IF NOT EXISTS allow_b2b_mode BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'b2c' CHECK (billing_mode IN ('b2b', 'b2c', 'both')),
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login_time TIMESTAMPTZ;

-- Update existing admins to be active by default
UPDATE public.user_profiles 
SET is_active = true 
WHERE is_active IS NULL;

-- Update existing admins to have indexeddb mode by default
UPDATE public.user_profiles 
SET database_mode = 'indexeddb' 
WHERE database_mode IS NULL AND role = 'admin';

-- ============================================
-- 2. LICENSES TABLE (Migrated from Firebase/Firestore)
-- ============================================

CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  mac_address TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT 'Default Client',
  activated_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_on TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_mac_address ON public.licenses(mac_address);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

-- RLS Policies for licenses (admin-only access)
-- Note: Must be created AFTER user_profiles columns are added
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Admins can view all licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can update licenses" ON public.licenses;

CREATE POLICY "Admins can view all licenses"
  ON public.licenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can insert licenses"
  ON public.licenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can update licenses"
  ON public.licenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- ============================================
-- 3. TRIGGER TO UPDATE UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to licenses table
DROP TRIGGER IF EXISTS update_licenses_updated_at ON public.licenses;
CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. FUNCTION TO SET EMPLOYEES INACTIVE WHEN ADMIN IS DEACTIVATED
-- ============================================

CREATE OR REPLACE FUNCTION deactivate_admin_employees()
RETURNS TRIGGER AS $$
BEGIN
  -- When admin is deactivated, also deactivate their employees
  IF NEW.is_active = false AND OLD.is_active = true AND NEW.role = 'admin' THEN
    UPDATE public.user_profiles
    SET is_active = false
    WHERE role = 'employee'
    AND id IN (
      SELECT user_id FROM public.stores
      WHERE admin_user_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deactivate_admin_employees ON public.user_profiles;
CREATE TRIGGER trigger_deactivate_admin_employees
  AFTER UPDATE OF is_active ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_admin_employees();
