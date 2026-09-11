/**
 * Update properties.view from Excel "Form Responses 1" column AH (View), matched by Ref No.
 * Only updates the `view` column. Does not touch other fields.
 *
 * Usage: npx tsx scripts/migrate/update-view-from-excel.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './load-env.js';
import { s } from './utils.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx') as typeof import('xlsx');

loadEnvFile();
loadEnvFile('.env.local');

const SHEET_NAME = 'Form Responses 1';
const REF_COL = 0; // column A
const VIEW_COL = 33; // column AH (0-based)

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('REPLACE_ME_')) throw new Error(`Missing ${name}`);
  return v;
}

function findWorkbook(): string {
  const root = process.cwd();
  const match = fs
    .readdirSync(root)
    .find((f) => f.toLowerCase().endsWith('.xlsx') && f.includes('Opportunity Register'));
  if (!match) throw new Error('Excel file not found in project root');
  return path.join(root, match);
}

function normalizeRef(raw: unknown): string | null {
  const ref = s(raw).toUpperCase();
  if (!/^C7-\d+$/i.test(ref)) return null;
  return ref;
}

async function main(): Promise<void> {
  const filePath = findWorkbook();
  console.log(`Reading: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(
      `Sheet "${SHEET_NAME}" not found. Available: ${workbook.SheetNames.join(', ')}`,
    );
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  // Detect header row and column indexes by name when possible
  let startRow = 0;
  let refIdx = REF_COL;
  let viewIdx = VIEW_COL;
  if (rows.length > 0) {
    const header = rows[0].map((c) => s(c).toLowerCase());
    const refHeader = header.findIndex((h) => h === 'ref no' || h === 'ref_no');
    const viewHeader = header.findIndex((h) => h === 'view');
    if (refHeader >= 0) refIdx = refHeader;
    if (viewHeader >= 0) viewIdx = viewHeader;
    if (refHeader >= 0 || viewHeader >= 0 || header.some((h) => h.includes('ref'))) {
      startRow = 1;
    }
  }

  console.log(`Using columns: Ref No index=${refIdx}, View index=${viewIdx} (AH=33)`);

  const fromExcel = new Map<string, string>();
  let skippedBadRef = 0;
  let skippedEmptyView = 0;
  let duplicateRef = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const ref = normalizeRef(row[refIdx]);
    if (!ref) {
      if (s(row[refIdx])) skippedBadRef += 1;
      continue;
    }
    const view = s(row[viewIdx]);
    if (!view) {
      skippedEmptyView += 1;
      continue;
    }
    if (fromExcel.has(ref)) duplicateRef += 1;
    fromExcel.set(ref, view); // last wins
  }

  console.log(
    `Excel mapped: ${fromExcel.size} refs with View; empty view rows skipped=${skippedEmptyView}; bad refs=${skippedBadRef}; duplicate refs overwritten=${duplicateRef}`,
  );

  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // Load existing ref_nos from DB (paginated)
  const dbRefs = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('properties')
      .select('ref_no')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) dbRefs.add(String(r.ref_no).toUpperCase());
    if (data.length < pageSize) break;
  }
  console.log(`DB properties: ${dbRefs.size}`);

  const toUpdate: { ref_no: string; view: string }[] = [];
  let missingInDb = 0;
  for (const [ref_no, view] of fromExcel) {
    if (!dbRefs.has(ref_no)) {
      missingInDb += 1;
      continue;
    }
    toUpdate.push({ ref_no, view });
  }

  console.log(`Will update view on ${toUpdate.length} rows; excel refs missing in DB=${missingInDb}`);

  let updated = 0;
  let failed = 0;
  const failures: { ref_no: string; message: string }[] = [];

  // Update one-by-one to only touch `view` and avoid upsertting other columns
  const batchSize = 50;
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ({ ref_no, view }) => {
        const { error, count } = await supabase
          .from('properties')
          .update({ view }, { count: 'exact' })
          .eq('ref_no', ref_no);
        if (error) {
          failed += 1;
          failures.push({ ref_no, message: error.message });
          return;
        }
        if ((count ?? 1) >= 0) updated += 1;
      }),
    );
    if ((i + batchSize) % 500 < batchSize) {
      console.log(`Progress: ${Math.min(i + batchSize, toUpdate.length)} / ${toUpdate.length}`);
    }
  }

  console.log(`Done. Updated=${updated}, failed=${failed}`);
  if (failures.length) {
    console.log('Sample failures:', failures.slice(0, 10));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
