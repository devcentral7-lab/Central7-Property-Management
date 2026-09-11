/**
 * Create a staff Auth user + profiles row (service role).
 * Usage:
 *   npx tsx scripts/seed-staff.ts email@example.com 'TempPass123!' Keerthie Admin
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "./migrate/load-env.js";

loadEnvFile();
loadEnvFile(".env.local");

async function main() {
  const [email, password, displayName, role = "User"] = process.argv.slice(2);
  if (!email || !password || !displayName) {
    console.error(
      "Usage: npx tsx scripts/seed-staff.ts <email> <password> <DisplayName> [Admin|User]",
    );
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, role },
  });
  if (error) throw error;

  const { error: pErr } = await supabase.from("profiles").upsert({
    id: data.user.id,
    display_name: displayName,
    role: role === "Admin" ? "Admin" : "User",
    active: true,
  });
  if (pErr) throw pErr;
  console.log(`Created ${displayName} (${role}) → ${data.user.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
