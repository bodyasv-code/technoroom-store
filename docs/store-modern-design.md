# Storefront design refresh — 21.10.2026

First pass for the user's request to modernize the storefront and then admin.
Only index.html, catalog.html and product.html opt into store-modern.css via a
body class. The base stylesheet, app.js, checkout, admin and product data are unchanged.

Direction: retain TECHNOROOM's blue/white identity; use a neutral pale background,
Manrope across the three pages, consistent rounded controls, calmer spacing,
larger product/category type and touch-friendly purchase buttons. Add an introductory
homepage section and a real category heading. No invented stock, reviews, discounts,
customer counts or delivery promises are added. Existing banners retain their layout
measurement and contained images. Missing product photos remain deferred.

Legacy !important rules require narrowly scoped overrides for card images and mobile
type. Existing catalog menu, hover previews, cart, search, filters and IDs stay intact.
No external UI dependency, font family beyond the existing Manrope, or new icon
package is introduced. The search button uses inline SVG and an accessible name.

Validation: Node regression suite and structural style/isolation test. Browser tool
timed out; desktop/mobile screenshot review and interactive QA remain outstanding.
Do not describe the design as visually verified. Keep local for user preview before
publishing. Admin redesign is the next pass, not part of these storefront files.

Follow-up: after the user's instruction to publish immediately, storefront and
admin design were published on 21.10.2026. The next design pass extends the opt-in
stylesheet to articles.html/article.html, brings recommendation/article cards
into the same visual system, and adds a shared static footer to the five store
pages. Recommendation selection, recent-history storage, article rendering,
checkout and administration logic are unchanged. Footer links only use existing
catalog, article, delivery and warranty destinations; no new business claims or
contact details are introduced. No new photos are added.
