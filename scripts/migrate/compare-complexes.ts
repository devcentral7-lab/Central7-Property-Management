/**
 * Read-only report: legacy "Apartment Complexes" vs NEW apartment_complexes, plus
 * how listings in each system point at complexes.
 * Usage: npx tsx scripts/migrate/compare-complexes.ts  → data/clean/complex-report.json
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanLegacyComplex, complexNameResolver } from './complexes.js';
import { loadEnvFile } from './load-env.js';
import { dataPath, s, writeJsonFile } from './utils.js';

loadEnvFile();
loadEnvFile('.env.local');

type Row = Record<string, unknown>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('REPLACE_ME_')) throw new Error(`Missing or placeholder ${name}`);
  return v;
}

async function fetchAll(sb: SupabaseClient, table: string, select: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) return all;
  }
}

/** Case/spacing/punctuation-insensitive key for spotting near-duplicates. */
function norm(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function amenityList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((a) => s(a)).filter(Boolean);
  return s(v).split(',').map((a) => a.trim()).filter(Boolean);
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

async function main(): Promise<void> {
  const legacy = createClient(requireEnv('LEGACY_SUPABASE_URL'), requireEnv('LEGACY_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const next = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const [lcRaw, lpRaw, ncRows, npRows] = await Promise.all([
    fetchAll(legacy, 'Apartment Complexes', '*'),
    fetchAll(legacy, 'C7_Pulse_DB_Dev', '"Ref No","Apartment Complex"'),
    fetchAll(next, 'apartment_complexes', '*'),
    fetchAll(next, 'properties', 'ref_no, apartment_complex_id, type_attributes'),
  ]);

  // ------------------------------------------------------------- legacy table
  const legacyRows = lcRaw.map((r) => {
    const c = cleanLegacyComplex(r);
    return {
      ...c,
      raw_name: r['Name'] == null ? null : String(r['Name']),
      built_on: c.built_year === null ? s(r['Built on']) || null : String(c.built_year),
    };
  });
  const resolve = complexNameResolver(legacyRows.map((r) => r.name));
  const blankNames = legacyRows.filter((r) => !r.name);
  const untrimmed = legacyRows.filter((r) => r.name && r.raw_name !== r.name).map((r) => JSON.stringify(r.raw_name));
  const named = legacyRows.filter((r) => r.name);
  const legacyExactDupes = [...group(named, (r) => r.name)].filter(([, v]) => v.length > 1);
  const legacyByName = new Map(named.map((r) => [r.name, r]));

  // ---------------------------------------------------------------- new table
  const newRows = ncRows.map((r) => ({
    id: String(r.id),
    name: s(r.name),
    location: s(r.location) || null,
    amenities: amenityList(r.amenities),
    added_by: s(r.added_by) || null,
    created_at: r.created_at ? String(r.created_at) : null,
    developer: s(r.developer) || null,
    apartments_per_floor: r.apartments_per_floor ?? null,
    notes: s(r.notes) || null,
    address: s(r.address) || null,
    built_year: r.built_year ?? null,
  }));
  const newByName = new Map(newRows.map((r) => [r.name, r]));

  // ---------------------------------------------------------------- matching
  const onlyLegacy = [...legacyByName.values()].filter((r) => !newByName.has(r.name));
  const onlyNew = newRows.filter((r) => !legacyByName.has(r.name));
  const newByNorm = group(newRows, (r) => norm(r.name));
  const legacyByNorm = group([...legacyByName.values()], (r) => norm(r.name));

  const nearMatches = onlyLegacy
    .map((l) => ({ legacy: l.name, new: (newByNorm.get(norm(l.name)) ?? []).map((n) => n.name) }))
    .filter((m) => m.new.length);
  const legacyNearDupes = [...legacyByNorm].filter(([, v]) => v.length > 1).map(([, v]) => v.map((r) => r.name));
  const newNearDupes = [...newByNorm].filter(([, v]) => v.length > 1).map(([, v]) => v.map((r) => r.name));

  const fieldDiffs: Row[] = [];
  const diffCounts: Record<string, number> = {};
  for (const l of legacyByName.values()) {
    const n = newByName.get(l.name);
    if (!n) continue;
    const diffs: Row = {};
    if (l.location !== n.location) diffs.location = { legacy: l.location, new: n.location };
    const la = [...l.amenities].sort();
    const na = [...n.amenities].sort();
    if (la.join('|') !== na.join('|')) {
      diffs.amenities = {
        only_legacy: la.filter((a) => !na.includes(a)),
        only_new: na.filter((a) => !la.includes(a)),
      };
    }
    if (l.added_by !== n.added_by) diffs.added_by = { legacy: l.added_by, new: n.added_by };
    if (l.address !== n.address) diffs.address = { legacy: l.address, new: n.address };
    if (l.built_year !== n.built_year) diffs.built_year = { legacy: l.built_year, new: n.built_year };
    if (l.created_at && n.created_at && Date.parse(l.created_at) !== Date.parse(n.created_at)) {
      diffs.created_at = { legacy: l.created_at, new: n.created_at };
    }
    if (Object.keys(diffs).length) {
      fieldDiffs.push({ name: l.name, ...diffs });
      for (const k of Object.keys(diffs)) diffCounts[k] = (diffCounts[k] ?? 0) + 1;
    }
  }

  // ---------------------------------------------------------------- listings
  const legacyListingNames = group(
    lpRaw.filter((p) => s(p['Apartment Complex'])),
    (p) => s(p['Apartment Complex']),
  );
  const listingNamesMissingInLegacyTable = [...legacyListingNames]
    .filter(([name]) => !legacyByName.has(name))
    .map(([name, rows]) => {
      const resolved = resolve(name);
      return { name, resolved_to: resolved, listings: rows.length, in_new_table: resolved === null || newByName.has(resolved) };
    })
    .sort((a, b) => b.listings - a.listings);

  const newById = new Map(newRows.map((r) => [r.id, r]));
  const unlinked: Row[] = [];
  const linkedToOther: Row[] = [];
  const linkCount = new Map<string, number>();
  for (const p of npRows) {
    const attrName = resolve((p.type_attributes as Row | null)?.apartment_complex_name) ?? '';
    const linked = p.apartment_complex_id ? newById.get(String(p.apartment_complex_id)) : undefined;
    if (linked) linkCount.set(linked.id, (linkCount.get(linked.id) ?? 0) + 1);
    if (attrName && !linked) unlinked.push({ ref: p.ref_no, name: attrName });
    else if (attrName && linked && linked.name !== attrName) {
      linkedToOther.push({ ref: p.ref_no, name_on_listing: attrName, linked_complex: linked.name });
    }
  }
  const unusedNew = newRows.filter((r) => !linkCount.has(r.id)).map((r) => r.name);

  const legacyOnlyColumns = {
    address: legacyRows.filter((r) => r.address).map((r) => ({ name: r.name, address: r.address })),
    built_on: legacyRows.filter((r) => r.built_on).map((r) => ({ name: r.name, built_on: r.built_on })),
  };
  const newOnlyColumnsFilled = {
    developer: newRows.filter((r) => r.developer).length,
    apartments_per_floor: newRows.filter((r) => r.apartments_per_floor != null).length,
    notes: newRows.filter((r) => r.notes).length,
  };

  const report = {
    generated_at: new Date().toISOString(),
    counts: {
      legacy_rows: lcRaw.length,
      legacy_unique_names: legacyByName.size,
      new_rows: newRows.length,
      matched_by_exact_name: legacyByName.size - onlyLegacy.length,
      only_in_legacy: onlyLegacy.length,
      only_in_new: onlyNew.length,
      matched_with_field_differences: fieldDiffs.length,
      field_difference_counts: diffCounts,
    },
    legacy_data_quality: {
      blank_names: blankNames.length,
      names_with_extra_spaces: untrimmed,
      exact_duplicate_names: legacyExactDupes.map(([name, v]) => ({ name, rows: v.length })),
      near_duplicate_names: legacyNearDupes,
    },
    only_in_legacy: onlyLegacy.map((r) => ({ name: r.name, location: r.location, added_by: r.added_by })),
    only_in_new: onlyNew.map((r) => ({
      name: r.name,
      location: r.location,
      added_by: r.added_by,
      listings_linked: linkCount.get(r.id) ?? 0,
    })),
    near_name_matches: nearMatches,
    new_near_duplicate_names: newNearDupes,
    field_differences: fieldDiffs,
    legacy_columns_not_in_new_schema: {
      address_filled: legacyOnlyColumns.address.length,
      built_on_filled: legacyOnlyColumns.built_on.length,
      rows: legacyOnlyColumns,
    },
    new_columns_filled: newOnlyColumnsFilled,
    listings: {
      legacy_listing_complex_names_not_in_legacy_table: listingNamesMissingInLegacyTable,
      new_listings_with_complex_name_but_no_link: unlinked.length,
      new_listings_unlinked_sample: unlinked.slice(0, 50),
      new_listings_linked_to_different_name: linkedToOther,
      new_complexes_with_no_listings: unusedNew.length,
    },
  };

  writeJsonFile(dataPath('clean', 'complex-report.json'), report);
  console.log(JSON.stringify(report.counts, null, 2));
  console.log(
    JSON.stringify(
      {
        legacy_data_quality: {
          blank_names: blankNames.length,
          names_with_extra_spaces: untrimmed.length,
          exact_duplicates: legacyExactDupes.length,
          near_duplicates: legacyNearDupes.length,
        },
        near_name_matches: nearMatches.length,
        new_near_duplicates: newNearDupes.length,
        address_filled: legacyOnlyColumns.address.length,
        built_on_filled: legacyOnlyColumns.built_on.length,
        new_columns_filled: newOnlyColumnsFilled,
        listing_names_not_in_legacy_table: listingNamesMissingInLegacyTable.length,
        listing_names_with_no_complex_in_new: listingNamesMissingInLegacyTable.filter((n) => !n.in_new_table).length,
        new_listings_unlinked: unlinked.length,
        new_listings_linked_to_different_name: linkedToOther.length,
        new_complexes_with_no_listings: unusedNew.length,
      },
      null,
      2,
    ),
  );
  console.log('Full report → data/clean/complex-report.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
