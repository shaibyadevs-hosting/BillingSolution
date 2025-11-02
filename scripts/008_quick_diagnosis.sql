-- Quick diagnosis for employee sync issues
-- Run this and share ALL results

-- 1. TABLE STRUCTURE (MOST IMPORTANT)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'employees'
ORDER BY ordinal_position;

-- 2. RLS STATUS
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'employees'
AND schemaname = 'public';

-- 3. RLS POLICIES (CRITICAL FOR INSERT)
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'employees'
AND schemaname = 'public'
ORDER BY policyname;

-- 4. NOT NULL CONSTRAINTS
SELECT
    column_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
AND is_nullable = 'NO'
ORDER BY column_name;

-- 5. UNIQUE CONSTRAINTS
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.employees'::regclass
AND contype = 'u'
ORDER BY conname;

