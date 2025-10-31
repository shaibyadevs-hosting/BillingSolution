-- Migration: Add stores, employee authentication, and invoice tracking
-- Run this after the initial schema migration

-- ============================================
-- 1. STORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  store_code TEXT NOT NULL UNIQUE, -- 4-character unique code
  address TEXT,
  gstin TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_admin_user_id ON public.stores(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_stores_store_code ON public.stores(store_code);

-- ============================================
-- 2. UPDATE EMPLOYEES TABLE
-- ============================================
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS password TEXT; -- Should be hashed in production
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_store_id ON public.employees(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_store_employee_id ON public.employees(store_id, employee_id) WHERE employee_id IS NOT NULL;

-- ============================================
-- 3. UPDATE INVOICES TABLE
-- ============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by_employee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON public.invoices(store_id);

-- ============================================
-- 4. CUSTOMER AUTH TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_auth (
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  magic_link_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_email ON public.customer_auth(email);
CREATE INDEX IF NOT EXISTS idx_customer_auth_token ON public.customer_auth(magic_link_token);

-- ============================================
-- 5. INVOICE SEQUENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id TEXT PRIMARY KEY, -- Format: store_id-date (e.g., "uuid-20240115")
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, -- YYYYMMDD format
  sequence INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_sequences_store_id ON public.invoice_sequences(store_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_store_date ON public.invoice_sequences(store_id, date);

-- ============================================
-- 6. RLS POLICIES
-- ============================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Stores: Admins can manage their own stores
DROP POLICY IF EXISTS "Admins can manage own stores" ON public.stores;
CREATE POLICY "Admins can manage own stores" ON public.stores
  FOR ALL
  USING (admin_user_id = auth.uid());

-- Customer auth: Public read for token lookup (handled by API)
DROP POLICY IF EXISTS "Public can read customer auth tokens" ON public.customer_auth;
CREATE POLICY "Public can read customer auth tokens" ON public.customer_auth
  FOR SELECT
  USING (true);

-- Invoice sequences: Store admins can manage
DROP POLICY IF EXISTS "Store admins can manage invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Store admins can manage invoice sequences" ON public.invoice_sequences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores 
      WHERE stores.id = invoice_sequences.store_id 
      AND stores.admin_user_id = auth.uid()
    )
  );

-- ============================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS set_updated_at_stores ON public.stores;
CREATE TRIGGER set_updated_at_stores
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_customer_auth ON public.customer_auth;
CREATE TRIGGER set_updated_at_customer_auth
  BEFORE UPDATE ON public.customer_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

