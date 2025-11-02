-- Diagnostic script for stores table
-- Run this in Supabase SQL Editor to check store issues

-- ============================================
-- 1. CHECK TABLE STRUCTURE FOR 'STORES'
-- ============================================
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'stores'
ORDER BY ordinal_position;

-- ============================================
-- 2. LIST ALL EXISTING STORE IDs AND NAMES
-- ============================================
SELECT 
    id, 
    name, 
    store_code,
    admin_user_id, 
    created_at 
FROM public.stores 
ORDER BY created_at DESC;

-- ============================================
-- 3. COUNT STORES PER USER
-- ============================================
SELECT 
    admin_user_id,
    COUNT(*) as store_count
FROM public.stores
GROUP BY admin_user_id;

-- ============================================
-- 4. CHECK RLS STATUS FOR 'STORES'
-- ============================================
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'stores'
AND schemaname = 'public';

-- ============================================
-- 5. CHECK RLS POLICIES FOR 'STORES'
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'stores'
AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- 6. CHECK FOREIGN KEY CONSTRAINTS ON EMPLOYEES -> STORES
-- ============================================
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'employees'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'store_id';

-- ============================================
-- 7. FIND EMPLOYEES WITH INVALID STORE_IDs
-- ============================================
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.store_id,
    CASE 
        WHEN s.id IS NULL THEN 'STORE NOT FOUND'
        ELSE 'STORE EXISTS'
    END as store_status
FROM public.employees e
LEFT JOIN public.stores s ON e.store_id = s.id
WHERE e.store_id IS NOT NULL
ORDER BY store_status, e.store_id;

-- ============================================
-- 8. LIST ALL UNIQUE STORE_IDS REFERENCED BY EMPLOYEES
-- ============================================
SELECT DISTINCT
    e.store_id,
    CASE 
        WHEN s.id IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    s.name as store_name,
    COUNT(e.id) as employee_count
FROM public.employees e
LEFT JOIN public.stores s ON e.store_id = s.id
WHERE e.store_id IS NOT NULL
GROUP BY e.store_id, s.name, s.id
ORDER BY status, e.store_id;

