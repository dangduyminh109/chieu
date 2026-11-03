# Backend integration

Core operations are Server Actions, backed by protected PostgreSQL RPCs. No
separate REST service is needed. Import actions into the Next.js client/server
flow and pass typed objects. Never pass an authenticated actor ID: it is resolved
from the verified session. The service key is used only for Auth provisioning and
username resolution; normal business operations use the user's cookie client.

## Production and wages

| Function         | Module                    | Inputs / behavior                                                            |
| ---------------- | ------------------------- | ---------------------------------------------------------------------------- |
| submitWork       | production/actions        | Existing work-date, stage, mat, quantity, expected rate and UUID retry key   |
| reviewWork       | production/review-actions | id, current version, APPROVE/REJECT/LOCK, reason                             |
| resubmitWork     | production/review-actions | id, current version and updated work fields; only own DRAFT/REJECTED         |
| payWages         | payroll/actions           | worker_id, payment_date, amount, method, notes, idempotency_key, allocations |
| getWageStatement | payroll/data              | worker ID and work-date range; approved/allocated/unpaid as VND strings      |
| getWagePayments  | payroll/history           | worker ID, payment-date range, page                                          |

Only ADMIN/OWNER review, lock or pay. They may approve their own production when
also WORKER, consistent with a family workshop's manager authority. LOCKED means
previously approved. Rejection requires at least five characters. Updates use an
optimistic version: stale approval/edit requests fail instead of overwriting a
new decision. Approved monetary fields cannot change, even through a future RPC.

Wage payments allocate their entire amount to approved records of the same worker.
No unallocated advances or overpayments are supported. Each allocation is positive,
and total allocations equal payment amount. Payments cannot predate allocated work.
Per-worker and per-record locks prevent concurrent overpayment. Submitted work
does not count as wages owed. Zero-wage work cannot receive a positive allocation.

## Catalog and workers

`catalog/actions`: saveContact (CUSTOMER/SUPPLIER), saveMaterial, addMatPrice,
saveStage, saveExpenseCategory. Every save accepts an optional `id`; omit it to
create. Catalog codes remain internal identifiers. Use active=false to deactivate
supported catalogs. Changing a material's unit/type after transactions is rejected.

`users/worker-actions`: manageWorker accepts user_id, username, active, skills and
reason. OWNER may maintain ordinary workers, not ADMIN/OWNER accounts. ADMIN can
maintain other workers. Neither may change themselves through this endpoint. Role
assignments remain in the separate ADMIN-only configureMember operation. Skill
reconciliation replaces only assignment rows, never financial/work records.

`catalog/data`: getBusinessCatalog(kind,page,pageSize), with manager authorization.
Existing mat and labor-rate actions remain available; rate history is append-only.

## Purchases, materials, inventory, sales and expenses

Use these named entry points or `commerce/actions.postDocument`:

| Function                               | Document kind     |
| -------------------------------------- | ----------------- |
| materials/actions.purchaseMaterials    | MATERIAL_PURCHASE |
| materials/actions.issueMaterials       | MATERIAL_ISSUE    |
| inventory/actions.purchaseFinishedMats | FINISHED_PURCHASE |
| inventory/actions.receiveFinishedGoods | FINISHED_RECEIPT  |
| sales/actions.createSale               | SALE              |
| expenses/actions.recordExpense         | EXPENSE           |

Shared input fields: business_date, items, idempotency_key, optional supplier_id,
customer_id, sale_type, expense_category_id, amount, amount_paid, method, reference,
notes. Use CASH/BANK for method. Amount is only for expenses. Sale type is RETAIL
or WHOLESALE and only for sales. Customer/supplier are optional where relevant.

Each item specifies exactly one `mat_type_id` or `material_id`. Finished goods use
positive integer quantity. Other material quantities accept decimal strings with
at most three decimal places. `unit_price` is integer VND. A fractional quantity
times price must produce an exact integer VND line total; otherwise posting fails.
No hidden rounding rule is applied. Maximum document amount is 10^15 VND, unit
price 10^9, and individual quantity 10^6. Up to 100 lines per document.

For sedge purchases, use a BUNDLE material with is_sedge=true and provide
`bundles: [{weight_kg: '12.350', purchase_price: 180000, lon_count?: 5}, ...]`.
Each bundle has its own weight and price. Quantity, aggregate weight and line
total are computed from the bundle array. The line's unit_price is stored as zero
because the authoritative individual prices live in material_bundles; do not show
that zero as a representative bundle price. Optional lon counts are never required.
At most 1,000 bundles per line. Sedge issues require bundle quantity and weight_kg;
both balances must remain nonnegative. Issues do not claim COGS valuation.

Finished receipts require a unique `reference` of at least three characters,
representing a completed production batch. Include all mat types of a batch in one
receipt. Receipt quantity is explicit: recording weaving/sewing never changes stock.
External finished purchases are a separate document kind. Sales deduct finished
stock and validate current and historical daily closing quantities. No negative
stock override is currently exposed. Catalog row locks serialize competing stock
writers, including documents with multiple products in a consistent lock order.

Sales/purchases use actual line prices. `commerce/data.getMatPrice` suggests the
effective RETAIL/WHOLESALE/PURCHASE reference price. A missing reference or changed
actual price requires `override_reason` of at least five characters. Only managers
can post, and applied prices/reasons remain in audited lines. Labor rates are an
independent price system.

`amount_paid` posts the initial payment atomically with header, lines and stock.
Use `commerce/actions.recordDocumentPayment` for later receipts/disbursements:
document_id, payment_date, amount, method, notes and idempotency_key. Payments
cannot predate the document, exceed the remaining balance, or target stock-only
operations. Incoming/outgoing direction is derived, never accepted from the client.

## Reads and reports

`commerce/data`: getDocuments (date filters and pagination), getDocument (header,
lines, bundles, payment history and balance), getInventory, getFinancialSummary,
getMatPrice. All require ADMIN/OWNER. Workers cannot query company finance/stock.
RLS also denies direct reads and table writes outside these permissions.

Financial summary uses document dates for revenue/purchases/operating costs, work
dates for approved labor, and payment dates for cash flow. Cash flow includes bank
transfers. Receivable/purchase payable/unpaid wages are balances as of `to`, not
just transactions within the selected range. WageStatement's range selects work
cohorts and subtracts all allocations, including later payments; use financial
summary for as-of balances. All aggregated money is returned as decimal strings
to avoid JavaScript safe-integer overflow. Do not parse large totals into Number.

Purchases are not counted again as operating expense. Cash out already contains
document payments plus wage payments, so do not add those to it again. No exact
profit, COGS or inventory-value report is exposed: material consumption valuation
is not available. Quantity/weight movements remain the stock source of truth.

## Safety and retry contract

Every posted document/payment needs a stable caller-generated UUID. Retry the same
request with the same key after an unknown network outcome. Identical requests
return the existing ID; changed payloads fail with IDEMPOTENCY_CONFLICT. Initial
document payment uses the document key in the separate payment namespace; use a
fresh key for every subsequent payment. Updates/reviews use record versions.

Business document/line/movement/payment tables have SELECT-only application grants.
All writes are manager-checked RPCs with transactional audit triggers. Ordinary
workers see only their own work/payments/allocations. No delete endpoints exist.
Posted documents and payments are immutable through the current API. Corrections
that require refunds/reversals need a separately designed compensating transaction;
this API deliberately does not silently edit historical balances.

## Migration deployment (not a test run)

```powershell
node scripts/apply-migrations.mjs 202611020006_production_payroll.sql 202611020007_commerce_inventory.sql 202611020008_reports_catalog.sql 202611020009_worker_management.sql
```

The script uses SUPABASE_DB_URL through environment variables and psql, records
successful versions in app_migrations in the migration transaction, and skips
already-applied versions. On Windows it detects PostgreSQL 18's psql location;
otherwise configure PSQL_PATH or install psql on PATH. It never runs tests.

These backend additions have been applied to the connected database. Test, lint,
typecheck, production-build and UI verification remain intentionally unrun until
the user requests them. No business transactions are created by deployment.

## Worker monthly receipt acknowledgements

Migration 015 adds /wages and append-only wage_receipts/items. Workers attest that
the owner paid and they received the displayed amount; this is a worker receipt,
not another owner-side cash disbursement. An acknowledgement snapshots each unpaid-
acknowledgement work record and prevents its editing. New work in the same month
appears as a new amount to acknowledge. Payroll allocations and cash reports remain
separate; owners must reconcile these worker declarations before paying wages.
