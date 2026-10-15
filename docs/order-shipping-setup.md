# Order shipment

Run `supabase/order-shipping-upgrade.sql` in Supabase SQL Editor after the history
migration. It adds blank shipping_carrier/tracking_number columns and a database
audit trigger. Existing statuses, totals, checkout metadata, stock and items are
unchanged. The old history migration does not need to be rerun.

Admin → Orders → Details → Shipment supports Nova Poshta, Ukrposhta and Other.
Saving is explicit, validates format, and compares both original fields to avoid
overwriting another manager. Clearing both fields is supported and audited.
The separate Save Shipment button does not save unsaved status/manager-note edits,
create a carrier label, move an order to shipped, or send any customer email.

Tracking opens fixed official domains only, on a manager click. Nova Poshta opens
its tracking form: enter the displayed TTN there. Ukrposhta receives the barcode in
the tracking URL. Other carriers have no generated external link. No phone/address
is included in URLs; tracking is not polled automatically.

Official references:
- https://novaposhta.ua/help/
- https://track.ukrposhta.ua/tracking_UA.html
- https://ok.ukrposhta.ua/doc/manual-ekspres-standart-0.0.9.pdf

Offline checks: `node --test tests/order-shipping.test.mjs` and, with the local PGlite
development dependency installed, `node tests/integration/order-shipping.mjs`.
