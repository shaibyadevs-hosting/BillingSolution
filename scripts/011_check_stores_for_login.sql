-- Script to check what stores exist for employee login
-- Run this to see all stores with their names and codes

-- ============================================
-- LIST ALL STORES WITH DETAILS
-- ============================================
SELECT 
    id,
    name,
    store_code,
    admin_user_id,
    created_at,
    -- Show first 4 characters of name for code comparison
    UPPER(REGEXP_REPLACE(name, '[^A-Z0-9]', '', 'g')) as name_as_code
FROM public.stores
ORDER BY created_at DESC;

-- ============================================
-- CHECK FOR STORES WITH SIMILAR NAMES
-- ============================================
SELECT 
    name,
    store_code,
    COUNT(*) as count
FROM public.stores
GROUP BY name, store_code
HAVING COUNT(*) > 1;

-- ============================================
-- CHECK STORES WITH EMPLOYEES
-- ============================================
SELECT 
    s.id,
    s.name,
    s.store_code,
    COUNT(e.id) as employee_count,
    STRING_AGG(e.employee_id, ', ') as employee_ids
FROM public.stores s
LEFT JOIN public.employees e ON s.id = e.store_id
GROUP BY s.id, s.name, s.store_code
ORDER BY employee_count DESC;

-- ============================================
-- TEST STORE LOOKUP QUERIES
-- ============================================
-- Replace 'My Store' with actual store name to test
-- SELECT * FROM public.stores WHERE name ILIKE '%My Store%';
-- SELECT * FROM public.stores WHERE store_code = 'MYS1';

