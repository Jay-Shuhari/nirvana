-- DevTrace: Supabase security rules.
-- Run AFTER `python manage.py migrate` (Supabase dashboard > SQL Editor > New query > paste > Run).
--
-- Why: Supabase publishes every table in the `public` schema through its REST API,
-- guarded only by the anon key. The anon key is public by design (it ships in the browser),
-- so every table must have Row Level Security ON and no access granted to anon/authenticated.
-- Django connects with the `postgres` role, which bypasses RLS, so the app is unaffected.

-- 1. Lock every existing table (core_*, auth_*, django_*).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2. Lock future tables (new Django migrations) automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
             WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
  END LOOP;
END $$;

DROP EVENT TRIGGER IF EXISTS rls_auto_enable;
CREATE EVENT TRIGGER rls_auto_enable ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.rls_auto_enable();

-- 3. Check: every row should show rls_enabled = true.
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 4. Optional, only if you later let the browser read data directly with the anon key.
--    Example: public read of course names (nothing else). Leave commented out for now.
-- CREATE POLICY "anyone can read course titles" ON public.core_course
--   FOR SELECT TO anon USING (true);
-- GRANT SELECT (id, code, title) ON public.core_course TO anon;
