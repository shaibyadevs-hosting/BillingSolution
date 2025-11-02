-- Diagnostic script to check employees table schema, constraints, and RLS policies
-- Run this in Supabase SQL Editor to diagnose issues

-- ============================================
-- 1. CHECK TABLE STRUCTURE
-- ============================================
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

-- ============================================
-- 2. CHECK CONSTRAINTS
-- ============================================
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'employees'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- ============================================
-- 3. CHECK INDEXES
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employees'
  AND schemaname = 'public'
ORDER BY indexname;

-- ============================================
-- 4. CHECK RLS STATUS
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'employees'
  AND schemaname = 'public';

-- ============================================
-- 5. CHECK RLS POLICIES
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'employees'
  AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- 6. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
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
  AND tc.table_schema = 'public';

-- ============================================
-- 7. CHECK UNIQUE CONSTRAINTS
-- ============================================
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.employees'::regclass
  AND contype IN ('u', 'x') -- unique and exclusion constraints
ORDER BY conname;

-- ============================================
-- 8. TEST DATA VALIDATION
-- ============================================
-- Check for any NOT NULL violations in existing data
SELECT 
    COUNT(*) as total_employees,
    COUNT(name) as has_name,
    COUNT(email) as has_email,
    COUNT(role) as has_role,
    COUNT(user_id) as has_user_id
FROM public.employees;

-- ============================================
-- 9. CHECK AUTH.USERS TABLE ACCESS
-- ============================================
-- Verify that auth.users exists and is accessible
SELECT 
    COUNT(*) as user_count
FROM auth.users;

-- ============================================
-- 10. TEST INSERT PERMISSIONS (Manual Test Required)
-- ============================================
-- Run this as a test to see if RLS is working:
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID from auth.users
/*
SELECT 
    auth.uid() as current_user_id,
    EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid()) as user_exists;
*/

-- ============================================
-- 11. CHECK TRIGGERS
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'employees'
  AND event_object_schema = 'public'
ORDER BY trigger_name;

