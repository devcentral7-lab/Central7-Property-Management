/**
 * Apply schema SQL via DATABASE_URL.
 * Usage:
 *   npm run migrate:schema
 *   npx tsx scripts/migrate/apply-schema.ts 0003_numeric_room_counts.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadEnvFile } from './load-env.js';

loadEnvFile();
loadEnvFile('.env.local');
loadEnvFile('.env.production');
loadEnvFile('.env.production.local');

function requireDatabaseUrl(): string {
  const v = process.env.DATABASE_URL;
  if (!v || v.startsWith('REPLACE_ME')) {
    throw new Error(
      [
        'Missing DATABASE_URL.',
        'Add DATABASE_URL to .env then re-run npm run migrate:schema',
      ].join('\n'),
    );
  }
  return v;
}

async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl();
  const arg = process.argv[2];
  const files = arg
    ? [path.join(process.cwd(), 'supabase', 'migrations', arg)]
    : [path.join(process.cwd(), 'supabase', 'migrations', 'apply_all.sql')];

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to database…');
  await client.connect();
  try {
    for (const file of files) {
      if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
      let sql = fs.readFileSync(file, 'utf8');
      if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
      console.log(`Applying ${file}…`);
      await client.query(sql);
    }
    console.log('Schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
