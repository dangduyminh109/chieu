# Database

SQL migrations are the source of truth. UUID primary keys use `gen_random_uuid()`.
UTC `timestamptz` stores event instants; work dates and price effective dates use
`date` interpreted in Asia/Ho_Chi_Minh.

| Table              | Responsibility                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| profiles           | Auth UUID, contact details, active flag, explicit zero-wage policy                                      |
| user_roles         | Independent ADMIN/OWNER/WORKER membership, composite primary key                                        |
| production_stages  | Configurable stage catalog, code, label and active flag                                                 |
| worker_skills      | Stage assignment independent from roles                                                                 |
| mat_types          | Unique code, name, dimensions, description and active state                                             |
| labor_rate_history | Mat/stage/default or individual worker/effective-date/rate                                              |
| work_logs          | Personal production, rate reference, historical rate snapshot, generated total, status, idempotency key |
| expense_categories | Catalog only, reserved for operating expenses                                                           |
| app_settings       | Admin-readable settings foundation, no client writes                                                    |
| audit_logs         | Actor, operation, entity, before/after JSON, reason and timestamp                                       |

Relationships preserve transaction history. Foreign keys prevent deleting used
catalog items. A mat can be deactivated instead. Default and individual labor
rates have separate unique effective-date indexes. Lookup indexes support worker
date history, rate selection and recent audit activity.

Money is nonnegative BIGINT VND, never floating-point currency. Unit rates are at
most 1,000,000,000 VND and quantity at most 1,000,000 per entry. Individual totals
are at most 10^15, below JavaScript's safe integer bound. Fractional material
quantities must use NUMERIC in future migrations. Avoid summing beyond the JS
safe-integer limit when later adding financial reports; use bigint/decimal serialization.

## Write API

- `save_mat` and `delete_mat`: ADMIN/OWNER, constrained catalog changes.
- `add_labor_rate`: ADMIN/OWNER; append a new effective-date entry.
- `submit_work`: WORKER; own identity, assigned active stage, active mat, valid
  date/quantity, database-resolved rate, checked preview rate, immutable snapshot.
- `update_my_profile`: own name and phone only.
- `configure_member`: ADMIN-only role/skill/status/policy update with reason,
  cannot edit own privileges. Never reads roles from auth user metadata.
- `production_summary`: security-invoker read aggregate, personal by default;
  company-wide requests require manager privileges and still use RLS.

`submit_work` serializes concurrent submissions per worker using a transaction
advisory lock. A unique `(worker_id,idempotency_key)` guards retries. Identical
retries return the original ID; a reused key with different business fields fails.
Changing rates between preview and submission yields RATE_CHANGED, not a silent
financial change. The database computes total from quantity × stored unit rate.

## Auditing and immutability

AFTER triggers append changes to profiles, roles, skills, mats, labor rates, and
work logs in the same transaction. No app role may update/delete/insert audit
rows directly. Even ADMIN has SELECT only, and OWNER cannot read them. Contact
email/phone are excluded from profile audit payloads; auth tables/tokens/passwords
are never included. Trusted SQL operators retain administrative power and are
outside the application-user threat model. SQL maintenance changes to covered
business tables still trigger audit events; the actor can be NULL for an operator.

No application UPDATE/DELETE privilege exists for work logs or rates. Future
approval/correction functions must preserve approved snapshots and append reasons,
not grant broad UPDATE permission. Admin application-level corrections are Phase 2.

## Future schema contracts

Add mat selling/purchasing price history separately from labor rates. Implement
wage payments and per-work allocations transactionally; enforce same worker and
prevent over-allocation. Materials require purchases/items, per-bundle weights,
optional lon counts, and signed inventory movements in NUMERIC units. Finished
goods require explicit completion receipts or external purchases and signed stock
movements. Sales require snapshotted line prices, idempotent transaction posting,
row/advisory locks against negative stock, and separate payment history. Do not
use work logs as finished goods receipts. Audit all future critical write paths.

Run migration/RLS tests with `pnpm test`. They create a minimal Auth schema and
authenticated/anon roles in real embedded PostgreSQL; hosted Auth itself is not mocked
into the production app and needs a separate live integration check.
