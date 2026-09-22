import { createClient } from "@supabase/supabase-js";

/** Server-only Supabase client with service role (bypasses RLS). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("REPLACE_ME")) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in web/.env.local (needed for user registration).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
