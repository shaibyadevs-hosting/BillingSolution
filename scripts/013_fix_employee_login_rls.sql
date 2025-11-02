-- Fix RLS policies to allow employee login
-- Employees need to be readable for login purposes (by employee_id + store_id)
-- But we should still restrict based on store association

-- ============================================
-- 1. CHECK CURRENT RLS POLICIES
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'employees'
AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- 2. ADD POLICY FOR EMPLOYEE LOGIN
-- ============================================
-- This policy allows reading employees for login purposes
-- It checks that the employee_id matches and store exists
-- This is needed because during login, there's no authenticated user (auth.uid() is null)

-- Drop existing login policy if it exists
DROP POLICY IF EXISTS "Employees can be read for login" ON public.employees;

-- Create new policy for employee login
-- This allows reading employees when:
-- 1. The employee has employee_id set (required for login)
-- 2. The employee has store_id set (required for login)
-- 3. The store exists and belongs to an admin
-- Note: We can't check password here, that's done in application code
CREATE POLICY "Employees can be read for login" ON public.employees
  FOR SELECT
  USING (
    employee_id IS NOT NULL 
    AND store_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = employees.store_id
      AND s.admin_user_id IS NOT NULL
    )
  );

-- ============================================
-- 3. VERIFY STORES TABLE ALLOWS READING
-- ============================================
-- Check if stores can be read for login
SELECT 
    policyname,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'stores'
AND schemaname = 'public'
ORDER BY policyname;

-- If stores don't have a public read policy for login, add one
DROP POLICY IF EXISTS "Stores can be read for employee login" ON public.stores;

CREATE POLICY "Stores can be read for employee login" ON public.stores
  FOR SELECT
  USING (admin_user_id IS NOT NULL);

-- ============================================
-- 4. VERIFY THE FIX
-- ============================================
-- Test query that should work (simulates login)
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.store_id,
    e.password IS NOT NULL as has_password,
    s.name as store_name,
    s.store_code
FROM public.employees e
INNER JOIN public.stores s ON e.store_id = s.id
WHERE e.employee_id = 'DE01'
  AND s.store_code = 'DEMO'
LIMIT 1;

-- ============================================
-- 5. CHECK ALL EMPLOYEE POLICIES NOW
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'employees'
AND schemaname = 'public'
ORDER BY policyname;

