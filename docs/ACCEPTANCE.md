# Acceptance and verification

Automated verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm format:check`, `pnpm build`. The database suite applies the real migrations
to PostgreSQL and verifies RLS/grants, worker privacy, unauthenticated access,
role escalation rejection, zero wages, multiple mat entries, approved snapshots,
idempotency, rate-change detection, inactive accounts, and audit visibility.

## Live acceptance after connecting Supabase

Use disposable nonproduction accounts and records in a separate Supabase project.

1. Apply migrations/seed; disable signup; provision ADMIN, OWNER+WORKER, two WORKERs.
2. Invite account, verify email link and set password. Sign out and back in.
3. Create a mat; update it; create a temporary unused mat and delete it. Try deleting
   a mat with a saved rate: deletion must fail; deactivation must work.
4. Configure a default wage, a future wage and a worker-specific wage. Verify
   the entry preview for dates before/after each effective date.
5. Give workers stage skills. A worker must not select unassigned stages.
6. Record two mats on the same date. Verify saved entries and unit snapshots.
7. Double-click/retry a submission: one request key produces exactly one row.
8. Configure owner zero wages as ADMIN; OWNER+WORKER can submit a zero-wage entry.
9. Worker A must see only A's history, never B's. Direct unauthorized SQL/RPC
   calls must fail even when navigation is bypassed.
10. OWNER may see team history/catalog/rates; OWNER must not access users/audit.
11. ADMIN sees audit records; no application user can modify audit rows.
12. Disconnect networking: offline banner/fallback appears; submissions disabled.
    A dropped response must not show an invented success state.
13. Verify login, sidebar, production form/history, catalog/rates/profile at
    375px, 768px and 1440px; landscape; keyboard; large text and reduced motion.
14. In HTTPS production, install on Android/iOS and verify standalone mode/icons.
    Inspect service worker storage: private HTML/API responses must be absent.

No real workshop records should be used for destructive acceptance checks.
The local PostgreSQL suite does not verify Supabase Auth email delivery or deployment.
