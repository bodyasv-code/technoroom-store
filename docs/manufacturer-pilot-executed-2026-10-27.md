# Manufacturer pilot — executed 2026-10-27

## Production result

Operation: `manufacturer-pilot-20261027`. The SQL Editor reported success.
The protected `technoroom_maintenance.product_repair_backup` table contains
two complete pre-change rows, both saved at `2026-10-27 15:03:29.65876+00`:

| Product ID | Exact SKU | Result |
| --- | --- | --- |
| 247 | V11HB60042 | Epson lamp lifetime, consumption and dimensions corrected |
| 4331 | 6928C001 | Canon malformed fields separated; verified copy, scan, fax and memory facts corrected; conflicting description replaced |

Read-only public REST verification confirmed that both descriptions and all
specification keys/values exactly match the prepared plan. Both storefront
pages were reloaded and inspected. Canon now shows 999 copies, separate print
and copy resolutions, RAM and fax memory. Epson shows separate lamp lifetimes
and the corrected consumption/dimensions. Screenshots are saved in the parent
workspace as `canon-manufacturer-repair-2026-10-27.png` and
`epson-manufacturer-repair-2026-10-27.png`.

The transaction checks all non-target row fields for side effects. Price,
stock, images, visibility and manual overrides were preserved. The four new
PGlite tests cover stale data, protected fields, backups, rollback and unexpected
trigger side effects; the complete suite passed 118/118 before execution.
Run the focused checks with `node --test tests/manufacturer-pilot.test.mjs`.
The PostgreSQL checks require the optional local `@electric-sql/pglite` package;
without it they explicitly report skipped rather than claiming SQL validation.

Prepared artifacts:

- `manufacturer-pilot-plan-2026-10-27.json`: immutable before/after snapshots.
- `../supabase/repair-manufacturer-pilot-20261027.sql`: already executed; do not rerun.
- `../supabase/rollback-manufacturer-pilot-20261027.sql`: restores only specifications
  and description and refuses to overwrite subsequent edits.

Do not regenerate the plan against already repaired production rows. This
repair does not add a persistent manufacturer-source priority to future imports;
review the next supplier import's diff so it cannot silently restore old facts.

## Evidence and remaining uncertainties

- [Epson exact SKU page](https://www.epson-africa.com/projectors/professional/business-education/eb-994f-v11hb60042)
  supports the corrected lifetime, power and dimensions.
- [Canon MF664Cdw/MF667Cdw datasheet](https://canon.a.bigcontent.io/v1/static/i-sensys-mf664cdw_i-sensys-mf667cdw_datasheet_uk_final_hr_b009b90bce574bdbb3acd807cc13aea1),
  pages 2–3; use the MF667Cdw column where the models differ.

Epson's web page and linked generated datasheet conflict about ports/optics
and brightness presentation. Those unresolved fields were left unchanged;
this is a verified partial repair, not certification of every field. Other
Canon compound fields, including digital sending, still need editorial review.

## Three additional categories sampled (read-only)

| Product | Check | Finding |
| --- | --- | --- |
| 576, 2E-OD1000 UPS | Description versus manufacturer's OD manual, technical table | 1000 VA / 900 W and input ranges agree. Structured `specifications` is empty despite detailed prose. Needs a separate reviewed extraction; no write performed. |
| 631, 2EDGEREDUSB monitor mount | Manufacturer's exact SKU page | Core limits agree: 17–32 inches, 2–9 kg, VESA 75/100, two USB 3.0 ports. Labels retain trailing colons and booleans use `+`; presentation cleanup remains. |
| 685, 0169108E projection screen | Manufacturer's exact SKU page | Core size, ratio, motorization and viewing angle agree; 240 × 135 cm is consistent with 16:9 and approximately 108 inches. No factual edit needed in checked fields. |

Sources: [2E OD manual](https://2e-world.com/wp-content/uploads/2025/01/637660758a8fb_2e-od.pdf),
[Evdo](https://2e-world.com/products/kriplennya-monitora-nastilne-2e-evdo/),
[0169108E](https://2e-world.com/en/products/motorized-suspended-screen-2e-16-9-108-2-4x1-35-m/?l=sv).
Only these stated fields were checked; no inference that their entire cards or
other products in the categories are correct.

## Supabase quota diagnosis

Read on 2026-10-27 from the organization's Usage page:

- Warning reason: **Egress Exceeded in the previous billing cycle**.
- Previous cycle uncached egress: **7.146 GB**, allowance **5 GB**.
- Current cycle shown: **17 Oct–17 Nov 2026**; uncached egress **0.87 / 5 GB**,
  cached egress **0.374 / 5 GB**.
- Banner says restrictions may apply **10 Nov 2026 if still over quota**;
  it does not establish an unconditional shutdown on that date.
- Storage displayed period average: **0.947 / 1 GB (95%)**. This is not an
  instantaneous file total.
- Read-only `storage.objects` metadata sum: **3134 objects, 689972031 bytes**
  in `product-images` (about 690 MB decimal). Metadata sum and billing-period
  average have different meanings and update timing.
- Database Usage summary **0.057 / 0.5 GB**; detailed view **54.19 MB**.

No plan upgrade, billing change, deletion or mass media import was performed.
The historical egress source breakdown and future capacity strategy remain to
be investigated before mass import. Current low usage does not itself clear
the warning or guarantee that it will disappear.
