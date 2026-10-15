# Expected supply date

Run `supabase/order-supply-upgrade.sql` after history, shipping and manual payment
migrations. It is repeatable, transactional and reloads the PostgREST schema cache.
Dedicated supply_expected_on/supply_note columns avoid older delivery metadata.
Existing orders start with no expected date and no inferred overdue status.

Admin → Order Details → Supply date accepts an optional calendar date and an internal
supplier note up to 2000 characters. Dates may be cleared or revised; both old/new
values and the authenticated manager are recorded in the immutable journal.
Saving compares the original two fields and workflow status. It changes no other
order fields and sends no mail. It is not a promised customer delivery date.

The list shows overdue dates only when the date is earlier than today's Kyiv calendar
date and status is not shipped/completed/cancelled. Today is not overdue. An explicitly
entered supply date is meaningful regardless of other open statuses, including paid.
The overdue filter combines with search, workflow status and email filters. No date
means no overdue warning. There are no scheduled notifications or automatic writes.
The indicator updates on load/filter/render, not by a background midnight timer.

Tests: `node --test tests/order-supply.test.mjs`; with local PGlite development
dependency, `node tests/integration/order-supply.mjs`. No production records are edited.
