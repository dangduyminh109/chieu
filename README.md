# Quản Lý Xưởng Chiếu

A Vietnamese, mobile-first workshop application. Phase 1 implements authentication,
multi-role authorization, mat catalog CRUD, effective-dated labor rates, daily work
submission, personal/team work history, admin membership configuration, and audit viewing.
No example financial transactions are shown as live data.

## Requirements

- Node.js 22.13+ (Node 24 recommended), pnpm 10.30.2.
- A Supabase project, or Supabase CLI with Docker for local development.
- HTTPS for production PWA installation. Localhost works for development.

## Run

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
# Fill in .env.local with your own project values.
pnpm dev
```

Open http://localhost:3000. Without configuration, the sign-in screen truthfully
explains that the database is not connected. There is no mock account or auth bypass.

Environment variables:

| Variable                               | Purpose                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project API URL                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key, safe for the browser under RLS                              |
| `NEXT_PUBLIC_APP_URL`                  | Canonical app URL for deployment configuration; also set Auth Site URL to this value |

The server-only `SUPABASE_SECRET_KEY` is required for account provisioning and
username login. Never add it to a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git.

## Set up Supabase

1. Create a project and obtain its URL and publishable key from Project Settings.
2. Apply both SQL files in `supabase/migrations` in filename order, using Supabase
   SQL Editor, or install the official CLI and use:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Run `supabase/seed.sql` in SQL Editor if you want the five production stages,
   expense categories, and two clearly described illustrative mat types. It is
   safe to rerun. It does not insert rates, work records, wages, or revenue.
4. In Authentication settings, disable **Allow new users to sign up**. The local
   `supabase/config.toml` also disables signup. A project operator must enforce
   the equivalent hosted setting; application code alone cannot disable it.
5. Set Auth Site URL and allowed redirect URL to your deployment origin and
   `https://YOUR_HOST/auth/confirm` (localhost equivalent during development).
6. Configure the Invite User email template link as
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
   Configure the password recovery template equivalently with `type=recovery`.
   Invitation/recovery tokens are verified server-side and redirect to the profile
   page, where the user can set a password. Keep default Supabase Auth rate limits
   enabled. Configure production SMTP for reliable invitation delivery.

For a local Supabase instance:

```powershell
supabase start
supabase db reset
# Use the API URL and publishable/anon key printed by your local instance.
```

The CLI and Docker are not dependencies of the web app and were not installed by
this project. `db reset` destroys the LOCAL database; never use it against production.

## Provision the first administrator

Invite your own email from Supabase Authentication > Users. The auth trigger
creates an unprivileged profile. Verify the email and UUID, then run the following
in the trusted Supabase SQL Editor, replacing the UUID with that user's real ID:

```sql
begin;
insert into public.user_roles(user_id, role)
values ('REPLACE_WITH_VERIFIED_USER_UUID'::uuid, 'ADMIN');
commit;
```

Do not bootstrap from user metadata, browser input, or a public HTTP endpoint.
Never commit a password or admin credential. The role insertion is audited.
If the administrator also owns the workshop or does production, assign OWNER
and WORKER separately using trusted SQL for this initial account. Assign its
stage IDs in `worker_skills`. Users cannot change their own privileges in the app.

For other workers, invite them in the trusted Supabase Auth dashboard, then use
**Thành viên** as ADMIN to assign WORKER and their skills. OWNER can manage normal
workshop operations but cannot assign roles. An authorized owner who needs to
invite people should request the admin to provision them in Phase 1; an owner-scoped
invitation endpoint is deferred. The app deliberately holds no Auth Admin key.

## End-to-end workflow

1. Sign in as ADMIN or OWNER. Create or edit a mat in **Loại chiếu**.
2. Add a default rate in **Đơn giá công**, choosing mat, stage, effective date,
   and an integer VND amount. Optional worker-specific rates take precedence.
3. Ensure a worker has WORKER plus the relevant stage skill. OWNER+WORKER is valid.
4. Sign in as that worker. Open **Sản xuất**, select date/stage/mat and quantity.
5. Review calculated wages, then submit. The database reselects and validates
   the rate, stores its snapshot, and appends an audit event in one transaction.
6. See the saved entry in personal history. An owner can select **Cả xưởng**.
7. An ADMIN can review the corresponding event in **Nhật ký hệ thống**.

Submitted records await approval. Phase 1 intentionally has no approval/payment UI.
It does not label submitted work as payable or invent amounts paid/unpaid.
Existing approved records are supported for future migration, and are immutable to
application users. Only submitted records are created by the Phase 1 entry form.

## Verification and production

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
pnpm start
```

Tests include wage/permission/date logic and actual PostgreSQL migration, RLS,
RPC, audit, idempotency, and snapshot tests via PGlite. PGlite is a test dependency,
not an application database. Tests do not contact your Supabase account. Live Auth
email delivery and a deployed Supabase integration require your project setup.

Deploy as a normal Node.js Next.js application or to a compatible Next.js host.
Set the same public environment variables before building and set Supabase Auth
URLs to the HTTPS deployment origin. Do not statically export authenticated routes.
Use the lockfile for reproducible dependency installation.

## PWA

Android Chrome: menu > Install app / Add to home screen. iOS Safari: Share > Add
to Home Screen. The app uses a standalone manifest and replaceable woven-pattern
placeholder PNG icons in `public/icons`. The worker caches only public static
assets and a generic offline page. It never caches authenticated HTML, API/RSC
responses, or financial data. Offline submission and synchronization are not implemented.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Permissions](docs/RBAC.md)
- [Business rules](docs/BUSINESS_RULES.md)
- [Roadmap](docs/ROADMAP.md)
- [Manual acceptance checks](docs/ACCEPTANCE.md)
- [Shared UI, toast, forms and Zustand](docs/UI_COMPONENTS.md)

This is a production-oriented Phase 1 foundation, not a completed payroll,
inventory, sales, or accounting product. Provision a real project and run the
acceptance workflow before entering business data.

## Authentication updates

Password recovery: /forgot-password. Add /auth/callback to Supabase Auth redirect URLs alongside /auth/confirm. Set NEXT_PUBLIC_APP_URL to the actual application origin. Configure Supabase Auth rate limits and production SMTP. Inactive profiles cannot sign in; accounts without roles see a permission-denied screen.

## Managed account provisioning

Admins and owners create worker accounts directly from Members with an initial
password and stage assignments. Apply migration 202611020003_provision_workers.sql
and configure server-only SUPABASE_SECRET_KEY. This supersedes the earlier
dashboard-only invitation limitation. Only ADMIN can subsequently assign privileged
roles. Keep hosted Supabase public signup disabled. Never commit the secret key.

## Backend business modules

Production review/resubmission/locking, allocated wage payments, customer/supplier
and material catalogs, effective retail/wholesale/purchase prices, material
purchases/issues, finished receipts/purchases, sales, operating expenses, document
payments, stock/debt/wage balances and financial summaries are implemented as
Server Actions and protected SQL RPCs. See [Backend API](docs/BACKEND_API.md) for
contracts and examples. The UI has not been extended for these modules. This
supersedes the initial Phase 1-only roadmap descriptions; advanced accounting,
refund/reversal workflows, exports and backup automation remain outside this API.
New backend migrations 006–009 are deployed. Checks have not been run for this
backend expansion at the user's request.
