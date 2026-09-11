/**
 * Create a partner Agent Auth user + public.users row (Approved + Active).
 * Usage:
 *   npx tsx scripts/seed-agent.ts email@example.com 'TempPass123!' 'Company' 'Contact' '0771234567'
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "./migrate/load-env.js";

loadEnvFile();
loadEnvFile(".env.local");

async function main() {
  const [email, password, company, contactPerson, mobile] = process.argv.slice(2);
  if (!email || !password || !company || !contactPerson || !mobile) {
    console.error(
      "Usage: npx tsx scripts/seed-agent.ts <email> <password> <Company> <ContactPerson> <mobileUsername>",
    );
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "Agent", display_name: contactPerson },
  });
  if (error) throw error;

  const { error: uErr } = await supabase.from("users").upsert(
    {
      auth_user_id: data.user.id,
      company_name: company,
      contact_person: contactPerson,
      contact_number: mobile,
      email,
      username: mobile,
      status: "Approved",
      active: true,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "username" },
  );
  if (uErr) throw uErr;

  console.log(`Created Agent ${contactPerson} (${company}) → ${data.user.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
