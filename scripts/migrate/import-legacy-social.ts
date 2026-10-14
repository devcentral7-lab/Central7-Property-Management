/**
 * Import the old system's social media history (Status Update events and the
 * Social Media Queue) for listings in this project, without touching listing data.
 *
 * Skipped: refs not in this project, and listings created in the new app (the
 * old system later issued the same refs to different listings). Queue rows are
 * only added where this project has none. Imported Data Change requests are
 * marked done so they don't show up as new work.
 *
 * Usage (run `npm run migrate:export` first):
 *   npx tsx scripts/migrate/import-legacy-social.ts            dry run (rolled back)
 *   npx tsx scripts/migrate/import-legacy-social.ts --apply
 *   options: --skip-pending   leave out queue items the old system hadn't finished
 *
 * Needs migration 0030 (extra activity_action values).
 */
import pg from 'pg';
import { SOCIAL_MEDIA_PLATFORMS } from './constants.js';
import { loadEnvFile } from './load-env.js';
import { coerceTimestamp, dataPath, readJsonFile, s } from './utils.js';

loadEnvFile();
loadEnvFile('.env.local');

type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SKIP_PENDING = args.includes('--skip-pending');

const ACTIVITY_ACTIONS = new Set([
  'Publish', 'Republish', 'Drop', 'Lost', 'Hold', 'New Ad Published', 'Closed',
  'Data Change', 'Obsolete', 'Duplicate', 'Admin Edit', 'Boost Request', 'Boost Completed',
  'Published on Ikman', 'Published on LPW', 'Published on Facebook', 'Published on Instagram',
  'Social Media Requested', 'LPW Publish Requested', 'Published on TikTok', 'Data Change Acknowledged',
]);

const EVENT_COLUMNS = [
  'property_id', 'ref_no', 'occurred_at', 'actor_id', 'actor_name', 'action', 'comment',
  'requested_platforms', 'assigned_to', 'boost_completed', 'legacy_lpw',
  'resolved_at', 'resolved_by', 'resolution_note',
];
const QUEUE_COLUMNS = [
  'property_id', 'ref_no', 'approved_action', 'approved_by', 'approved_at',
  'requested_platforms', 'platform_dates', 'comment', 'completed_at', 'created_at',
];

function parsePlatforms(v: unknown): string[] {
  const allowed = SOCIAL_MEDIA_PLATFORMS as readonly string[];
  return [...new Set(s(v).split(',').map((p) => p.trim()).filter((p) => allowed.includes(p)))];
}

function tally(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function insertAll(client: pg.Client, table: string, columns: string[], rows: Row[]): Promise<void> {
  const list = columns.join(', ');
  for (let i = 0; i < rows.length; i += 1000) {
    await client.query(
      `insert into public.${table} (${list})
       select ${list} from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`,
      [JSON.stringify(rows.slice(i, i + 1000))],
    );
  }
}

async function main(): Promise<void> {
  const legacyEvents = readJsonFile<Row[]>(dataPath('raw', 'Status_Update.json'));
  const legacySmq = readJsonFile<Row[]>(dataPath('raw', 'Social_Media_Queue.json'));

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');

    const { rows: props } = await client.query(
      `select id, ref_no, status, created_by is not null as app_created from public.properties`,
    );
    const propByRef = new Map(props.map((p) => [p.ref_no as string, p]));
    const { rows: profiles } = await client.query(`select id, display_name from public.profiles`);
    const profileId = new Map(profiles.map((p) => [p.display_name as string, p.id as string]));
    const { rows: dbEvents } = await client.query(
      `select ref_no, occurred_at, action::text as action, actor_name from public.property_status_events`,
    );
    const { rows: dbQueue } = await client.query(`select ref_no from public.social_media_queue`);
    const queuedRefs = new Set(dbQueue.map((q) => q.ref_no as string));

    const skippedRefs = { not_in_project: new Set<string>(), new_app_listing: new Set<string>() };
    const target = (ref: string) => {
      const p = propByRef.get(ref);
      if (!p) skippedRefs.not_in_project.add(ref);
      else if (p.app_created) skippedRefs.new_app_listing.add(ref);
      else return p;
      return null;
    };

    // ------------------------------------------------------------ events
    const eventKey = (ref: unknown, at: unknown, action: unknown, actor: unknown) =>
      `${s(ref)}|${Date.parse(String(at))}|${s(action)}|${s(actor)}`;
    const seen = new Set(dbEvents.map((e) => eventKey(e.ref_no, e.occurred_at, e.action, e.actor_name)));
    const eventRows: Row[] = [];
    const unknownActions = new Map<string, number>();
    const eventActions = new Map<string, number>();
    let eventDupes = 0;
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
      const p = target(ref);
      if (!p) continue;
      const actor = s(e['User']) || null;
      const key = eventKey(ref, occurredAt, action, actor);
      if (seen.has(key)) {
        eventDupes++;
        continue;
      }
      seen.add(key);
      tally(eventActions, action);
      const isDataChange = action === 'Data Change';
      eventRows.push({
        property_id: p.id,
        ref_no: ref,
        occurred_at: occurredAt,
        actor_id: actor ? profileId.get(actor) ?? null : null,
        actor_name: actor,
        action,
        comment: s(e['Comment']) || null,
        requested_platforms: parsePlatforms(e['Requested Platforms']),
        assigned_to: s(e['Assigned To']) || null,
        boost_completed: !!s(e['Boost Completed']),
        legacy_lpw: s(e['LPW']) || null,
        resolved_at: isDataChange ? occurredAt : null,
        resolved_by: isDataChange ? 'Old system' : null,
        resolution_note: isDataChange ? 'Imported from the old system.' : null,
      });
    }

    // ------------------------------------------------------------ queue
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

    const queueRows: Row[] = [];
    let queueExisting = 0;
    let queuePendingSkipped = 0;
    const queueActions = new Map<string, number>();
    for (const q of legacySmq) {
      const ref = s(q['Ref No']).toUpperCase();
      if (!ref) continue;
      const p = target(ref);
      if (!p) continue;
      if (queuedRefs.has(ref)) {
        queueExisting++;
        continue;
      }
      const completedAt = coerceTimestamp(q['Completed Date']);
      if (!completedAt && SKIP_PENDING) {
        queuePendingSkipped++;
        continue;
      }
      queuedRefs.add(ref);
      const requested = parsePlatforms(q['Requested Platforms']);
      const approvedAt = coerceTimestamp(q['Approved Date']);
      const dates: Row = {};
      for (const pl of SOCIAL_MEDIA_PLATFORMS) {
        const at = coerceTimestamp(q[`${pl} Date`]);
        if (at) dates[pl] = { at, by: publisherFor(ref, pl, at) };
      }
      // A finished item must have every requested platform ticked (DB check constraint).
      if (completedAt) {
        for (const pl of requested) if (!dates[pl]) dates[pl] = { at: completedAt, by: null };
      }
      const action = s(q['Approved Action']) || 'Publish';
      tally(queueActions, `${action} · ${completedAt ? 'done' : 'not done'}`);
      queueRows.push({
        property_id: p.id,
        ref_no: ref,
        approved_action: action,
        approved_by: s(q['Approved By']) || null,
        approved_at: approvedAt ?? completedAt,
        requested_platforms: requested,
        platform_dates: dates,
        comment: s(q['Comment']) || null,
        completed_at: completedAt,
        created_at: approvedAt ?? completedAt ?? new Date().toISOString(),
      });
    }

    await insertAll(client, 'property_status_events', EVENT_COLUMNS, eventRows);
    await insertAll(client, 'social_media_queue', QUEUE_COLUMNS, queueRows);

    // ------------------------------------------------------------ result
    const { rows: staff } = await client.query(
      `select id from public.profiles where active and role = 'Admin' limit 1`,
    );
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: staff[0].id, role: 'authenticated' }),
    ]);
    await client.query('set local role authenticated');
    const { rows: states } = await client.query(`
      select p.status::text as status, public.social_state(p) as state, count(*)::int as n
      from public.properties p group by 1, 2 order by 1, 2`);
    const { rows: pendingRows } = await client.query(`
      select public.social_pending(p) as pending, count(*)::int as n
      from public.properties p where public.social_pending(p) is not null group by 1`);
    await client.query('reset role');

    const byState: Record<string, Record<string, number>> = {};
    for (const r of states) (byState[r.state] ??= {})[r.status] = r.n;

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run (rolled back)',
      events_inserted: eventRows.length,
      events_by_action: Object.fromEntries([...eventActions].sort((a, b) => b[1] - a[1])),
      events_already_present: eventDupes,
      events_skipped_unknown_action: Object.fromEntries(unknownActions),
      queue_rows_inserted: queueRows.length,
      queue_by_action: Object.fromEntries([...queueActions].sort((a, b) => b[1] - a[1])),
      queue_skipped_existing_row: queueExisting,
      queue_skipped_not_finished: queuePendingSkipped,
      refs_skipped_not_in_project: skippedRefs.not_in_project.size,
      refs_skipped_new_app_listing: [...skippedRefs.new_app_listing].sort(),
      social_state_after_by_listing_status: byState,
      pending_after: Object.fromEntries(pendingRows.map((r) => [r.pending, r.n])),
    }, null, 2));

    if (APPLY) {
      await client.query('commit');
      console.log('Committed.');
    } else {
      await client.query('rollback');
      console.log('Dry run only — nothing saved. Re-run with --apply to write.');
    }
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
