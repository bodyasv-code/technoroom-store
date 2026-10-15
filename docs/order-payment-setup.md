# Manual order payment accounting

Run `supabase/order-payment-upgrade.sql` after the history and shipping migrations.
It is transactional and repeatable, and asks PostgREST to reload its schema cache.
Existing orders retain unknown payment status and amount (NULL). No backfill from
the older workflow status “paid” is performed. No real money is moved.

Admin → Order Details → Manual Payment shows Unknown, Unpaid, Partial and Paid.
The amount is the TOTAL already received in UAH, not an incremental payment.
Amounts accept comma/dot decimal separators and spaces, at most two decimals.
Cent arithmetic validates 0 for Unpaid, >0 and <total for Partial, =total for Paid.
Overpayment is rejected. Zero-total orders can explicitly be marked Paid with 0.
Unknown requires a blank amount; resetting to Unknown is recorded in history.

The database enforces the same consistency, and records old/new values and the
authenticated manager in the same transaction. Admins cannot edit journal rows.
Save updates only payment_status/amount_paid, comparing the original values and
order total. It does not change workflow status, stock, items, delivery, company
metadata, notification state or total. It sends no mail, calls no payment provider,
and is not an accounting/tax receipt or verification by a bank.

The separate Save Payment button leaves unsaved status/manager-note/shipping edits
untouched. No production records should be edited just to test this feature.

Offline: `node --test tests/order-payment.test.mjs`; with PGlite development dependency
installed, `node tests/integration/order-payment.mjs` validates actual migration,
RLS, atomic events, stale saves, rollback and preservation of other order data.
