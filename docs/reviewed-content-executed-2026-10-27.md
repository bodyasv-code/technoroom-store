# Reviewed content protection — 2026-10-27

Production operation: `reviewed-content-pilot-20261027`.

Installed `reviewed-content-guard-upgrade.sql`, then successfully executed the
exact snapshot plan in `apply-reviewed-content-pilot-20261027.sql`.
Three full pre-change rows were backed up in the RLS-protected maintenance
backup table; three exact ID/SKU/brand review records were enrolled.

## Result

- Epson 247 / V11HB60042 and Canon 4331 / 6928C001: specifications and
  descriptions unchanged; whole-table import protection and description
  protection enabled.
- 2E 576 / 2E-OD1000: added 16 individually reviewed structured specifications;
  description unchanged, whole-table import protection enabled.
- Price, stock, images, publication status and other unrelated fields preserved
  by the transaction's complete-row comparison (except normal updated_at).
- Public REST verification confirmed exact specification/description matches
  and the expected protection flags on all three rows.

The user subsequently limited future work to projectors, office equipment,
consumables and related accessories. The UPS change had already committed
before that clarification. Do not extend this work into UPS or other categories.

## Protection semantics

The existing ERP/supplier import paths mark writes with
`technoroom.import_write=true`. A database trigger rejects any change to the
complete specification table of enrolled cards, including additions under
different aliases; this avoids malformed fields being resurrected.
Descriptions are protected only for review records requesting that protection.

The importer preview sees a server-derived `manual_overrides.verified_specifications`
flag and preserves the whole table while allowing price/stock updates. Stale
clients that still send content changes fail safely at the database guard.
The review table is private with RLS and no anon/authenticated grants. A client
cannot enroll a card just by submitting the flag. No new public RPC or permissions
were added. Normal manual edits remain possible and the next import preserves
the manually updated table, not a frozen old snapshot.

This is protection of the reviewed cards, not a claim that all their fields
are verified. Pending Epson optics/port ambiguities remain unresolved.
Existing nonempty descriptions are normally preserved by the importer anyway;
the database guard also prevents an explicit importer replacement for these
two cards. An explicit content-review RPC using import mode is blocked too;
use the normal manual product editor for an intentional description correction.

## Validation

122/122 tests passed with `node --test --test-concurrency=1 tests/*.test.mjs`.
The parallel run exhausted local memory in two PostgreSQL test workers;
the serial run passed all tests with no skips. Four focused checks also passed
after adding the rollback-only verification script. They cover full-table
preservation, alias additions, protected empty descriptions, continuing price/
stock updates, actual SQL trigger behavior, manual edits, stale snapshot atomicity,
private-table access and UPS content restore refusing later edits.

Executed `verify-reviewed-content-pilot-20261027.sql` in production. It verified
content rejection and commercial updates, checked all three backups/review records,
then rolled back every test write. SQL Editor returned:
`Content guards and commercial updates passed; all test writes rolled back`.

## UPS evidence and recovery

Source: [2E exact SKU page](https://2e-world.com/en/products/2e-od1000-ups-1000va-900w-lcd-usb-2xschuko-2e-od1000/),
cross-checked against the [OD manual, pp. 5–6](https://2e-world.com/wp-content/uploads/2025/01/637660758a8fb_2e-od.pdf).
Only mutually consistent fields were added. Dimensions, weight and warranty
were excluded because the source documents differ or describe regional terms.
The existing description was retained; this does not certify every claim in it.

`restore-reviewed-ups-20261027.sql` restores only the UPS specification table
from its backup, refuses subsequent content/provenance changes and preserves
new prices, stock, photos and the import guard. It does not remove enrollment.
Removing enrollment or restoring old provenance requires a separate reviewed
maintenance change; the previous manufacturer pilot rollback intentionally
refuses the now-changed protection metadata.

Do not regenerate the plan against already modified production rows or rerun
the apply SQL. No mass import or new media download was performed.
