// ======================================================================
// ANCHOR: supabase.js
// FILE: supabase.js
// ROLE: Optional Supabase client (anon key).
// SEE:  docs/Supabase-Security.md
// ======================================================================
import { createClient } from "@supabase/supabase-js";
// Anon client. With supabase/schema.sql applied it can read nothing until you add a policy.
// Django remains the source of truth for auth and data.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// ! With supabase/schema.sql applied, this client can read NOTHING until you add a policy.
// TODO: use for Storage (report PDFs) or Realtime (live cohort updates) later.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
