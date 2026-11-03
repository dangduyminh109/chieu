# Manager-entered mat cost and profit

The user selected manual unit cost per mat type, rather than automated material/labor costing.

Managers edit “Giá vốn mỗi chiếc” in the mat catalog. The value includes material and labor cost. Empty means unknown; an explicitly entered zero is a known zero cost. Effective-dated revisions are append-only and start on the current Vietnam business date. Clearing a previously configured cost adds an unknown revision for future sales; it does not delete history.

A BEFORE INSERT trigger snapshots the latest eligible cost onto each sale item, together with the revision reference. Generated `cost_amount` is quantity times unit cost. All older sale items remain unknown; migration 034 does not guess historical values. Updating catalog cost does not reprice past sale items. A manager may fill or correct an individual sale item's unit cost through an audited, version-independent adjustment dialog with a reason and retry key. This does not alter sales revenue, payments, wages, or stock quantities.

`/profit` provides monthly daily buckets and yearly monthly buckets, per-type totals, a revenue/cost/gross-margin chart, and up to 20 oldest-unresolved-by-recent-date links to missing-cost sale documents. Resolving them exposes further missing documents. Monetary aggregates are decimal strings and summaries use BigInt; chart numeric coordinates are visual approximations and tooltips retain exact strings.

- Revenue uses sale document dates and includes credit sales.
- COGS includes sold quantities only, with the per-sale manual cost snapshot.
- Gross margin = revenue − COGS.
- “Sau chi phí khác” = gross margin − expense documents other than categories SEDGE, THREAD, and DYE. These material purchase expense categories are excluded because the manual unit cost already includes materials. Wage payments and material/finished purchases are never subtracted again in this report.
- Any missing cost makes the full-period gross/net result unknown. A partial known COGS total is labeled as such. Charts hide COGS and margin buckets containing missing costs.

This is management reporting based on the owner's entered reference costs, not an automated actual-cost inventory valuation or a statutory accounting report. The owner must keep operating expenses separate from costs already included in the manual unit cost. It does not calculate taxes, depreciation, wastage, or returns that the app does not yet model.

The sold-inventory recognition concept is consistent with the explanation in [IAS 2](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/); the manual reference-cost method here is not claimed to be an IAS 2 valuation implementation.

Only managers can read cost history, change costs, or access the report. Cost edits and catalog changes are audited. No test, lint, typecheck, build, or browser verification was run, as requested. Migration 034 was applied.
