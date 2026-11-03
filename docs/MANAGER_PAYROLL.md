# Manager payroll

`/payroll` is restricted to active OWNER/ADMIN sessions. Navigation exposes it as “Công & lương thợ”. The month filter groups work by work date, including inactive workers and historical workers who no longer hold the WORKER role.

`manager_payroll(date)` returns recorded work, quantities by stage, rate snapshots, allocated payments, receipt acknowledgements, and related payment history. Monetary JSON values are strings and the page aggregates with BigInt. Stage quantities remain separate because different stages can process the same physical mat.

`pay_monthly_wages` accepts a positive full or partial payment, method, notes, and an idempotency key. It locks the worker payroll advisory key shared with receipts and work changes, allocates oldest eligible work first, and delegates accounting to `pay_wages`. Already acknowledged work is excluded. The existing maximum of 500 allocations per payment applies.

Owner-recorded payments and worker acknowledgements are displayed separately. For each work log, outstanding wages equal earnings minus the greater of allocated payments and acknowledged receipt amounts. A worker acknowledgement does not itself create a cash movement. Related payment history displays the entire payment amount, which can include other months for older payments.

Migration: `202611030023_manager_payroll.sql`. No tests, build, lint, or browser verification were run, following the user's instruction.
