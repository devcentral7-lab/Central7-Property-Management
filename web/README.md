# Central7 Pulse — Web (Next.js)

Next.js App Router rebuild of the Google Apps Script Pulse app.

## Gaps closed vs GAS

- **No full-table download** on login — home loads badge counts only
- **Paginated** property lists (`PAGE_SIZE = 25`)
- **Supabase Auth** sessions (JWT) instead of CacheService tokens + client-supplied names
- **Server-side** contact redaction on public `/search` and `/p/[ref]`
- Typed schema + RLS (staff vs anon)

## Setup

1. Copy env:
   ```bash
   cp .env.example .env.local
   ```
   Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the **new** Supabase project (same values as root `.env`).

2. Apply latest SQL migrations in order (through `0028_dashboard_inventory_breakdowns.sql`).

3. Create staff Auth users in Supabase Auth, then matching `profiles` rows (`id` = auth user uuid, `display_name`, `role`).

4. Run:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## App routes

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/login` | Staff Auth login |
| `/search`, `/p/[ref]` | Public Active listings (no contacts) |
| `/app` | Slim bootstrap home |
| `/app/properties` | Paginated search |
| `/app/properties/new` | Create + Publish workflow |
| `/app/properties/[ref]` | Detail + status actions |
| `/app/my-properties` | Own listings (Admin can impersonate filter) |
| `/app/activity` | Admin activity log |
| `/app/social-queue`, `/app/republish-queue` | Queue boards |
| `/app/agents` | Partner `users` table (Admin) |

## Deferred (next iterations)

- Social platform date marking / Excel queue upload
- Invoice Sheets adapter
- Partner Auth login + signup
- Bulk import
- PDF generation

## Drive property photos (optional)

Photos live in Google Drive (folder per property ref under `PHOTOS_ROOT_FOLDER_ID`). The app works without Drive env vars; when set, property modal and public Active pages show a Photos gallery with upload/rename/delete for owners/Admins.

1. Enable Google Drive API and create a service account JSON key.
2. Share the photos root folder with the service account as Editor.
3. Set in `.env.local` / Vercel:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — full JSON string
   - `PHOTOS_ROOT_FOLDER_ID` — Drive folder id (default root is documented in `.env.example`)
