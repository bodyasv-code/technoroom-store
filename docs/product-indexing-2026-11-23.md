# Product indexing and breadcrumb correction — 2026-11-23

Search Console classified real product pages as duplicates; the initial response was the same empty product shell. The active client renderer updated the title and content but did not run the old renderer's canonical, description or Product metadata code. Breadcrumbs also ended with the literal label “Товар”.

## Result

- `/product?id=…` returns product-specific HTML, title, description, canonical, Open Graph and one Product JSON-LD block before JavaScript. The visible description, specifications, image, price and availability are included for every visitor; there is no bot-specific version.
- The final breadcrumb is the product name with SKU, marked `aria-current="page"`. Both initial HTML and client rendering use the same breadcrumb helper.
- Product identity, availability, selection and metadata helpers are shared by the server and browser. Prices use existing promotion rules. Inquiry-only stock never becomes confirmed availability or a fabricated preorder. Numeric quantities are not added to customer-visible output or structured data.
- Active variant URLs canonicalize to the active family page. Explicitly requested children remain selected, and inactive children are excluded. The sitemap emits canonical family pages while retaining active orphans whose parent is unavailable.
- Missing, hidden, malformed and unrelated-variant requests return 404. Database or template failures return non-cacheable 503 with Retry-After, rather than another product or a successful empty shell. Valid HTML has a 60-second shared cache.
- Server reads use an explicit public column projection; internal costs, supplier payloads and administrative notes are not serialized. Supplier descriptions are emitted as escaped plain text initially; the existing browser renderer enhances them with its sanitized rich formatting and gallery. Existing server content remains if client loading fails.
- The former `public/product.html` is now `server/product-template.html`, included in the function package. Keeping it in public would shadow the rewrite. Legacy `.html` links permanently redirect to the clean route; the product ID query is retained. The existing sitemap function dispatches the page to avoid adding to the 12-function hosting budget.
- Google can fetch the existing public product-image proxy under robots.txt.

## Verification

- 30 targeted checks passed: initial product identity, price and availability, promotion parity, variant identity/canonical/sitemap, hidden products, failures, GET/HEAD, hostile supplier text and JSON boundaries, literal dollar replacement sequences, client metadata updates, existing storefront/consent/navigation and pricing safeguards.
- Local real catalog checks: Samsung projector 439, Canon MFP 4331, Canon cartridge 5019 and Epson projector 8 returned distinct initial content/canonical. In Chrome, the projector hydrated with an enabled purchase button, working gallery, correct breadcrumb, one canonical and one Product schema; no page errors were observed. No order or advertising event was submitted.
- Earlier broad checks also exposed two existing unrelated expectations: admin-modern checks an older admin script suffix, and supplier-availability still expects MTI `-` to mean unknown although the approved rule maps it to zero. Those expectations were not relaxed for this change.

Production deployment and Google re-crawl must be verified separately. A correct page does not guarantee indexing or immediate changes to Google's historical reports.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [Product variants](https://developers.google.com/search/docs/appearance/structured-data/product-variants), [Vercel rewrite precedence and function packaging](https://vercel.com/docs/project-configuration/vercel-json).
