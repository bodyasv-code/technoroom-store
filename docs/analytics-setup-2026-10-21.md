# Google Analytics — basic consent and page views

User supplied measurement ID G-L3NG1R28PY (web stream TECHNOROOM — сайт) and confirmed Enhanced Measurement was disabled in the GA UI. Never add a Measurement Protocol secret or private credentials to frontend code.

Implemented on home, catalog, product, articles, article and checkout only:
- Basic opt-in: no external Google script/requests are initiated by our integration until explicit consent, including saved and still-valid consent.
- Equally styled Allow/Reject buttons; optional explanation, Google privacy link and persistent settings launcher at the bottom of each page. This explanation is not a replacement for a complete merchant privacy policy.
- Versioned 180-day local consent record, default-deny for corrupt/expired/unavailable storage, cross-tab choice updates.
- Revocation sets the GA global opt-out flag and clears only _ga and this stream's _ga_* cookie across expected production domains. It does not remove previously collected data from Google; it leaves carts/authentication alone. The already-loaded SDK remains in memory, disabled until re-opt-in.
- Default consent denies analytics and all advertising storage/use, then grants analytics only after opt-in. Google signals and ad personalization disabled.
- One manual page_view per page load; default config page_view disabled. No form listeners, input reads, purchase, cart or lead events added in this phase.
- Only known production pages; location retains product numeric ID / category slug / article slug. Search, tracking, arbitrary query parameters and fragments removed. Referrer reduced to origin; page title is a known generic label. Campaign UTM attribution is intentionally deferred until a safe explicit scheme is implemented.
- Analytics integration excluded from admin, authentication and cleanup tools, and not activated on local/preview domains.

Tests: mock script injection, commands, no pre-consent/rejected load, stored consent, expiry, storage failures, revocation/cross-tab sync, no duplicate page_view, sanitized location/referrer, page inclusion/exclusion, existing full suite. These tests do not execute Google's SDK or prove live receipt. Browser UI test attempt failed with cua.getState timeout; actual visual, network and Realtime validation remain pending user verification.

Next: user opens production site, chooses Allow, navigates a page and checks GA Realtime. Ad blockers/consent refusal prevent measurement by design. Then implement confirmed-order and cart events with no contact data, independently tested without placing real orders.

Search Console: user screenshot confirmed sitemap successfully processed, 3165 discovered pages; this is not a guarantee of indexing.
