/**
 * Load cleaned JSON into the NEW Supabase project (service role).
 * Usage: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY then npm run migrate:load
 *
 * Does NOT create auth users — run invites separately after profiles strategy.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { loadEnvFile } from './load-env.js';
import { dataPath, readJsonFile, s } from './utils.js';

loadEnvFile();
loadEnvFile('.env.local');

type Row = Record<string, unknown>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('REPLACE_ME_')) {
    throw new Error(`Missing or placeholder ${name} (new project keys)`);
  }
  return v;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const complexesPath = dataPath('clean', 'apartment_complexes.json');
  const propsPath = dataPath('clean', 'properties.json');

  if (!fs.existsSync(propsPath)) {
    throw new Error('Run npm run migrate:clean first (missing data/clean/properties.json)');
  }

  const complexes = fs.existsSync(complexesPath)
    ? readJsonFile<Row[]>(complexesPath)
    : [];
  const properties = readJsonFile<Row[]>(propsPath);

  console.log(`Upserting ${complexes.length} apartment complexes…`);
  for (const batch of chunk(complexes, 500)) {
    const { error } = await supabase
      .from('apartment_complexes')
      .upsert(batch, { onConflict: 'name' });
    if (error) throw error;
  }

  const { data: complexRows, error: cxErr } = await supabase
    .from('apartment_complexes')
    .select('id, name');
  if (cxErr) throw cxErr;

  const complexId = new Map(
    (complexRows ?? []).map((c) => [c.name as string, c.id as string]),
  );

  const payload = properties.map((p) => {
    const attrs = (p.type_attributes ?? {}) as Row;
    const complexName = s(attrs.apartment_complex_name);
    // Support older cleaned files that still use city_name
    const city = s(p.city) || s(p.city_name) || null;
    const { city_name: _cn, city_id: _ci, floors: _fl, ...rest } = p;
    return {
      ...rest,
      city,
      apartment_complex_id: complexName ? complexId.get(complexName) ?? null : null,
    };
  });

  console.log(`Upserting ${payload.length} properties…`);
  for (const batch of chunk(payload, 200)) {
    const { error } = await supabase.from('properties').upsert(batch, { onConflict: 'ref_no' });
    if (error) throw error;
  }

  console.log('Load complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
