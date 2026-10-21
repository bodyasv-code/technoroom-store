# Google Merchant product feed

Public read-only URL: https://www.technoroom.com.ua/google-merchant.xml (rewrite to /api/merchant-feed). RSS 2.0 with Google namespace, UTF-8. No Google account writes, feed registration, Ads campaign or budget changes are performed by this implementation.

Uses current products/categories/promotions/promotion_products, stable ordered 500-row pagination with a hard limit and a response-size guard. Explicit storefront column selection; no supplier prices, contacts, customers or orders. Generic no-store 503 on partial read failures, empty eligibility or oversized response; no silently truncated successful file. GET/HEAD only. Five-minute shared cache, must-revalidate, no stale-while-revalidate. Google polling is separate from server regeneration (the selected Merchant UI schedule was daily).

Initial scope: active, visible category and ancestors, positive price/current discounted price, in_stock and positive stock quantity, not under_order; nonempty title/description/brand; uploaded raster main image. Remote-image proxies, unavailable/inquiry-only goods, placeholders and missing-photo products are excluded for this first launch. This is intentionally not the whole catalog. Stock quantities, promotions, specifications and unpublished data are not dumped into the feed. Only explicit checksum-valid GTIN or explicit manufacturer MPN specification fields are exported as identifiers. Supplier/internal SKU is never relabelled as MPN. Unknown identifiers are omitted, NOT falsified with identifier_exists=no. No fabricated weights, dimensions, shipping fee, Google category IDs or grouping IDs. New condition follows the user-confirmed new-goods store policy.

Pricing reuses store-pricing.js, including dated/sorted/linked/parent-targeted promotions; base price and actual lower sale_price are exported. Product links use the actual variant numeric ID and canonical www domain. Clean technical descriptions reuse the dealer-content policy; markup is stripped and XML controls/entities escaped. Storage filenames are percent-encoded; no arbitrary upstream URLs are fetched during generation.

Read-only live audit before deployment: 3031 active products read; 563 included; 2300 not orderable, 160 no uploaded main image, 6 missing title/description/brand, 2 invalid/nonpositive current price. Output 539256 bytes at audit time. All 563 candidates lack explicit GTIN/MPN specification fields. This requires manufacturer identifier enrichment/verification before claiming feed quality or eligibility; do not copy arbitrary supplier SKU or set identifier_exists=no to hide the issue. Counts can change with inventory/promotions.

Remaining launch gates: confirm actual shipping prices (user entered 100 UAH as a temporary placeholder), correct/confirm the Merchant delivery speed shown as 0–1 days against handling 1–2 days plus transit; verify legal business details/address; check current image resolution/content/availability and landing-page rendering for included products; enrich identifiers; review Merchant diagnostics after controlled submission. Photo existence is NOT evidence of Google-compliant image dimensions or a guaranteed matching photo. No claim that all products will be approved. No paid launch authorized.

Official references checked 2026-10-21:
- https://support.google.com/merchants/answer/7052112
- https://support.google.com/merchants/answer/11586438?hl=en
- https://support.google.com/merchants/answer/12577710

Verification: tests/merchant-feed.test.mjs covers pagination beyond 1000 rows, promotion parity, visibility/stock/photo/content gates, XML escaping, checksums, explicit identifier-only handling, no fabricated logistics, failure safety and routing. This is source-level QA, not browser/device or Merchant approval.
