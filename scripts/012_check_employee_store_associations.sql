-- Diagnostic script to check employee-store associations for login
-- Run this to see if employees are properly linked to stores

-- ============================================
-- 1. CHECK EMPLOYEES AND THEIR STORES
-- ============================================
SELECT 
    e.id,
    e.employee_id,
    e.name as employee_name,
    e.store_id,
    e.password IS NOT NULL as has_password,
    s.id as store_id_verified,
    s.name as store_name,
    s.store_code,
    CASE 
        WHEN e.store_id IS NULL THEN 'NO STORE_ID'
        WHEN s.id IS NULL THEN 'STORE NOT FOUND'
        WHEN e.store_id = s.id THEN 'VALID'
        ELSE 'MISMATCH'
    END as association_status
FROM public.employees e
LEFT JOIN public.stores s ON e.store_id = s.id
WHERE e.employee_id IN ('DE01', 'DE02')  -- Check specific employees
ORDER BY e.employee_id;

-- ============================================
-- 2. CHECK ALL EMPLOYEES FOR STORE "DEMO" / "demostore"
-- ============================================
SELECT 
    e.id,
    e.employee_id,
    e.name as employee_name,
    e.store_id,
    s.name as store_name,
    s.store_code,
    CASE 
        WHEN e.store_id = s.id THEN 'LINKED'
        ELSE 'NOT LINKED'
    END as link_status
FROM public.employees e
LEFT JOIN public.stores s ON e.store_id = s.id
WHERE s.store_code = 'DEMO' OR s.name ILIKE '%demostore%'
ORDER BY e.employee_id;

-- ============================================
-- 3. VERIFY EMPLOYEE LOGIN CREDENTIALS FOR "DEMO" STORE
-- ============================================
-- This simulates the login query
SELECT 
    e.*,
    s.name as store_name,
    s.store_code
FROM public.employees e
INNER JOIN public.stores s ON e.store_id = s.id
WHERE s.store_code = 'DEMO'
  AND e.employee_id IN ('DE01', 'DE02')
ORDER BY e.employee_id;

-- ============================================
-- 4. CHECK RLS POLICIES FOR EMPLOYEES TABLE
-- ============================================
-- Verify that employees can be read by anyone (for login purposes)
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
-- 5. TEST IF EMPLOYEES ARE ACCESSIBLE WITHOUT AUTH
-- ============================================
-- This should return employees if RLS allows public access for login
SELECT 
    COUNT(*) as total_employees,
    COUNT(DISTINCT store_id) as stores_with_employees,
    COUNT(CASE WHEN employee_id IS NOT NULL THEN 1 END) as employees_with_id,
    COUNT(CASE WHEN password IS NOT NULL THEN 1 END) as employees_with_password
FROM public.employees;

