# SEO foundation — phase 1

Live audit: robots.txt advertised the old Vercel sitemap. That sitemap returned 1002 URLs: home, catalog and only the first 1000 active products, all on the old hostname. Production redirects .html paths to extensionless paths.

Implemented:
- Fixed origin https://www.technoroom.com.ua and extensionless sitemap URLs.
- /sitemap.xml rewrite to the existing read-only endpoint; updated robots discovery URL.
- Removed obsolete public/sitemap.xml (3 old-domain links including admin), which shadowed the rewrite. Git retains this file for recovery.
- Ordered 500-row database pagination; active products, category hierarchy visibility and published articles.
- XML escaping, deduplication, no fabricated modification dates or priority claims.
- Short CDN cache; database failures produce 503, not a partial-success sitemap. Above 50000 URLs a sitemap index will be required.
- robots excludes both clean and legacy admin paths and checkout. This is crawl guidance, not access control or a guarantee of deindexing.

Tests use synthetic data above 1000 products, hidden parent category and unpublished article fixtures. No customer data, catalog records, credentials or advertising accounts are modified.

Still pending (not claimed completed): Search Console ownership verification and sitemap submission; Analytics property/data stream and measurement/consent setup; rendered page inspection including canonical/meta/Product markup; Merchant Center feed and policy readiness. User states neither Search Console nor Analytics is connected. Never invent verification or measurement IDs.
