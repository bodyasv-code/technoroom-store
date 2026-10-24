# Product page layout — 24.10.2026

## Approved scope
- Full-width description followed by a separate specification section, instead of the previous 35/65 split.
- Compact sticky header on product pages while scrolling; catalog, search and cart remain available.
- Section links for description (only when content exists), specifications, delivery/payment and warranty.
- Delivery/warranty sections link to existing information and contacts; no invented warranty periods or delivery promises.
- No database writes, product-content changes, price/stock changes, checkout or admin styling changes.

## Implementation
- Product-only stylesheet, loaded after the existing product styles.
- Real anchor destinations, keyboard focus, active section, header-aware offsets, reduced-motion handling, hash/back navigation and resize measurement.
- Existing saved-scroll restoration yields to explicit product-section deep links.
- Controller is replaced cleanly when the existing gallery redraws the product DOM.
- The header uses separate enter/exit thresholds to prevent compact-mode oscillation.
- Two service cards can share a desktop row without the active link always selecting the last card.

## Verification
- `node --test --test-concurrency=1 tests/*.test.mjs`: 76/76 passed. Parallel run exhausted Node memory in an unrelated supplier test; serial run passed that test and the entire suite.
- `node --check` for app and new controller: passed.
- Local Chrome preview with the real public product 439: description/specification navigation works; thumbnail change and subsequent navigation work; no browser error logs observed.
- Measured desktop: header approximately 64.7px compact (64px row), navigation approximately 57.3px; specification section starts around 143.1px, below both; no page-width overflow at 1920px.
- Same-origin 390 × 844 iframe: visually inspected header, search/cart, horizontal section navigation and description. This is a responsive preview, not a physical-device certification.
- Local preview server accepts GET/HEAD only and removes the analytics module; no orders/inquiries were submitted.

Commercial data, the pre-existing duplicate specification values and description thumbnail content were deliberately left unchanged.
