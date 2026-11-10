# Supplier stock clarification

MTI's explicit `Потребує уточнення` is imported as `stock_kind=needs_confirmation`, with a null supplier quantity. Empty/unrecognized values and lower bounds still require review; they do not become zero or confirmed stock.

Apply `supabase/supplier-offers-upgrade.sql` before deploying the storefront. The repeatable migration adds a nullable supplier quantity with a state constraint and the derived product flag `supplier_stock_uncertain`. A trigger recalculates the flag when an offer changes or is removed. Supplier costs and offer journals remain admin-only.

The storefront and admin show **Наявність уточнюється** when the flag is set and the product has no confirmed sellable quantity. The customer can request confirmation but cannot check out on the basis of an unknown offer. Existing confirmed catalog stock takes precedence. This does not aggregate supplier quantities into sellable catalog stock; existing MTI offers continue to preserve catalog prices and quantities.

The importer keeps descriptions, photos and publication separate. Exact stock received in a later MTI import clears that supplier's uncertainty. Existing offers are not reclassified from zeros without evidence.

## Validation

- Unit tests: `node --test tests/*.test.mjs`.
- Database integration, with the optional local `@electric-sql/pglite` dependency: `node --test tests/integration/supplier-stock.mjs`. Uses an isolated in-memory database, tests repeated migration, null/zero distinction, preservation of catalog stock, rollback on invalid offers, journal entries, and idempotent Epson repair.
- Production Epson ELPSC36, SKU V12H002AG0 / product 1180: MTI offer added from the owner's 2026-11-02 portal screenshot. Quantity remains null; base catalog quantity stays zero. Repair journal ID: `738d273b-4609-4439-b3db-2601fab9732c`. The journal request includes the pre-change product snapshot.

## Supplier inventory integration (2026-11-10)
`supabase/supplier-inventory-upgrade.sql` projects maximum exact supplier quantity onto `products.supplier_available_quantity`. Base catalog stock is preserved; quantities are never summed. Storefront and admin use the larger base/supplier quantity. Checkout locks products and consumes both projections conservatively, recording supplier_reserved_quantity. Re-importing a price does not release reservations. Reservations require manager reconciliation after supplier fulfillment; automatic cancellation release is intentionally not implemented. Supplier prices remain private. Existing imported offers are snapshots and need regular refreshed price imports.
Cancellation: apply supplier-inventory-cancellation.sql after supplier-inventory-upgrade.sql. New orders record exact base consumption and conservative supplier reservation. Cancelling releases each allocation once, recomputes supplier availability from current offers, and prevents reopening without a new reservation. Orders predating the allocation ledger are left unchanged and need manual reconciliation. Shipped/completed orders keep supplier reservations pending fulfillment reconciliation.
