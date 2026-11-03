# Roadmap

Manual cost update: owners can enter per-type unit costs, sales snapshot those
costs, and `/profit` reports revenue, COGS and margin with missing-cost warnings.
This is the owner-selected reference-cost method, not automated material-cost
allocation. See MANUAL_COST_PROFIT.md.

Current UI update (2026-11-03): manager purchase/sale history and balances,
partial/deferred payments and debt settlements, customer/supplier management,
and raw-material stock/purchase/issue/history pages are now implemented.
See TRADING_MATERIALS_UI.md. New UI/backend changes have not been tested at the
user's request. Excel export and PWA installation work are deferred by the user.
The older phase descriptions below are historical and do not describe current
UI completion.

Backend update: production review/payroll and core Phase 3 business operations are
implemented in migrations 006–009 and feature Server Actions. Their UI remains
unimplemented. See BACKEND_API.md for the current contract. The phase lists below
retain the original delivery plan; do not interpret them as the current backend
implementation status. Advanced accounting, reversals/refunds, exports and backup
automation remain future work.

## Phase 1 implemented

Next.js/React/TypeScript/pnpm foundation, Tailwind/shadcn-compatible primitives,
cookie-based Supabase Auth, independent roles and skills, protected routes/actions,
RLS/read grants, scoped transactional RPCs, seed catalogs, profile/password pages,
mat catalog CRUD, append-only effective labor rates, worker-specific rate support,
owner zero-wage policy, real production submission, personal/team date-filtered
paginated history, actual database dashboard aggregates, production-stage chart,
admin membership management, append-only audit with admin view, responsive sidebar
and bottom navigation, static-only PWA, offline status, validation/error/loading/
empty/denied states, unit and PostgreSQL boundary tests.

Invitations are performed by a trusted administrator in Supabase's dashboard.
The application itself has no Auth Admin secret. Live hosted Supabase setup,
email delivery, device installation, and deployment require project configuration.

## Phase 2

- Submitted/rejected/draft editing and explicit approve/reject/lock transitions.
- Controlled audited corrections, reasons, original references and period locking.
- Wage statements, payments and transactional per-entry payment allocations.
- Amount paid/unpaid, overpayment prevention, and concurrency tests.
- Authorized owner worker invitation/provisioning with scoped permissions.
- Further production-stage rules and work-date review controls.

## Phase 3

- Suppliers, customers, raw material purchases and nonuniform bundle weights.
- Optional lon information, NUMERIC physical units and movement-based material stock.
- Explicit finished goods receipts and separate external finished mat purchases.
- Atomic wholesale/retail sales, snapshotted sale prices, stock checks and payments.
- Operating expenses and cash flow with no duplicate material expense recognition.
- Expanded price overrides with authorization, reason and audit evidence.

## Phase 4

- Date-range financial reports with clear cash/accrual/estimate distinctions.
- Material consumption and inventory valuation before claiming exact COGS/profit.
- Excel export, backup/restore operations and restore drills.
- Further PWA behavior; design conflict/idempotency rules before offline writes.
- Advanced audit search, retention and production monitoring.
