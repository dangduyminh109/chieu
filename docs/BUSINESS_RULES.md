# Business rules and explicit Phase 1 assumptions

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
