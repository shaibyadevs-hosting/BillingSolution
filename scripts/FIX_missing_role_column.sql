-- Quick Fix: Add missing role column to user_profiles table
-- Run this if you're getting "column user_profiles.role does not exist" errors

-- Step 1: Add role column to user_profiles if it doesn't exist
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

-- Step 2: Add check constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_role_check'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_role_check 
        CHECK (role IN ('admin', 'employee', 'public'));
    END IF;
END $$;

-- Step 3: Update existing rows to have 'admin' role if they don't have one
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE role IS NULL;

-- Step 4: Set NOT NULL if column allows NULL (make it required)
ALTER TABLE public.user_profiles 
ALTER COLUMN role SET DEFAULT 'admin';

-- Step 5: Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles' 
AND column_name = 'role';

