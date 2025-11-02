-- Fix role column to ensure it has a default and is properly handled
-- This script ensures role column works correctly with NOT NULL constraint

-- Check current role column status
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
AND column_name = 'role';

-- Ensure role has a default value
-- If role doesn't have a default, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'role'
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE public.employees 
        ALTER COLUMN role SET DEFAULT 'employee';
    END IF;
END $$;

-- Verify the change
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
AND column_name = 'role';

