/**
 * Fill properties.parking_spaces from Excel "Form Responses 1" column AG
 * (Dedicated Parking Slots), e.g. "1 Slot" → 1.
 *
 * Rules:
 * - Match by Ref No
 * - Only update when DB parking_spaces is null/empty
 * - Only when Excel AG has a parseable value
 * - Does not touch other columns
 *
 * Usage: npx tsx scripts/migrate/update-parking-from-excel.ts
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
const REF_COL = 0; // A
const PARKING_COL = 32; // AG (0-based)

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

/** "1 Slot", "2 Slots", "1.5 Slot" → number; invalid → null */
function parseParkingSlots(raw: unknown): number | null {
  const text = s(raw);
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isEmptyParking(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && !s(v)) return true;
  return false;
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

  let startRow = 0;
  let refIdx = REF_COL;
  let parkingIdx = PARKING_COL;
  if (rows.length > 0) {
    const header = rows[0].map((c) => s(c).toLowerCase());
    const refHeader = header.findIndex((h) => h === 'ref no' || h === 'ref_no');
    const parkingHeader = header.findIndex(
      (h) => h.includes('dedicated parking') || h === 'dedicated parking slots',
    );
    if (refHeader >= 0) refIdx = refHeader;
    if (parkingHeader >= 0) parkingIdx = parkingHeader;
    if (refHeader >= 0 || parkingHeader >= 0 || header.some((h) => h.includes('ref'))) {
      startRow = 1;
    }
    console.log(`Header AG sample: "${rows[0][PARKING_COL]}"`);
  }

  console.log(`Using columns: Ref No index=${refIdx}, Parking index=${parkingIdx} (AG=32)`);

  const fromExcel = new Map<string, number>();
  let skippedEmpty = 0;
  let skippedUnparseable = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const ref = normalizeRef(row[refIdx]);
    if (!ref) continue;
    const raw = row[parkingIdx];
    if (!s(raw)) {
      skippedEmpty += 1;
      continue;
    }
    const n = parseParkingSlots(raw);
    if (n === null) {
      skippedUnparseable += 1;
      continue;
    }
    fromExcel.set(ref, n); // last wins
  }

  console.log(
    `Excel mapped: ${fromExcel.size} refs with parking; empty AG skipped≈${skippedEmpty}; unparseable=${skippedUnparseable}`,
  );

  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // Load ref_no + parking_spaces from DB
  type PropRow = { ref_no: string; parking_spaces: number | string | null };
  const dbRows = new Map<string, PropRow>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('properties')
      .select('ref_no, parking_spaces')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data as PropRow[]) {
      dbRows.set(String(r.ref_no).toUpperCase(), r);
    }
    if (data.length < pageSize) break;
  }
  console.log(`DB properties: ${dbRows.size}`);

  const toUpdate: { ref_no: string; parking_spaces: number }[] = [];
  let missingInDb = 0;
  let alreadyFilled = 0;

  for (const [ref_no, parking_spaces] of fromExcel) {
    const db = dbRows.get(ref_no);
    if (!db) {
      missingInDb += 1;
      continue;
    }
    if (!isEmptyParking(db.parking_spaces)) {
      alreadyFilled += 1;
      continue;
    }
    toUpdate.push({ ref_no, parking_spaces });
  }

  console.log(
    `Will update parking_spaces on ${toUpdate.length} rows; already filled skipped=${alreadyFilled}; missing in DB=${missingInDb}`,
  );

  let updated = 0;
  let failed = 0;
  const failures: { ref_no: string; message: string }[] = [];
  const batchSize = 50;

  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ({ ref_no, parking_spaces }) => {
        const { error } = await supabase
          .from('properties')
          .update({ parking_spaces })
          .eq('ref_no', ref_no)
          .is('parking_spaces', null);
        if (error) {
          failed += 1;
          failures.push({ ref_no, message: error.message });
          return;
        }
        updated += 1;
      }),
    );
    if ((i + batchSize) % 500 < batchSize || i + batchSize >= toUpdate.length) {
      console.log(`Progress: ${Math.min(i + batchSize, toUpdate.length)} / ${toUpdate.length}`);
    }
  }

  console.log(`Done. Updated=${updated}, failed=${failed}`);
  if (failures.length) console.log('Sample failures:', failures.slice(0, 10));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
