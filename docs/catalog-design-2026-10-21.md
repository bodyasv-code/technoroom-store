# Category page refinement

Approved scope: improve filters, cards and mobile controls; publish directly. Photos, prices, filter/search logic and checkout are unchanged.

- Isolated `catalog-modern.css`, loaded after storefront styles on catalog.html only.
- Desktop: compact 250px filter panel, 3-column cards (2 at medium widths).
- Up to 900px: native details/summary filter panel, initially collapsed by a small independent presentation module. Without JavaScript it remains expanded and usable.
- Native sorting and page-size controls retain their IDs, values and existing handlers.
- Show products closes the panel and returns keyboard focus to its summary; no filter values are cleared or copied. Existing filters still update results immediately.
- Resizing across the breakpoint restores the appropriate open state; desktop filters stay open. No modal or scroll lock is introduced.

Verification: full Node test suite, including mock interaction tests for mobile open/close, focus and viewport transitions; existing filter state tests unchanged. No real-browser/device visual QA was completed in this turn. User feedback on live mobile layout is still useful.
