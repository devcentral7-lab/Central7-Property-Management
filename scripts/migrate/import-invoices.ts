/**
 * Import "INVOICE Tracker.xlsx" (one sheet per year) into the finance schema.
 * Re-runnable: invoices are matched on invoice number and their payments and
 * agent splits are replaced, so edits made in the app to imported invoices
 * are overwritten.
 *
 * Usage:
 *   npx tsx scripts/migrate/import-invoices.ts --dry
 *   npx tsx scripts/migrate/import-invoices.ts
 *   npx tsx scripts/migrate/import-invoices.ts --force   (even after app edits)
 */
import { createRequire } from 'node:module';
import pg from 'pg';
import { loadEnvFile } from './load-env.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx') as typeof import('xlsx');

loadEnvFile();
loadEnvFile('.env.local');

const FILE = 'INVOICE Tracker.xlsx';
const DRY = process.argv.includes('--dry');
/** Directors: credited on invoices but no targets / quarterly chart. */
const NON_SALES_AGENTS = new Set(['Keerthie', 'Sherden']);

type Category = 'C7 Brokering' | 'C7 Management' | 'Car Park' | 'Other';
type RevenueType = 'Sale' | 'Rental' | 'Management Fee' | 'Car Park' | 'Other';

type Invoice = {
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  sent_date: string | null;
  customer_name: string | null;
  details: string;
  category: Category;
  revenue_type: RevenueType;
  amount: number;
  c7_booking: number | null;
  revenue_month: string | null;
  property_ref: string | null;
  legacy_sheet: string;
  legacy_row: number;
  payment: { paid_on: string | null; amount: number; reference: string | null } | null;
  agents: { name: string; amount: number }[];
  /** Workbook's own "To be Received", for validation only. */
  sheet_outstanding: number;
};

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  return 0;
}

/** Excel serial → YYYY-MM-DD (no timezone shifting). */
function date(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

function categoryFor(raw: string | null, details: string): Category {
  const r = (raw ?? '').toLowerCase();
  if (r === 'car park') return 'Car Park';
  if (r === 'c7 management') return 'C7 Management';
  if (r === 'c7 brokering') return 'C7 Brokering';
  if (/property management|revenue share|booking commission|shangri-la/i.test(details)) {
    return 'C7 Management';
  }
  if (/parking/i.test(details)) return 'Car Park';
  if (r === 'c7') return 'C7 Brokering';
  return 'Other';
}

function revenueTypeFor(category: Category, details: string): RevenueType {
  if (category === 'Car Park') return 'Car Park';
  if (category === 'C7 Management') return 'Management Fee';
  if (category === 'Other') return 'Other';
  if (/\b(sale|sold|selling|purchase|buy)/i.test(details)) return 'Sale';
  if (/\b(rent|rental|lease|leasing)/i.test(details)) return 'Rental';
  return 'Other';
}

function propertyRef(details: string): string | null {
  const m = details.match(/C7\s*-\s*(\d{3,6})/i);
  return m ? `C7-${m[1]}` : null;
}

function splitAgentNames(raw: string): string[] {
  return raw
    .split(/&|,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
}

type Target = { year: number; agent: string; target: number };

function parseSheet(name: string, ws: import('xlsx').WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const header = (rows[0] ?? []).map((h) => text(h));
  const col = (re: RegExp) => header.findIndex((h) => h !== null && re.test(h));

  const iInvNo = col(/^invoice no/i);
  const iInvDate = col(/^inv(oice)? date/i);
  const iDue = col(/^due date/i);
  const iDetails = col(/^details/i);
  const iCustomer = col(/^customer/i);
  const iAmt = col(/^invoice amt/i);
  const iSent = col(/^sent date/i);
  const iPayDate = col(/^payment date/i);
  const iPayAmt = col(/^payment amt/i);
  const iToBe = col(/^to be received/i);
  const iPayRef = col(/^payment ref/i);
  const iFor = col(/^incoice for|^invoice for/i);
  const iRevMonth = col(/^rev month/i);
  const iC7 = col(/^c7 booking/i);
  const iAgent = col(/^agent$/i);
  const agentCols =
    iC7 >= 0
      ? header
          .map((h, i) => [h, i] as const)
          .filter(([h, i]) => i > iC7 && h && h !== 'Receivable')
      : [];

  const invoices: Invoice[] = [];
  const targets: Target[] = [];
  const year = Number(name);

  rows.forEach((r, idx) => {
    let invNo = text(r[iInvNo]);
    // A few billed rows have no invoice number; keep them under a generated one.
    if (!invNo && idx > 0 && text(r[iDetails]) && num(r[iAmt]) > 0 && (date(r[iPayDate]) || date(r[iInvDate]))) {
      invNo = `${name}-R${idx + 1}`;
    }
    if (invNo && (/^C20\d{2}/i.test(invNo) || invNo.startsWith(`${name}-R`))) {
      const details = text(r[iDetails]) ?? '';
      const category = categoryFor(text(r[iFor]), details);
      const amount = num(r[iAmt]);
      const payAmt = num(r[iPayAmt]);
      const agents: { name: string; amount: number }[] = [];
      if (agentCols.length) {
        for (const [agent, i] of agentCols) {
          const a = num(r[i]);
          if (a > 0) agents.push({ name: agent!, amount: a });
        }
      } else if (iAgent >= 0 && text(r[iAgent]) && category !== 'Car Park') {
        const names = splitAgentNames(text(r[iAgent])!);
        const share = Math.round((amount / names.length) * 100) / 100;
        for (const n of names) agents.push({ name: n, amount: share });
      }
      const invoiceDate = date(r[iInvDate]) ?? date(r[iDue]) ?? date(r[iSent]);
      invoices.push({
        invoice_no: invNo,
        invoice_date: invoiceDate ?? `${year}-01-01`,
        due_date: iDue >= 0 ? date(r[iDue]) : null,
        sent_date: date(r[iSent]),
        customer_name: iCustomer >= 0 ? text(r[iCustomer]) : null,
        details,
        category,
        revenue_type: revenueTypeFor(category, details),
        amount,
        c7_booking: iC7 >= 0 && r[iC7] !== null && typeof r[iC7] === 'number' ? num(r[iC7]) : null,
        revenue_month: iRevMonth >= 0 ? date(r[iRevMonth]) : null,
        property_ref: propertyRef(details),
        legacy_sheet: name,
        legacy_row: idx + 1,
        payment:
          payAmt > 0
            ? { paid_on: date(r[iPayDate]), amount: payAmt, reference: text(r[iPayRef]) }
            : null,
        agents,
        sheet_outstanding: num(r[iToBe]),
      });
      return;
    }

    // Summary rows: "Remaing Target" followed by "Achieved %" per agent column.
    if (iC7 >= 0 && /remain|remaing/i.test(String(r[iC7] ?? ''))) {
      const next = rows[idx + 1] ?? [];
      if (!/achieved/i.test(String(next[iC7] ?? ''))) return;
      for (const [agent, i] of agentCols) {
        const remaining = num(r[i]);
        const pct = typeof next[i] === 'number' ? (next[i] as number) : 0;
        if (!remaining && !pct) continue;
        const target = pct < 1 ? remaining / (1 - pct) : remaining;
        targets.push({ year, agent: agent!, target: Math.round(target / 1000) * 1000 });
      }
    }
  });

  return { invoices, targets };
}

async function main() {
  const wb = XLSX.readFile(FILE, { raw: true });
  const invoices: Invoice[] = [];
  const targets: Target[] = [];
  for (const name of wb.SheetNames) {
    if (!/^20\d{2}$/.test(name)) continue;
    const parsed = parseSheet(name, wb.Sheets[name]);
    invoices.push(...parsed.invoices);
    targets.push(...parsed.targets);
  }

  // Validation report
  const dupes = new Map<string, number>();
  for (const inv of invoices) dupes.set(inv.invoice_no, (dupes.get(inv.invoice_no) ?? 0) + 1);
  const dupeList = [...dupes].filter(([, n]) => n > 1);
  const byYear = new Map<string, { n: number; amt: number; paid: number; out: number; sheetOut: number; types: Record<string, number> }>();
  const mismatches: string[] = [];
  for (const inv of invoices) {
    const y = inv.invoice_date.slice(0, 4);
    const s = byYear.get(inv.legacy_sheet) ?? { n: 0, amt: 0, paid: 0, out: 0, sheetOut: 0, types: {} };
    s.n += 1;
    s.amt += inv.amount;
    const paid = inv.payment?.amount ?? 0;
    s.paid += paid;
    s.out += Math.max(inv.amount - paid, 0);
    s.sheetOut += inv.sheet_outstanding;
    s.types[inv.revenue_type] = (s.types[inv.revenue_type] ?? 0) + 1;
    byYear.set(inv.legacy_sheet, s);
    if (Math.abs(inv.amount - paid - inv.sheet_outstanding) > 1) {
      mismatches.push(`${inv.invoice_no} (${y}) amt=${inv.amount} paid=${paid} sheetToBeReceived=${inv.sheet_outstanding}`);
    }
  }
  for (const [sheet, s] of byYear) {
    console.log(
      `${sheet}: ${s.n} invoices, invoiced ${s.amt.toFixed(0)}, received ${s.paid.toFixed(0)}, outstanding ${s.out.toFixed(0)} (sheet says ${s.sheetOut.toFixed(0)})`,
      JSON.stringify(s.types),
    );
  }
  console.log('Targets:', targets.map((t) => `${t.year} ${t.agent} ${t.target}`).join(' | '));
  if (dupeList.length) console.log('Duplicate invoice numbers:', dupeList);
  if (mismatches.length) {
    console.log(`Payment/outstanding mismatches (${mismatches.length}):`);
    for (const m of mismatches.slice(0, 30)) console.log('  ', m);
  }
  const agentNames = [...new Set(invoices.flatMap((i) => i.agents.map((a) => a.name)).concat(targets.map((t) => t.agent)))];
  console.log('Agents:', agentNames.join(', '));
  if (DRY) return;
  if (dupeList.length) throw new Error('Fix duplicate invoice numbers first.');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: edited } = await client.query<{ edited: boolean }>(
      `select exists (select 1 from finance.invoices where created_by is not null or updated_by is not null)
           or exists (select 1 from finance.payments where created_by is not null) as edited`,
    );
    if (edited[0]?.edited && !process.argv.includes('--force')) {
      throw new Error(
        'Finance has invoices or payments entered in the app; re-importing would overwrite them. Re-run with --force to import anyway.',
      );
    }

    await client.query('begin');

    await client.query(
      `insert into finance.agents (name, sales_agent)
       select n, not (n = any($2::text[])) from unnest($1::text[]) as n
       on conflict (name) do nothing`,
      [agentNames, [...NON_SALES_AGENTS]],
    );
    await client.query(
      `update finance.agents a set profile_id = p.id
       from public.profiles p
       where a.profile_id is null
         and lower(split_part(trim(p.display_name), ' ', 1)) = lower(a.name)`,
    );

    const { rows: saved } = await client.query<{ id: string; invoice_no: string }>(
      `insert into finance.invoices (
         invoice_no, invoice_date, due_date, sent_date, customer_name, details, category,
         revenue_type, amount, c7_booking, revenue_month, property_ref, legacy_sheet, legacy_row,
         property_id
       )
       select x.invoice_no, x.invoice_date, x.due_date, x.sent_date, x.customer_name, x.details,
              x.category, x.revenue_type, x.amount, x.c7_booking, x.revenue_month, x.property_ref,
              x.legacy_sheet, x.legacy_row, p.id
       from jsonb_to_recordset($1::jsonb) as x(
         invoice_no text, invoice_date date, due_date date, sent_date date, customer_name text,
         details text, category text, revenue_type text, amount numeric, c7_booking numeric,
         revenue_month date, property_ref text, legacy_sheet text, legacy_row int
       )
       left join public.properties p on p.ref_no = x.property_ref
       on conflict (invoice_no) do update set
         invoice_date = excluded.invoice_date, due_date = excluded.due_date,
         sent_date = excluded.sent_date, customer_name = excluded.customer_name,
         details = excluded.details, category = excluded.category,
         revenue_type = excluded.revenue_type, amount = excluded.amount,
         c7_booking = excluded.c7_booking, revenue_month = excluded.revenue_month,
         property_ref = excluded.property_ref, property_id = excluded.property_id,
         legacy_sheet = excluded.legacy_sheet, legacy_row = excluded.legacy_row
       returning id, invoice_no`,
      [JSON.stringify(invoices.map(({ payment: _p, agents: _a, sheet_outstanding: _s, ...rest }) => rest))],
    );
    const idByNo = new Map(saved.map((r) => [r.invoice_no, r.id]));
    const ids = [...idByNo.values()];

    await client.query('delete from finance.payments where invoice_id = any($1::uuid[])', [ids]);
    await client.query('delete from finance.invoice_agents where invoice_id = any($1::uuid[])', [ids]);

    const payments = invoices
      .filter((i) => i.payment)
      .map((i) => ({ invoice_id: idByNo.get(i.invoice_no), ...i.payment }));
    await client.query(
      `insert into finance.payments (invoice_id, paid_on, amount, reference)
       select invoice_id, paid_on, amount, reference
       from jsonb_to_recordset($1::jsonb) as x(invoice_id uuid, paid_on date, amount numeric, reference text)`,
      [JSON.stringify(payments)],
    );

    const splits = invoices.flatMap((i) =>
      i.agents.map((a) => ({ invoice_id: idByNo.get(i.invoice_no), name: a.name, amount: a.amount })),
    );
    await client.query(
      `insert into finance.invoice_agents (invoice_id, agent_id, amount)
       select x.invoice_id, a.id, sum(x.amount)
       from jsonb_to_recordset($1::jsonb) as x(invoice_id uuid, name text, amount numeric)
       join finance.agents a on a.name = x.name
       group by x.invoice_id, a.id`,
      [JSON.stringify(splits)],
    );

    await client.query(
      `insert into finance.agent_targets (agent_id, year, target)
       select a.id, x.year, x.target
       from jsonb_to_recordset($1::jsonb) as x(year int, agent text, target numeric)
       join finance.agents a on a.name = x.agent
       on conflict (agent_id, year) do update set target = excluded.target`,
      [JSON.stringify(targets)],
    );

    await client.query('commit');
    console.log(`Imported ${saved.length} invoices, ${payments.length} payments, ${splits.length} agent splits, ${targets.length} targets.`);
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
