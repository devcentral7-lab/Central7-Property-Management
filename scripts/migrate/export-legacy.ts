/**
 * Export all legacy Supabase tables into data/raw/*.json
 * Usage: npm run migrate:export
 * Requires LEGACY_SUPABASE_URL + LEGACY_SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from '@supabase/supabase-js';
import { LEGACY_TABLES } from './constants.js';
import { loadEnvFile } from './load-env.js';
import { dataPath, writeJsonFile } from './utils.js';

loadEnvFile();
loadEnvFile('.env.local');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('REPLACE_ME_')) {
    throw new Error(
      `Missing or placeholder ${name}. Put the real legacy service_role key in .env`,
    );
  }
  return v;
}

function slug(name: string): string {
  return name.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
}

async function fetchAll(
  supabase: { from: (table: string) => any },
  table: string,
): Promise<unknown[]> {
  const pageSize = 1000;
  let from = 0;
  const all: unknown[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main(): Promise<void> {
  const url = requireEnv('LEGACY_SUPABASE_URL');
  const key = requireEnv('LEGACY_SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const table of LEGACY_TABLES) {
    console.log(`Exporting ${table}…`);
    const rows = await fetchAll(supabase, table);
    const out = dataPath('raw', `${slug(table)}.json`);
    writeJsonFile(out, rows);
    console.log(`  → ${rows.length} rows → ${out}`);
  }
  console.log('Export complete. Next: npm run migrate:profile');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
