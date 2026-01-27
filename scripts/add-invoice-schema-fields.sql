-- Migration: Add invoice schema fields for Performa Invoice format
-- Adds: bank details to stores, invoice_type to invoices, proprietor to stores

-- ============================================
-- 1. ADD BANK DETAILS AND PROPRIETOR TO STORES
-- ============================================
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS proprietor TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT;

COMMENT ON COLUMN public.stores.proprietor IS 'Proprietor name for the store';
COMMENT ON COLUMN public.stores.bank_name IS 'Bank name for payment details';
COMMENT ON COLUMN public.stores.account_name IS 'Account holder name';
COMMENT ON COLUMN public.stores.account_number IS 'Bank account number';
COMMENT ON COLUMN public.stores.ifsc_code IS 'IFSC code for bank transfers';

-- ============================================
-- 2. ADD INVOICE_TYPE TO INVOICES
-- ============================================
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'Invoice';

COMMENT ON COLUMN public.invoices.invoice_type IS 'Type of invoice (e.g., "Invoice", "Performa Invoice")';
