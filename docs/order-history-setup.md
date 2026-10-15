# Order history

Run `supabase/order-history-upgrade.sql` in Supabase SQL Editor after the existing
checkout-pricing and order-workflow migrations. It is transactional and repeatable.
No existing statuses, stock, order items or totals are changed. Historical events
are not reconstructed: history starts only when the trigger is installed.

The database trigger records actual status changes and email notification metadata
updates in the same transaction. Admins can read events, not insert/edit/delete them.
The actor comes from the authenticated session. Server-side retries preserve the
authenticated requester's ID and attempt ID through their final result. Automatic
mail attempts and manual SQL updates have the explicit label “Система / SQL”.
Names are snapshotted, so later profile changes do not rewrite the journal.
No message content, contact data, credentials or raw mail errors are copied into events.
Only sanitized mail error codes are retained. Microsoft acceptance is not delivery.

The order dialog shows the latest 100 events with Kyiv time. If the migration is
missing, it states that logging has not started; existing order processing still works.

Tests: `node --test tests/order-history.test.mjs`; with the local PGlite development
dependency installed, `node tests/integration/order-history.mjs` tests actual SQL,
permissions, rollback and trigger behavior entirely offline.
