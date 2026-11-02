# Supabase and security

- Django connects with the **Session pooler** URI in `DATABASE_URL`.
- Supabase publishes every `public` table through its REST API, guarded only by the **anon key**, which is visible in the browser. So `supabase/schema.sql` enables **Row Level Security** and revokes anon/authenticated access on every table, and auto-locks future tables.
- Django uses the `postgres` role, which bypasses RLS, so the app still works.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses everything: server only, never in the frontend, never in git.

## Test the lock
```sql
set role anon;
select * from core_user;   -- expect: permission denied
reset role;
```
Related: [[Architecture]], [[Troubleshooting]].
