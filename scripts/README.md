# Database Setup Scripts

## Quick Setup for New Database

For a **fresh database setup**, run this single script:

### `00_complete_setup.sql`

This script contains everything you need:
- All tables (user_profiles, products, customers, invoices, employees, stores, etc.)
- Row-Level Security (RLS) policies
- Triggers and functions
- Indexes for performance

**Usage:**
1. Open Supabase SQL Editor
2. Copy and paste the entire content of `00_complete_setup.sql`
3. Run the script
4. Your database is ready!

## Other Scripts

The other numbered scripts (`001_initial_schema.sql`, `002_rls_policies.sql`, etc.) are historical and were used during development. You can ignore them - `00_complete_setup.sql` includes everything.

### Diagnostic Scripts (Optional)

These scripts were used for debugging and can be safely ignored:
- `013_fix_employee_login_rls.sql` - Already included in `00_complete_setup.sql`
- `014_test_employee_login_queries.sql` - For testing only
- `015_verify_stores_rls.sql` - For verification only

## Post-Setup

After running `00_complete_setup.sql`:
1. Create your admin user account through the application signup
2. Create stores through the admin dashboard
3. Add employees to stores
4. Start using the application!

