-- Fix employees table schema to match application requirements
-- This script ensures all columns are properly defined with correct nullability

-- ============================================
-- 1. ENSURE EMPLOYEES TABLE EXISTS WITH CORRECT STRUCTURE
-- ============================================
-- Create employees table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  salary DECIMAL(12, 2),
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ADD MISSING COLUMNS IF THEY DON'T EXIST
-- ============================================
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- ============================================
-- 3. ENSURE COLUMNS ARE NULLABLE (REMOVE NOT NULL IF EXISTS)
-- ============================================
-- Make salary nullable if it has NOT NULL constraint
DO $$ 
BEGIN
    -- Check if salary has NOT NULL constraint and remove it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employees' 
        AND column_name = 'salary' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.employees ALTER COLUMN salary DROP NOT NULL;
    END IF;

    -- Check if joining_date has NOT NULL constraint and remove it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employees' 
        AND column_name = 'joining_date' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.employees ALTER COLUMN joining_date DROP NOT NULL;
    END IF;

    -- Ensure email is nullable (it might have been set as NOT NULL in 005_add_employees_and_roles.sql)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employees' 
        AND column_name = 'email' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.employees ALTER COLUMN email DROP NOT NULL;
    END IF;
END $$;

-- ============================================
-- 4. CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_store_id ON public.employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);

-- Unique constraint: employee_id must be unique within a store
-- Drop existing constraint if it exists to avoid conflicts
DROP INDEX IF EXISTS idx_employees_store_employee_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_store_employee_id 
  ON public.employees(store_id, employee_id) 
  WHERE employee_id IS NOT NULL AND store_id IS NOT NULL;

-- ============================================
-- 5. ENABLE RLS
-- ============================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES
-- ============================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.employees;

-- Create policies
CREATE POLICY "Users can view own employees" ON public.employees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employees" ON public.employees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employees" ON public.employees
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own employees" ON public.employees
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. UPDATED_AT TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS set_updated_at_employees ON public.employees;
CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 8. VERIFY SCHEMA
-- ============================================
-- Display the final schema
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'employees'
ORDER BY ordinal_position;

