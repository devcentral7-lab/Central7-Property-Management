/**
 * Profile raw legacy JSON dumps in data/raw/
 * Usage: npm run migrate:profile
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_TABLES, PROPERTY_TYPES, STATUS_LIST } from './constants.js';
import { dataPath, s, writeJsonFile } from './utils.js';

type Row = Record<string, unknown>;

function loadTable(name: string): Row[] {
  const file = dataPath('raw', `${slug(name)}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`Missing: ${file}`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data : [];
}

function slug(name: string): string {
  return name.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
}

function distinct(rows: Row[], key: string, limit = 50): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = s(row[key]);
    if (v) set.add(v);
  }
  return [...set].sort().slice(0, limit);
}

function nullRate(rows: Row[], key: string): number {
  if (!rows.length) return 0;
  let empty = 0;
  for (const row of rows) {
    if (!s(row[key])) empty += 1;
  }
  return Number((empty / rows.length).toFixed(4));
}

function main(): void {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    tables: {} as Record<string, unknown>,
  };

  for (const table of LEGACY_TABLES) {
    const rows = loadTable(table);
    const sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
    (report.tables as Record<string, unknown>)[table] = {
      rowCount: rows.length,
      columnCount: sampleKeys.length,
      columns: sampleKeys,
    };
  }

  const props = loadTable('C7_Pulse_DB_Dev');
  const statusDist = distinct(props, 'Status', 100);
  const typeDist = distinct(props, 'Property Type', 100);
  const unknownStatuses = statusDist.filter(
    (x) => !(STATUS_LIST as readonly string[]).includes(x),
  );
  const unknownTypes = typeDist.filter(
    (x) => !(PROPERTY_TYPES as readonly string[]).includes(x),
  );

  const refNos = props.map((r) => s(r['Ref No'])).filter(Boolean);
  const uniqueRefs = new Set(refNos);

  report.properties = {
    rowCount: props.length,
    uniqueRefNos: uniqueRefs.size,
    duplicateRefNos: refNos.length - uniqueRefs.size,
    statusValues: statusDist,
    unknownStatuses,
    propertyTypeValues: typeDist,
    unknownTypes,
    nullRates: {
      'Name of Contact': nullRate(props, 'Name of Contact'),
      'Contact No 1': nullRate(props, 'Contact No 1'),
      City: nullRate(props, 'City'),
      Status: nullRate(props, 'Status'),
      'Price Total': nullRate(props, 'Price Total'),
    },
  };

  const users = loadTable('User');
  let hashed = 0;
  let plaintextish = 0;
  for (const u of users) {
    const pw = s(u['Password']);
    if (!pw) continue;
    if (pw.includes(':') && pw.length > 40) hashed += 1;
    else plaintextish += 1;
  }
  report.users = {
    rowCount: users.length,
    passwordLooksHashed: hashed,
    passwordLooksPlainOrOther: plaintextish,
    roles: distinct(users, 'Role'),
  };

  const out = dataPath('clean', 'data-quality-report.json');
  writeJsonFile(out, report);
  const md = dataPath('clean', '..', '..', 'docs', 'data-quality-report.md');
  const lines = [
    '# Data quality report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Table counts',
    '',
    ...LEGACY_TABLES.map((t) => {
      const info = (report.tables as Record<string, { rowCount: number }>)[t];
      return `- **${t}**: ${info?.rowCount ?? 0}`;
    }),
    '',
    '## Properties',
    '',
    '```json',
    JSON.stringify(report.properties, null, 2),
    '```',
    '',
    '## Users / passwords',
    '',
    '```json',
    JSON.stringify(report.users, null, 2),
    '```',
    '',
    'Place legacy dumps in `data/raw/*.json` (see `scripts/migrate/export-legacy.ts`) then re-run `npm run migrate:profile`.',
  ];
  fs.mkdirSync(path.dirname(md), { recursive: true });
  fs.writeFileSync(md, lines.join('\n'), 'utf8');
  console.log(`Wrote ${out}`);
  console.log(`Wrote docs/data-quality-report.md`);
}

main();
