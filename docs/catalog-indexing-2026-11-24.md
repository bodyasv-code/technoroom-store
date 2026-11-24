# Category indexing and merchant metadata — 2026-11-24

The active catalog renderer used the same generic document title for every category and did not emit a canonical or CollectionPage markup. The initial HTML was an empty catalog shell. Search Console also reported optional missing shipping/return metadata on valid product offers, plus missing optional reviews and aggregate ratings.

## Changes

- `/catalog` and known visible categories return their title, description, canonical, breadcrumb, child-category links and an initial bounded set of real product links in the first HTML response. The initial cards deliberately do not quote prices or stock; the existing browser engine hydrates full cards, applies promotions and filters, and updates metadata to the rendered selection.
- Unfiltered pagination has distinct canonical URLs; filtered and tracked variants consolidate to the category. Private/free-text query values never enter metadata. Invalid/inactive categories and out-of-range unfiltered pages return 404; database failures return non-cacheable 503. Queries read public fields only, use deterministic ordering and a bounded page size, and backend requests time out rather than wait indefinitely.
- Category aliases share the existing storefront scope rules. The sitemap emits their canonical visible targets once. Legacy `.html` URLs redirect to clean URLs. The catalog template lives outside public static routing so it cannot shadow the server handler.
- The existing sitemap function dispatches both server-rendered views; no additional function or account plan is required. Both templates and public module dependencies are explicitly packaged.
- Return metadata reflects the published standard policy at `/returns`: Ukraine, 14 days, mail/in-store return and seller-paid return costs, with the original policy link and its conditions/exceptions retained. No customer-facing policy text was changed.
- Shipping is marked free only when the actual discounted unit price is at least 50000 UAH. Below that threshold the delivery page says the carrier tariff applies; a fixed rate is not invented. No fabricated delivery dates, price expiry, reviews, ratings or product identifiers are added.

## Verification

- Targeted tests cover first-response category identity, real product links, hidden parent categories, aliases/sitemap, pagination, malformed and private parameters, HTML/JSON escaping, method/HEAD behavior, database outages, client metadata replacement and shipping threshold/promotion boundaries. Existing catalog, consent, navigation, product, sitemap and feed checks are retained.
- Local direct Node access to the Supabase hostname hit DNS resolution failures while Chrome could read the live catalog. The preview therefore uses a local fixture captured from the visible public product cards for initial HTML; browser hydration still uses the real public catalog. Chrome confirmed 277 projectors, 99 Epson results, price sorting, resetting filters, page 2 canonical/title and exactly one CollectionPage script.
- Production deployment and Google validation are recorded separately. Optional warnings about missing reviews and carrier-priced shipping cannot be removed by inventing values. Successful markup does not guarantee indexing or ranking.

References: [Google merchant listing markup](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing), [return-policy markup](https://developers.google.com/search/docs/appearance/structured-data/return-policy), [optional product review fields](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
