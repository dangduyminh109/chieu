# Trading, debt, materials, and contacts

Contact payment details (migration 036): customers and suppliers support optional
bank name, account number (text to retain leading zeroes), account holder, and a
QR image. These are saved atomically with the contact. QR uploads are limited to
5 MB JPG/PNG/WebP in a private bucket; only managers can upload/read. The
authenticated `/api/contact-qr` handler returns private, no-store image responses.
Payment details are visible in the directory, quick trading forms, material
purchases, and document details. They are information only: no bank transfer is
initiated or verified automatically. Existing forms that omit the new fields
preserve previously saved bank details.

Manager-only routes:

- `/transactions`: date/type/contact filters, an outstanding-only view, current paid/unpaid balances, and pagination.
- `/transactions/[id]`: items, individual sedge bundles, payment history, and a dialog to record full or partial settlement.
- `/contacts`: customer/supplier tabs, name/phone search, create/edit/inactivate dialogs, and each contact's outstanding balance with a link to their transactions.
- `/materials`: material catalogs, actual quantity/weight balances, purchase/issue dialogs, and edit/inactivate dialogs.
- `/materials/[id]`: date-filtered paginated movement history and links to original documents.

Quick mat purchases/sales support registered contacts and full, partial, or deferred payment. Unpaid trading documents require a registered customer/supplier. Migration 033 enforces this with a deferred constraint trigger, after the initial payment has been inserted in the same transaction. Existing documents are not retroactively changed. The two reporting RPCs return monetary sums as decimal strings and aggregate all rows before paginating.

Further settlements call the existing `record_document_payment`: direction is inferred from the original document; it serializes document payments, enforces dates/positive amounts and remaining balance, and uses a retry key. Settlement only adds a cash movement; inventory is not posted again. UI confirmation states whether money was received or paid.

Material purchases use `MATERIAL_PURCHASE`. Sedge requires each bundle's actual weight and price; its aggregate price is the sum of bundle prices, without inventing a unit average. Other units accept up to three decimal places and an integer VND unit price; fractional VND line totals are rejected rather than rounded. Material issues use `MATERIAL_ISSUE`, require quantity plus weight for sedge, and create no cash payment. All writes use the existing atomic, audited manager RPCs and historical stock checks.

Catalog units and sedge classification cannot change after transactions. Contacts and materials can be made inactive; this UI introduces no record deletion.

The old expense-only purchase categories remain available for recording money without stock tracking. The form points users to material purchases when inventory is needed, to avoid recording the same purchase twice. Legacy free-text customer notes are preserved and are not guessed into contact matches.

Material catalogs start empty unless configured; names/units must be created by a manager. This implementation does not seed fictional material balances.

As requested, Excel export and PWA installation are outside this change. Tests, typecheck, build, lint, and browser verification were not run. Source formatting was applied, and migration 033 was applied to the database.
