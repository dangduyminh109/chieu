# Architecture

## Application boundary

One Next.js App Router application, one Supabase Postgres/Auth project. No custom
backend service. React Server Components read live data under the authenticated
user's RLS context. Client components are limited to forms, navigation state,
connectivity, and the production chart. TypeScript runs in strict mode.

The UI uses Tailwind 4, locally hosted Manrope (including Vietnamese glyphs),
Lucide icons, Recharts, and source-owned shadcn-compatible Button/Card components.
`components.json` configures shadcn aliases, RSC, styles and CSS variables for later
components. React Hook Form and Zod validate interactive production entry; all
mutations are validated again server-side and by SQL constraints/functions.

## Source map

```text
src/app/                       Routes, protected layout, error/loading states
src/components/layout/         Desktop sidebar, mobile navigation, PWA status
src/components/ui/             Source-owned reusable UI primitives
src/features/auth/             Login and logout actions
src/features/users/            Profile, password and membership actions
src/features/mat-types/        Mat catalog actions
src/features/pricing/          Effective-date rate actions
src/features/production/       Validation, wage logic, form and history
src/features/dashboard/        Actual-data production chart
src/features/shared/           Database queries and safe mutation errors
src/lib/auth/                  Database-backed request session and authorization
src/lib/permissions/           Pure permission rules used by UI and tests
src/lib/supabase/              Server-only cookie client
src/proxy.ts                   Supabase session refresh; no private page caching
src/types/                     Domain types
supabase/migrations/           Authoritative SQL schema and functions
tests/                         Unit tests and PostgreSQL integration tests
```

Feature folders for payroll/materials/sales/inventory/expenses are deliberately not
empty scaffolds. Add them when implementing their roadmap phases.

## Trust and transactions

Each action validates an allowlist of fields and rechecks the database-backed
session/permissions. All tables have RLS. App roles get SELECT only; mutations
use narrowly scoped security-definer RPCs with empty search paths. RPCs repeat
authorization, never trust the client worker ID or monetary totals, and audit via
transactional triggers. A manager cannot grant themselves ADMIN through a form.

The proxy refreshes tokens using Supabase SSR cookies. Protected pages and actions
use `getUser()` as the verified identity, then database roles and active status.
Identity verification never relies on an unverified client session payload.
React's request cache deduplicates session reads within a render; no cross-user
session, query-result, or private HTML cache is configured.

## Scope decisions

- Worker work is submitted, never auto-approved. Approval/payment is Phase 2.
- No localStorage records or fake production screens. Missing configuration is
  explained at login; query errors show an error state rather than fake zeroes.
- Rates are append-only; history pages read saved snapshots.
- No privileged Supabase secret in the application. Invitations are currently an
  administrator operation through the trusted Supabase dashboard.
- No offline writes. The service worker is intentionally small and static-only.
- No inventory changes occur when recording a production stage.
- No financial dashboard totals are inferred from unimplemented sales/payroll.
- The checked-in lockfile pins the verified dependency tree.

## Future operations

Generate Supabase database types from the applied migration as the schema grows.
Add query indexes based on actual data size. Dashboard aggregates run in the
database; work history and audit pages are paginated. Rate reads paginate across
PostgREST pages to avoid selecting an incomplete effective-date history.

Production deployment still needs HTTPS, SMTP/Auth configuration, database backup
policy, and live acceptance verification. No external deployment is required to
develop or test this repository.
