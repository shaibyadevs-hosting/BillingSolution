# Employee Sync Debugging Guide

## Changes Made

I've added comprehensive logging to help diagnose the `[SupabaseSync] Error creating employee: {}` issue.

## What Was Added

### 1. Enhanced Logging in `lib/utils/supabase-sync.ts`

The function now logs:
- ✅ **Start of sync**: Employee data being synced
- ✅ **Authentication**: User authentication status
- ✅ **Employee existence check**: Whether employee already exists
- ✅ **Before insert**: All data being inserted (with password redacted)
- ✅ **Duplicate check**: Results of duplicate employee_id check
- ✅ **Insert attempt**: When the insert is attempted
- ✅ **Comprehensive error logging**: Multiple methods to capture error details:
  - Error as string
  - Error type and constructor
  - All error properties (enumerable and non-enumerable)
  - JSON serialization attempts
  - Raw error object
  - Error as plain object spread

### 2. Diagnostic SQL Script

Created `scripts/007_diagnose_employees_schema.sql` to check:
- Table structure and column types
- Constraints (NOT NULL, UNIQUE, FOREIGN KEY)
- Indexes
- RLS status and policies
- Triggers
- Test data validation

## How to Use

### Step 1: Run the Diagnostic Script

1. Open Supabase Dashboard → SQL Editor
2. Run `scripts/007_diagnose_employees_schema.sql`
3. Review the output to check for schema issues:
   - Are columns nullable correctly?
   - Are RLS policies set up correctly?
   - Are there any constraint violations?

### Step 2: Try Creating an Employee

1. Open your browser's Developer Console (F12)
2. Go to the Console tab
3. Try creating a new employee
4. Look for logs starting with `[SupabaseSync]`

You should now see detailed logs like:
```
[SupabaseSync] Starting employee sync: {...}
[SupabaseSync] Supabase client created, getting user...
[SupabaseSync] User authenticated: {...}
[SupabaseSync] Checking if employee exists with id: ...
[SupabaseSync] Preparing to insert employee: {...}
[SupabaseSync] Attempting insert to Supabase...
```

If there's an error, you'll see:
```
[SupabaseSync] Error creating employee: {
  errorInfo: {
    errorString: "...",
    errorType: "...",
    message: "...",
    details: "...",
    hint: "...",
    code: "...",
    ...
  },
  insertData: {...},
  userInfo: {...},
  timestamp: "..."
}
[SupabaseSync] Raw error object: ...
[SupabaseSync] Error.toString(): ...
[SupabaseSync] Error inspect (all properties): ...
[SupabaseSync] Error as object: ...
```

### Step 3: Check Common Issues

Based on the logs, check for:

1. **Authentication Issues**
   - Is `user` null? Check if user is logged in
   - Is there an `authError`? Check authentication

2. **RLS Policy Issues**
   - Error code `42501` = Permission denied (RLS blocking)
   - Check if RLS policies allow INSERT for the current user

3. **Schema Mismatches**
   - Error mentioning "column does not exist" = Schema mismatch
   - Error mentioning "null value violates not-null constraint" = Missing required field
   - Run `006_fix_employees_schema.sql` to fix schema

4. **Constraint Violations**
   - Error mentioning "duplicate key" = Unique constraint violation
   - Check `store_id + employee_id` uniqueness

5. **Data Type Issues**
   - Error mentioning "invalid input syntax" = Wrong data type
   - Check date formatting (should be YYYY-MM-DD)

## Next Steps

1. **Run the diagnostic script** and share the results
2. **Try creating an employee** and copy ALL console logs starting with `[SupabaseSync]`
3. **Share the error details** from the logs so we can identify the exact issue

## Fix Scripts Available

If the diagnostic reveals schema issues, run in this order:

1. `scripts/006_fix_employees_schema.sql` - Fixes schema conflicts
2. `scripts/005_add_employees_and_roles.sql` - Ensures employees table exists
3. `scripts/004_stores_and_employee_auth.sql` - Adds store_id, employee_id, password columns

## Expected Behavior

### In Excel Mode:
- ✅ Syncs to Supabase first (for remote login)
- ✅ Then saves to local Excel storage
- ✅ If Supabase sync fails, it logs a warning but continues

### In Supabase Mode:
- ✅ Uses API route only (no duplicate sync needed)
- ✅ API route handles all validation and RLS

The detailed logs will help us identify exactly where and why the error is occurring!

