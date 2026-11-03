# Cloudflare staging

- Worker: `chieu-staging`
- Domain: `https://staging.chieudinhyen.store`
- Database and Auth: existing Supabase project; no data reset on deployment.
- Build: `pnpm build:cloudflare`
- Deploy: `pnpm deploy:staging` after `pnpm exec wrangler login`.

The Worker requires these runtime secrets, configured separately from Git:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only)
- `NEXT_PUBLIC_APP_URL=https://staging.chieudinhyen.store`

Do not upload `SUPABASE_DB_URL` to the Worker. It is used locally for database migrations only.
The Cloudflare build script removes non-public values from OpenNext environment snapshots.

Add `https://staging.chieudinhyen.store/auth/callback` and
`https://staging.chieudinhyen.store/auth/confirm` to Supabase Auth redirect URLs
for password recovery emails. Username/password sign-in does not require an OAuth redirect.

Application routes remain protected by Supabase authentication and role checks.
Only this staging subdomain is configured; the apex domain is reserved for later use.
Builds use Webpack because the current Windows environment cannot run Turbopack's CSS process reliably.

Before a future production launch, back up the database and agree on which data to retain.
Deploying code must never reset the database automatically.
