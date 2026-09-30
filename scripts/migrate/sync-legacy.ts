/**
 * Delta sync: bring the NEW project up to date with the latest legacy export.
 *
 * Listings use a three-way merge: base = the export that was originally loaded
 * (data/raw/<--base>), theirs = the fresh export (data/raw), ours = the live DB.
 * Only fields that legacy changed since the base are written, so work done in
 * the new system (Excel view/parking fixes, map pins, photos, app edits) is kept.
 * Status history and the social media queue are inserted when missing.
 *
 * Usage (run `npm run migrate:export` first):
 *   npx tsx scripts/migrate/sync-legacy.ts                 dry run → data/clean/sync-report.json
 *   npx tsx scripts/migrate/sync-legacy.ts --apply         write to the NEW project
 *   options: --base=_prev_2026-09-09  --skip-history
 *            --replace-collisions   delete new-app listings whose ref legacy also issued
 *                                   (with their events + queue row), then load the legacy one
 *
 * History needs migration 0030 (extra activity_action values) before --apply.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { cleanProperties, loadOriginalTimestamps } from './clean.js';
import { SOCIAL_MEDIA_PLATFORMS } from './constants.js';
import { loadEnvFile } from './load-env.js';
import { coerceTimestamp, dataPath, readJsonFile, s, writeJsonFile } from './utils.js';

loadEnvFile();
loadEnvFile('.env.local');

type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SKIP_HISTORY = args.includes('--skip-history');
const REPLACE_COLLISIONS = args.includes('--replace-collisions');
const BASE = args.find((a) => a.startsWith('--base='))?.slice('--base='.length) ?? '_prev_2026-09-09';

/** Columns the original load did not map; filled from legacy when the DB still has the default. */
const NEWLY_MAPPED = new Set(['do_not_publish', 'internal_comments']);
const NEWLY_MAPPED_ATTRS = new Set(['agent_ref_no']);
const NOT_SYNCED = new Set(['ref_no', 'ref_seq', 'type_attributes', 'city_name', 'city_id', 'floors']);

const ACTIVITY_ACTIONS = new Set([
  'Publish', 'Republish', 'Drop', 'Lost', 'Hold', 'New Ad Published', 'Closed',
  'Data Change', 'Obsolete', 'Duplicate', 'Admin Edit', 'Boost Request', 'Boost Completed',
  'Published on Ikman', 'Published on LPW', 'Published on Facebook', 'Published on Instagram',
  // 0030_legacy_activity_actions.sql
  'Social Media Requested', 'LPW Publish Requested', 'Published on TikTok', 'Data Change Acknowledged',
]);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('REPLACE_ME_')) throw new Error(`Missing or placeholder ${name} (new project keys)`);
  return v;
}

function stable(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Row;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${k}:${stable(o[k])}`).join(',')}}`;
  }
  if (typeof v === 'number') return String(v);
  const n = Number(v);
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(n) ? String(n) : JSON.stringify(v);
}

function same(a: unknown, b: unknown, col = ''): boolean {
  if (col.endsWith('_at')) {
    const ta = a ? Date.parse(String(a)) : NaN;
    const tb = b ? Date.parse(String(b)) : NaN;
    return (Number.isNaN(ta) && Number.isNaN(tb)) || ta === tb;
  }
  return stable(a) === stable(b);
}

function isDefault(v: unknown): boolean {
  return v === null || v === undefined || v === false || v === '';
}

function parsePlatforms(v: unknown): string[] {
  const allowed = SOCIAL_MEDIA_PLATFORMS as readonly string[];
  return [...new Set(s(v).split(',').map((p) => p.trim()).filter((p) => allowed.includes(p)))];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAll(sb: SupabaseClient, table: string, select: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) return all;
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

function rawFile(dir: string | null, name: string): Row[] {
  const file = dir ? dataPath('raw', dir, name) : dataPath('raw', name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return readJsonFile<Row[]>(file);
}

function tally(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function main(): Promise<void> {
  const sb = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — base: data/raw/${BASE}`);

  const originals = loadOriginalTimestamps();
  const base = new Map(
    cleanProperties(rawFile(BASE, 'C7_Pulse_DB_Dev.json'), originals).cleaned.map((r) => [String(r.ref_no), r]),
  );
  const { cleaned: nextRows, rejected } = cleanProperties(rawFile(null, 'C7_Pulse_DB_Dev.json'), originals);

  const [dbProps, dbComplexes, dbProfiles, dbUsers] = await Promise.all([
    fetchAll(sb, 'properties', 'id, ref_no, ref_seq, created_at, created_by, created_by_name, type_attributes, do_not_publish, internal_comments'),
    fetchAll(sb, 'apartment_complexes', 'id, name, location, amenities, added_by, created_at'),
    fetchAll(sb, 'profiles', 'id, display_name, active'),
    fetchAll(sb, 'users', 'id, username, auth_user_id'),
  ]);
  const dbByRef = new Map(dbProps.map((p) => [String(p.ref_no), p]));
  const profileId = new Map(dbProfiles.map((p) => [String(p.display_name), String(p.id)]));

  // ---------------------------------------------------------------- complexes
  const legacyComplexes = rawFile(null, 'Apartment_Complexes.json');
  const cxByName = new Map(dbComplexes.map((c) => [String(c.name), c]));
  const cxInserts: Row[] = [];
  const cxPatches: { id: string; patch: Row }[] = [];
  const legacyCxNames = new Set<string>();
  for (const c of legacyComplexes) {
    const name = s(c['Name']);
    if (!name || legacyCxNames.has(name)) continue;
    legacyCxNames.add(name);
    const location = s(c['Location']) || null;
    const amenities = s(c['Default Amenities']).split(',').map((a) => a.trim()).filter(Boolean);
    const addedBy = s(c['Added By']) || null;
    const existing = cxByName.get(name);
    if (!existing) {
      const createdAt = coerceTimestamp(c['Created At']);
      cxInserts.push({ name, location, amenities, added_by: addedBy, ...(createdAt ? { created_at: createdAt } : {}) });
      continue;
    }
    const patch: Row = {};
    if (!existing.location && location) patch.location = location;
    if (!(existing.amenities as string[] | null)?.length && amenities.length) patch.amenities = amenities;
    if (!existing.added_by && addedBy) patch.added_by = addedBy;
    if (Object.keys(patch).length) cxPatches.push({ id: String(existing.id), patch });
  }
  for (const r of nextRows) {
    const name = s((r.type_attributes as Row)?.apartment_complex_name);
    if (name && !cxByName.has(name) && !legacyCxNames.has(name)) {
      legacyCxNames.add(name);
      cxInserts.push({ name });
    }
  }

  // ---------------------------------------------------------------- listings
  const inserts: Row[] = [];
  const updates: { ref: string; patch: Row }[] = [];
  const collisions: Row[] = [];
  const colCounts = new Map<string, number>();
  const statusMoves = new Map<string, number>();
  let createdAtMismatch = 0;

  for (const next of nextRows) {
    const ref = String(next.ref_no);
    const db = dbByRef.get(ref);
    const baseRow = base.get(ref);
    const { city_name: _cn, city_id: _ci, floors: _fl, ...row } = next;

    if (!db) {
      inserts.push(row);
      continue;
    }
    if (db.created_by && !baseRow) {
      collisions.push({
        ref,
        id: db.id,
        new_app: { by: db.created_by_name, created_at: db.created_at },
        legacy: { by: next.created_by_name, created_at: next.created_at, type: next.property_type, city: next.city },
      });
      if (REPLACE_COLLISIONS) inserts.push(row);
      continue;
    }
    if (!same(db.created_at, next.created_at, 'created_at')) createdAtMismatch++;

    const patch: Row = {};
    for (const col of Object.keys(row)) {
      if (NOT_SYNCED.has(col)) continue;
      const legacyChanged = !baseRow || !same(baseRow[col], row[col], col);
      const fillNew = NEWLY_MAPPED.has(col) && isDefault(db[col]) && !same(db[col], row[col], col);
      if (legacyChanged || fillNew) {
        if (NEWLY_MAPPED.has(col) && same(db[col], row[col], col)) continue;
        patch[col] = row[col];
      }
    }

    const dbAttrs = (db.type_attributes ?? {}) as Row;
    const baseAttrs = ((baseRow?.type_attributes ?? {}) as Row);
    const nextAttrs = (row.type_attributes ?? {}) as Row;
    const attrs: Row = { ...dbAttrs };
    let attrsChanged = false;
    for (const k of new Set([...Object.keys(baseAttrs), ...Object.keys(nextAttrs)])) {
      const legacyChanged = !same(baseAttrs[k], nextAttrs[k]);
      const fillNew = NEWLY_MAPPED_ATTRS.has(k) && isDefault(dbAttrs[k]) && !isDefault(nextAttrs[k]);
      if ((legacyChanged || fillNew) && !same(dbAttrs[k], nextAttrs[k])) {
        if (nextAttrs[k] === undefined) delete attrs[k];
        else attrs[k] = nextAttrs[k];
        attrsChanged = true;
        tally(colCounts, `type_attributes.${k}`);
      }
    }
    if (attrsChanged) patch.type_attributes = attrs;

    if (Object.keys(patch).length) {
      for (const col of Object.keys(patch)) if (col !== 'type_attributes') tally(colCounts, col);
      if ('status' in patch) tally(statusMoves, `${baseRow?.status ?? '?'} -> ${patch.status}`);
      updates.push({ ref, patch });
    }
  }

  // ---------------------------------------------------------------- history
  const legacyEvents = rawFile(null, 'Status_Update.json');
  const legacySmq = rawFile(null, 'Social_Media_Queue.json');
  const eventRows: Row[] = [];
  const unknownActions = new Map<string, number>();
  const smqRows: Row[] = [];
  const smqSkipped: string[] = [];
  let eventDupes = 0;

  if (!SKIP_HISTORY) {
    const replacedIds = new Set(REPLACE_COLLISIONS ? collisions.map((c) => String(c.id)) : []);
    const replacedRefs = new Set(REPLACE_COLLISIONS ? collisions.map((c) => String(c.ref)) : []);
    const dbEvents = (
      await fetchAll(sb, 'property_status_events', 'id, property_id, ref_no, occurred_at, action, actor_name')
    ).filter((e) => !replacedIds.has(String(e.property_id)));
    const eventKey = (ref: unknown, at: unknown, action: unknown, actor: unknown) =>
      `${s(ref)}|${Date.parse(String(at))}|${s(action)}|${s(actor)}`;
    const seen = new Set(dbEvents.map((e) => eventKey(e.ref_no, e.occurred_at, e.action, e.actor_name)));

    for (const e of legacyEvents) {
      const action = s(e['Status']);
      const occurredAt = coerceTimestamp(e['Date & Time']);
      const ref = s(e['Ref No']).toUpperCase();
      if (!ACTIVITY_ACTIONS.has(action)) {
        tally(unknownActions, action || '(blank)');
        continue;
      }
      if (!occurredAt || !ref) {
        tally(unknownActions, '(no date/ref)');
        continue;
      }
      const actor = s(e['User']) || null;
      const key = eventKey(ref, occurredAt, action, actor);
      if (seen.has(key)) {
        eventDupes++;
        continue;
      }
      seen.add(key);
      eventRows.push({
        ref_no: ref,
        occurred_at: occurredAt,
        actor_name: actor,
        actor_id: actor ? profileId.get(actor) ?? null : null,
        action,
        comment: s(e['Comment']) || null,
        requested_platforms: parsePlatforms(e['Requested Platforms']),
        assigned_to: s(e['Assigned To']) || null,
        boost_completed: !!s(e['Boost Completed']),
        legacy_lpw: s(e['LPW']) || null,
      });
    }

    const publishers = new Map<string, { at: number; by: string }[]>();
    for (const e of legacyEvents) {
      const m = /^Published on (\w+)$/.exec(s(e['Status']));
      const at = coerceTimestamp(e['Date & Time']);
      if (!m || !at) continue;
      const key = `${s(e['Ref No']).toUpperCase()}|${m[1]}`;
      const list = publishers.get(key) ?? [];
      list.push({ at: Date.parse(at), by: s(e['User']) });
      publishers.set(key, list);
    }
    const publisherFor = (ref: string, platform: string, at: string): string | null => {
      const t = Date.parse(at);
      let best: { at: number; by: string } | null = null;
      for (const c of publishers.get(`${ref}|${platform}`) ?? []) {
        if (Math.abs(c.at - t) <= 86_400_000 && (!best || Math.abs(c.at - t) < Math.abs(best.at - t))) best = c;
      }
      return best?.by || null;
    };

    const dbSmq = await fetchAll(sb, 'social_media_queue', 'id, ref_no');
    const smqRefs = new Set(dbSmq.map((q) => String(q.ref_no)).filter((r) => !replacedRefs.has(r)));
    for (const q of legacySmq) {
      const ref = s(q['Ref No']).toUpperCase();
      if (!ref) continue;
      if (smqRefs.has(ref)) {
        smqSkipped.push(ref);
        continue;
      }
      smqRefs.add(ref);
      const requested = parsePlatforms(q['Requested Platforms']);
      const approvedAt = coerceTimestamp(q['Approved Date']);
      const completedAt = coerceTimestamp(q['Completed Date']);
      const dates: Row = {};
      for (const p of SOCIAL_MEDIA_PLATFORMS) {
        const at = coerceTimestamp(q[`${p} Date`]);
        if (at) dates[p] = { at, by: publisherFor(ref, p, at) };
      }
      if (completedAt) {
        for (const p of requested) if (!dates[p]) dates[p] = { at: completedAt, by: null };
      }
      smqRows.push({
        ref_no: ref,
        approved_action: s(q['Approved Action']) || null,
        approved_by: s(q['Approved By']) || null,
        approved_at: approvedAt ?? completedAt,
        requested_platforms: requested,
        platform_dates: dates,
        comment: s(q['Comment']) || null,
        completed_at: completedAt,
        ...(approvedAt ? { created_at: approvedAt } : {}),
      });
    }
  }

  // ---------------------------------------------------------------- accounts
  const legacyUsers = rawFile(null, 'User.json');
  const legacyAgents = rawFile(null, 'Agents.json');
  const missingStaff = legacyUsers
    .filter((u) => !profileId.has(s(u['Name'])))
    .map((u) => ({ name: s(u['Name']), role: s(u['Role']), active: s(u['Active']) }));
  const partnerUsernames = new Set(dbUsers.map((u) => String(u.username)));
  const missingPartners = legacyAgents
    .filter((a) => !partnerUsernames.has(s(a['Username'])))
    .map((a) => ({ username: s(a['Username']), company: s(a['Company Name']), status: s(a['Status']) }));

  const maxSeq = Math.max(...nextRows.map((r) => Number(r.ref_seq)), ...dbProps.map((p) => Number(p.ref_seq)));
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    base: BASE,
    legacy_listings: nextRows.length,
    rejected_rows: rejected.length,
    db_listings_before: dbProps.length,
    new_listings: inserts.length,
    new_listing_range: inserts.length
      ? `${inserts[0].ref_no} .. ${inserts[inserts.length - 1].ref_no}`
      : null,
    updated_listings: updates.length,
    updated_columns: Object.fromEntries([...colCounts].sort((a, b) => b[1] - a[1])),
    status_moves: Object.fromEntries([...statusMoves].sort((a, b) => b[1] - a[1])),
    created_at_mismatch_vs_db: createdAtMismatch,
    collisions,
    collisions_action: collisions.length ? (REPLACE_COLLISIONS ? 'replace with legacy' : 'blocked') : null,
    complexes_new: cxInserts.length,
    complexes_filled: cxPatches.length,
    events_new: eventRows.length,
    events_already_present: eventDupes,
    events_skipped_unknown_action: Object.fromEntries(unknownActions),
    events_without_actor_profile: eventRows.filter((e) => e.actor_name && !e.actor_id).length,
    smq_new: smqRows.length,
    smq_pending_after: smqRows.filter((q) => !q.completed_at).length,
    smq_skipped_existing_in_db: smqSkipped,
    missing_staff_accounts: missingStaff,
    missing_partner_accounts: missingPartners,
    next_ref_after_sync: `C7-${maxSeq + 1}`,
  };
  console.log(JSON.stringify(summary, null, 2));

  writeJsonFile(dataPath('clean', 'sync-report.json'), {
    summary,
    updates: updates.map((u) => ({ ref: u.ref, columns: Object.keys(u.patch) })),
    new_refs: inserts.map((r) => r.ref_no),
  });
  console.log('Report → data/clean/sync-report.json');

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write.');
    return;
  }
  if (collisions.length && !REPLACE_COLLISIONS) {
    throw new Error(
      `${collisions.length} ref collision(s) — rerun with --replace-collisions to drop the new-app listing(s).`,
    );
  }

  // ---------------------------------------------------------------- write
  for (const c of REPLACE_COLLISIONS ? collisions : []) {
    const id = String(c.id);
    const steps = [
      sb.from('property_status_events').delete().eq('property_id', id),
      sb.from('social_media_queue').delete().eq('ref_no', String(c.ref)),
      sb.from('properties').delete().eq('id', id),
    ];
    for (const step of steps) {
      const { error } = await step;
      if (error) throw new Error(`replace ${c.ref}: ${error.message}`);
    }
    console.log(`Removed new-app listing ${c.ref} (and its events / queue row)`);
  }
  for (const batch of chunk(cxInserts, 200)) {
    const { error } = await sb.from('apartment_complexes').insert(batch);
    if (error) throw new Error(`complexes insert: ${error.message}`);
  }
  await pool(cxPatches, 8, async ({ id, patch }) => {
    const { error } = await sb.from('apartment_complexes').update(patch).eq('id', id);
    if (error) throw new Error(`complex ${id}: ${error.message}`);
  });
  console.log(`Complexes: +${cxInserts.length}, filled ${cxPatches.length}`);

  const cx = await fetchAll(sb, 'apartment_complexes', 'id, name');
  const cxId = new Map(cx.map((c) => [String(c.name), String(c.id)]));
  const complexIdFor = (attrs: unknown) => {
    const name = s((attrs as Row | undefined)?.apartment_complex_name);
    return name ? cxId.get(name) ?? null : null;
  };

  for (const batch of chunk(inserts, 200)) {
    const payload = batch.map((r) => ({ ...r, apartment_complex_id: complexIdFor(r.type_attributes) }));
    const { error } = await sb.from('properties').insert(payload);
    if (error) throw new Error(`properties insert: ${error.message}`);
  }
  console.log(`Listings inserted: ${inserts.length}`);

  let done = 0;
  await pool(updates, 8, async ({ ref, patch }) => {
    const body: Row = { ...patch };
    if ('type_attributes' in patch) body.apartment_complex_id = complexIdFor(patch.type_attributes);
    const { error } = await sb.from('properties').update(body).eq('ref_no', ref);
    if (error) throw new Error(`update ${ref}: ${error.message}`);
    if (++done % 250 === 0) console.log(`  updated ${done}/${updates.length}`);
  });
  console.log(`Listings updated: ${updates.length}`);

  if (!SKIP_HISTORY) await syncHistory(sb, eventRows, smqRows);

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const snapshot = `_synced_${stamp}`;
  fs.mkdirSync(dataPath('raw', snapshot), { recursive: true });
  for (const f of fs.readdirSync(dataPath('raw')).filter((n) => n.endsWith('.json'))) {
    fs.copyFileSync(dataPath('raw', f), dataPath('raw', snapshot, f));
  }
  console.log(`Sync complete. Use --base=${snapshot} for the next sync.`);
}

async function syncHistory(sb: SupabaseClient, eventRows: Row[], smqRows: Row[]): Promise<void> {
  const props = await fetchAll(sb, 'properties', 'id, ref_no');
  const propId = new Map(props.map((p) => [String(p.ref_no), String(p.id)]));

  for (const batch of chunk(eventRows, 500)) {
    const payload = batch.map((e) => ({ ...e, property_id: propId.get(String(e.ref_no)) ?? null }));
    const { error } = await sb.from('property_status_events').insert(payload);
    if (error) throw new Error(`events insert: ${error.message}`);
  }
  console.log(`Status events inserted: ${eventRows.length}`);

  for (const batch of chunk(smqRows, 500)) {
    const payload = batch.map((q) => ({ ...q, property_id: propId.get(String(q.ref_no)) ?? null }));
    const { error } = await sb.from('social_media_queue').insert(payload);
    if (error) throw new Error(`social queue insert: ${error.message}`);
  }
  console.log(`Social queue rows inserted: ${smqRows.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
