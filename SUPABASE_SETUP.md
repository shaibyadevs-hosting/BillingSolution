# Supabase Database Setup Guide

This guide explains which SQL scripts to run in the Supabase SQL editor and in what order.

## 📋 Required Scripts (Run in Order)

Run these scripts **in sequence** in the Supabase SQL Editor:

### 1. **001_initial_schema.sql** ✅ RUN FIRST
**Purpose**: Creates the base database schema
- Creates tables: `user_profiles`, `products`, `customers`, `invoices`, `invoice_items`, `sync_log`, `business_settings`
- Creates the `handle_updated_at()` function
- Sets up `updated_at` triggers for all tables

**Location**: `scripts/001_initial_schema.sql`

---

### 2. **002_rls_policies.sql** ✅ RUN SECOND
**Purpose**: Enables Row-Level Security (RLS) and creates access policies
- Enables RLS on all tables
- Creates policies so users can only access their own data
- Security policies for: user_profiles, products, customers, invoices, invoice_items, sync_log, business_settings

**Location**: `scripts/002_rls_policies.sql`

**Note**: Must run after `001_initial_schema.sql` (tables must exist first)

---

### 3. **003_user_profile_trigger.sql** ✅ RUN THIRD
**Purpose**: Auto-creates user profiles when users sign up
- Creates `handle_new_user()` function
- Creates trigger that automatically creates a user profile and business settings when a new user signs up
- Sets default role to 'admin' for new users

**Location**: `scripts/003_user_profile_trigger.sql`

**Note**: Must run after `001_initial_schema.sql` (user_profiles table must exist)

---

### 4. **005_add_employees_and_roles.sql** ✅ RUN FOURTH
**Purpose**: Creates employees table and adds role column to user_profiles
- Creates `employees` table with all necessary fields
- Adds `role` column to `user_profiles` table (if not exists)
- Adds `employee_id` foreign key to `invoices` table
- Enables RLS on employees table
- Creates RLS policies for employees
- Sets up `updated_at` trigger for employees

**Location**: `scripts/005_add_employees_and_roles.sql`

**Note**: Must run after `001_initial_schema.sql` (base tables must exist)

---

### 5. **004_stores_and_employee_auth.sql** ✅ RUN FIFTH
**Purpose**: Adds stores, employee authentication, and invoice sequences
- Creates `stores` table
- Updates `employees` table with: `employee_id`, `password`, `store_id`
- Updates `invoices` table with: `store_id`, `employee_id`, `created_by_employee_id`
- Creates `customer_auth` table for magic link authentication
- Creates `invoice_sequences` table for invoice number generation
- Enables RLS and creates policies for new tables

**Location**: `scripts/004_stores_and_employee_auth.sql`

**Note**: Must run after `005_add_employees_and_roles.sql` (employees table must exist first)

---

## ⚠️ Script NOT to Run

### **004_add_employees_table.sql** ❌ SKIP THIS
**Reason**: This script is **redundant**. `005_add_employees_and_roles.sql` is more complete and includes everything from this script plus additional features.

---

## 📝 Execution Steps

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Run each script **one by one** in the order listed above
4. After each script, verify it ran successfully (check for errors)
5. If you see errors like "table already exists", that's okay - the scripts use `IF NOT EXISTS` clauses

## ✅ Verification

After running all scripts, verify these tables exist:

- ✅ `user_profiles`
- ✅ `products`
- ✅ `customers`
- ✅ `invoices`
- ✅ `invoice_items`
- ✅ `employees`
- ✅ `stores`
- ✅ `customer_auth`
- ✅ `invoice_sequences`
- ✅ `business_settings`
- ✅ `sync_log`

You can verify by running:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

## 🔧 Troubleshooting

### Error: "relation already exists"
- This means the table already exists. The scripts use `IF NOT EXISTS`, so this is safe to ignore.

### Error: "function already exists"
- The `handle_updated_at()` function or `handle_new_user()` function already exists. This is safe to ignore.

### Error: "policy already exists"
- Use `DROP POLICY IF EXISTS` before creating policies. If you see this error, you may need to manually drop the policy first, or the script should handle it automatically.

## 🎯 Summary

**Run these 5 scripts in order:**
1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_user_profile_trigger.sql`
4. `005_add_employees_and_roles.sql`
5. `004_stores_and_employee_auth.sql`

**Skip:**
- `004_add_employees_table.sql` (redundant)

---

**Last Updated**: Based on current codebase structure










