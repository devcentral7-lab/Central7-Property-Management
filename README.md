# Central7 Property Management (Pulse rebuild)

Node.js + Supabase rebuild of the Central7 Pulse Google Apps Script system.

## What's in this repo so far (Phase 1)

| Path | Purpose |
|------|---------|
| [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) | Optimized typed schema, indexes, `next_property_ref()`, list card view, dashboard RPC |
| [`supabase/migrations/0002_rls.sql`](supabase/migrations/0002_rls.sql) | Row Level Security policies |
| [`docs/schema-mapping.md`](docs/schema-mapping.md) | Legacy column → new column map |
| [`scripts/migrate/`](scripts/migrate/) | Export → profile → clean → load pipeline |
| [`data/raw|clean|rejected/`](data/) | Local migration datasets (gitignored contents) |
| [`.cursor/plans/c7_rebuild_plan.md`](.cursor/plans/c7_rebuild_plan.md) | Full project plan |

## Performance rule

No API may load the entire `properties` table. Login uses a slim bootstrap; lists are paginated SQL.

## Setup

1. Create a **new** Supabase project (do not mutate the live legacy DB).
2. Run migrations in the SQL editor (or CLI): `0001_init.sql` then `0002_rls.sql`.
3. Copy `.env.example` → `.env` and fill keys.
4. `npm install`

## Migrate legacy data

```bash
# 1) Export from old project
npx tsx scripts/migrate/export-legacy.ts

# 2) Profile quality
npm run migrate:profile

# 3) Clean locally
npm run migrate:clean

# 4) Load into NEW project
npm run migrate:load
```

Staff/agent passwords are **not** imported — use Supabase Auth invites / reset after load.

## Next (Phase 5)

Next.js app lives in [`web/`](web/). See [`web/README.md`](web/README.md).

```bash
cd web
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_* from root .env
npm run dev
```

Seed a staff login (from repo root):

```bash
npm run seed:staff -- you@email.com 'TempPass123!' Keerthie Admin
```
