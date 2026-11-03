# Business rules and explicit Phase 1 assumptions

## Current catalog pricing

The mat form manages default selling price and labor rates in one transaction.
Weaving is mat-specific; sewing, cutting and tying use shared stage prices. The
three requested seed mats sell at 100,000 VND. Weaving is 10,000 for checkerboard
mats and 8,000 for white and tra-nien mats. Sewing/cutting are 1,000 per mat;
tying is 500 per mat (1,000 per two mats). Seed prices require an ADMIN profile.
Selling prices are suggestions and can be overridden on the actual transaction.
Only ADMIN/OWNER may manually change an unpaid, unlocked work rate with a reason.
Workers cannot choose their own wages. Changing defaults never reprices saved
transactions. Multiple effective-date revisions on one day are resolved by latest
creation time and ID. Confirmed wage receipts also prevent rate changes.

1. Quantity is a positive integer, maximum 1,000,000 per entry. VND unit rates are
   integers between zero and 1,000,000,000. Total is quantity multiplied by the
   saved rate, generated in PostgreSQL, not trusted from the form.
2. Business day is Asia/Ho_Chi_Minh. Future work dates are rejected. Backdating to
   2000-01-01 is allowed in Phase 1; approval/period locking should constrain this
   later. Date limits are validation boundaries, not accounting-period policy.
3. Select the most recent worker-specific rate effective on/before the work date.
   If none exists, select the most recent default rate. A worker-specific rate
   remains in force until superseded by another individual rate; a newer default
   does not override an individual arrangement. Future-dated rates never apply early.
4. No applicable rate means no submission, except an explicitly configured
   OWNER+WORKER zero-wage arrangement. A normal zero-valued labor rate is also valid.
5. Owner zero-wage is stored in the profile and configurable only by ADMIN. It
   applies only while both OWNER and WORKER roles exist. Each work log records
   whether this policy was applied. This is never inferred solely from skills.
6. Multiple mats/stages may be logged for one person/date. Repeated entries are
   allowed as separate deliberate operations. A retry with the same request key
   returns the prior record, without adding wages twice.
7. Every submitted record stores rate, rate reference, quantity and total snapshot.
   Later default or individual rate changes do not reprice history. A stale preview
   is rejected and must be refreshed. Manual wage overrides are not exposed in Phase 1.
8. Newly entered work is SUBMITTED. It is not payable yet. APPROVED/LOCKED records
   contribute to approved-wage summaries; LOCKED is reserved for previously approved
   work. No status transitions are exposed in Phase 1. DRAFT and REJECTED are reserved
   for Phase 2 editing/review workflows. Workers cannot edit submitted/approved work
   in this release. Corrections require the later controlled workflow.
9. Approved wages and payments are different facts. Phase 1 shows approved wages
   before payments, not a claimed unpaid balance. Phase 2 must compute approved
   wages minus allocated payments and prevent double allocations.
10. Production-stage quantities count processing events. Weaving ten and sewing
    the same ten does not create twenty finished mats. No stock changes occur here.
11. Revenue, purchases, material consumption, operating expenses and cash flow are
    not implemented. No profit/COGS or paid/unpaid totals are guessed.
12. Catalog deletion is possible only for unused mats. Deactivate used types.
    Labor-rate history is append-only. Duplicate rate scope/date is rejected.
13. Seed mat types are illustrative catalog examples only, never assumed business
    products. Owners should rename/remove them before production use.
14. Offline submissions are unavailable. Failed requests never display success.
    Keep retry keys after unknown transport outcomes; verify history before entering
    a replacement transaction.

Financial assumptions above are documented rather than hidden in presentation.
Confirm the worker-rate precedence, backdate policy and submission/review process
with the workshop before production rollout.

## Current deletion policy

Deletion features are disabled. Keep business records and use inactive status where
provided. This supersedes the earlier unused-mat deletion rule. The legacy delete
action returns a safe message; migration 004 disables and revokes the database RPC.
Membership reconciliation may still replace role/skill associations transactionally;
this is permission maintenance, not a record-deletion feature.

## Backend expansion (supersedes Phase 1-only restrictions above)

Managers can now approve/reject/lock submitted work; rejected work may be corrected
and resubmitted by its worker. Approved snapshots are immutable. Payments allocate
approved wages exactly and unpaid balance subtracts allocations. Core purchases,
explicit finished receipts, sales, operating expenses and payments are implemented
in the backend. No UI for these operations has been added. See BACKEND_API.md for
stock locking, historical stock validation, price override and report semantics.

## Immediate recording policy

Migration 013 supersedes the approval queue: submitted/new work is recorded as
APPROVED immediately and contributes to wages without manager review. Existing
SUBMITTED records are converted without repricing. APPROVED is an internal status;
UI labels it Đã ghi nhận. Payments remain separate and allocated explicitly.

## Stage-specific mat classification

Only WEAVING requires a mat type. Multiple weaving entries on one date can use
different mats and independent rates. Other stages (including TYING, SEWING and
CUTTING) use a null mat reference and stage-wide labor rates; skills and worker
overrides remain independent. Historical mat-specific work snapshots are retained.
Only unambiguous legacy nonweaving prices are copied to stage-wide price history;
conflicting values require explicit manager configuration. New daily entries do
not require a mat catalog for nonweaving stages.
