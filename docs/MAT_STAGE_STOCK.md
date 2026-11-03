# Physical mat inventory and stages

The physical flow is WOVEN → TIED → CUT → SEWN. CUT and SEWN mats can be sold. Sewing is optional for a sale. Workers now select a physical mat type for all four stages. Only weaving uses that type for wage pricing; tying, cutting, and sewing retain their shared rates.

Physical inventory is an append-only ledger. Migration 030 connects new worker submissions through `submit_work_stock`: weaving adds WOVEN inventory and other stages transfer it forward. Wage creation and stock changes share the same transaction. A failure rolls both back. `stock_mat_type_id` retains physical identity separately from the existing wage-pricing `mat_type_id`. `work_stock_state` stores the applied quantity; quantity edits append only the difference, and validate all stage balances. Retrying a submission does not apply inventory twice. Underlying submit RPCs are revoked from app clients so they cannot bypass synchronization.

Historical work logs remain unlinked and are never replayed automatically, preventing duplication of stock already entered manually. Quantity edits to those legacy logs affect wages only; the UI states this explicitly. Managers may enter opening balances or exceptional transfers under “Nhập tồn đầu kỳ / cập nhật ngoài ghi công”. Purchases remain automatic. These exceptional inventory operations do not create or approve wage entries.

The stage ledger mirrors every finished-stock receipt and sale. Stage transfers insert equal negative/positive entries and preserve total physical stock. The existing mat row lock serializes receipts, sales, and transfers. Each stage's cumulative daily balance is checked so backdated transactions cannot make a later balance negative. Transfers and document creation have idempotency keys and are audited. Only managers can execute these mutations; authenticated clients have no direct ledger write grants.

Sales consume SEWN stock first, then CUT stock. WOVEN/TIED stock cannot satisfy a sale even when the original total-stock ledger has enough quantity. Failure rolls back the full sale, including its payment.

Dashboard totals refer to mats currently held, excluding those sold:

- Total: WOVEN + TIED + CUT + SEWN.
- Awaiting tying: WOVEN. Tied: TIED + CUT + SEWN.
- Not cut: WOVEN + TIED. Cut: CUT + SEWN.
- Not sewn: WOVEN + TIED + CUT. Sewn: SEWN.
- Ready for sale: CUT + SEWN.

The per-type breakdown shows disjoint positions: awaiting tying, awaiting cutting, cut but not sewn, sewn. The aggregate “not done” rows overlap and must not be summed.

Migrations 027/028 add reporting and the physical stage ledger; migration 030 connects wage submissions and edits. Historical stock movements were explicitly recorded as finished goods, so their stage is seeded as SEWN. Existing work in progress must be entered with its actual stage. “Added today” includes net weaving receipts/corrections, manually recorded stock, and purchases; stage transfers do not increase that number. Weaving corrections are excluded from sales totals.

No test/build/lint/UI verification was run, as requested by the user.
