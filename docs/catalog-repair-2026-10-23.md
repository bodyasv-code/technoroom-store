# Catalog and customer notification repair — 2026-10-23

## Implemented
- Buyer order acknowledgement through the existing Microsoft Graph mailbox, separately recorded from the store notification. No historical orders mailed automatically. Acceptance is not proof of inbox delivery.
- Shared home/catalog mega-menu logic, desktop stacking fix and shared mobile drilldown.
- Product description rich editor with image upload, sanitized rendering and legacy plain-text support.
- Canonical printer/device and projection-screen facets; ambiguous imported values are omitted rather than guessed.
- Printer quality format validation uses the same format reader as the editor, including A4 in verified product names.
- Active-only missing-image counts share one image/gallery predicate.
- Search focus uses one rounded container indicator.

## Approved production data repair
Applied the two guarded SQL scripts in supabase/repair-*-20261023.sql through the authenticated SQL editor.
Detached active cases 3887–3889 and hidden cases 3502,3505–3507,3582–3584 from phone families. Hidden cases remain hidden.
Repaired seven family descriptions/specifications and copied photos from actual active phone variants.
Hidden parents 4297,4298,4302,4303 have no active variants. No products deleted, prices/stock/SKUs unchanged.
21 before-images are retained in technoroom_maintenance.product_repair_backup, with RLS enabled.
Read-only production verification: active products without any photo = 894; all products including hidden = 1027; backed-up rows = 21.

## Verification
72 sequential Node tests passed, including mocked customer mail and actual SQL migration execution in PGlite.
Local browser checks: wide homepage menu visibly opens, normalized office filters contain no matrix taxonomy, rich editor fixture passes six formatting/image/sanitization checks.
No real buyer email, new order or product-description upload was submitted during testing. A real new-order/inbox test remains necessary to establish delivery.
