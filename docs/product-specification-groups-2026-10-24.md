# Product specification grouping — 24.10.2026

## Scope
Presentation of the full specification table on product pages only. No database mutations, no changes to imported/manual records, prices, stock or image content. Catalog previews and filters keep their existing specification pipeline.

## Changes
- Non-empty groups for general information, image, light source, printing, scanning, copy/fax, paper/workload, connections, system/memory, sound, body/power, and unknown fields.
- Exact normalized label/value duplicates collapse; manufacturer/brand are explicit aliases.
- For projectors only, complete plain light-type tokens such as Laser/Лазер can collapse between source/type fields. RGB, LED+laser, wattage and lifespan details remain distinct.
- Brightness with different/unspecified ISO/ANSI standards remains separate, even for equal numbers.
- Processor and processor/memory labels are not assumed equivalent. Unknown and contradictory values remain visible, not silently removed.
- Generic printer resolution belongs to printing; explicitly named optical scan resolution remains in scanning.
- Displayed-row counts include the visible manufacturer row and use Ukrainian plural forms.
- All rendered keys/values/headings are escaped; input arrays are not mutated.
- Initial deep links remain aligned if images above the table finish loading later. Automatic re-alignment stops as soon as the visitor interacts; gallery redraws do not re-arm it.

## Verification
- Final serial test run: `node --test --test-concurrency=1 tests/*.test.mjs`, 77 passed / 0 failed. App/controller/group module syntax checks passed.
- Unit coverage: equivalence guards, differing units/standards/modes, composites, zero/false values, unknown fields, ordering, idempotence, escaping and Ukrainian counts.
- Layout controller tests cover late-image correction and cancellation on user input.
- Local Chrome with real public product 439: seven groups / 23 visible rows, no page-width overflow; source records unchanged.
- Local Chrome with public HP 178nw / ID 4530: print and scan resolution appear in separate groups; legacy fragments remain visible under known or unknown headings.
- 390 × 844 iframe preview: visually checked grouped table and section navigation. Not a physical-device certification.
- Browser error log for the projector preview: no errors observed.

This is not a manufacturer verification of ambiguous supplier values. Such values need a separately scoped data correction.
