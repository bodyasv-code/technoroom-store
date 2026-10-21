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

User screenshot subsequently confirmed live page_view receipt: 3 page views (home/catalog/product), 1 active user in the last 30 minutes.

## Ecommerce phase

- Consent key bumped to v2 and banner description updated to include cart/order measurement; previous v1 consent is not silently reused for the expanded data scope.
- add_to_cart is emitted after the actual Add action succeeds, with delta quantity 1 (not the entire current basket).
- begin_checkout is emitted once per page when nonempty, hydrated, orderable cart data is available; an analytics-ready event also handles consent granted while already viewing checkout.
- purchase is emitted only after successful /api/orders response with a valid server orderId. The submitted item/discount-price snapshot is captured before the asynchronous request; the existing server RPC rejects changed prices. It means an accepted order, not a paid or fulfilled order; cancellations/refunds/payment revenue reconciliation are not implemented.
- Numeric catalog item IDs, quantity and price only; currency UAH and integer-cent value calculation. Payload allowlist drops all extra properties including contact details. No product or customer names sent.
- begin_checkout deduplicated in memory; purchase deduplicated by TR-{serverOrderId} in memory/sessionStorage after enqueue plus GA transaction_id. No historical replay after consent and no guaranteed delivery under blockers/storage failures.
- Tests exercise actual checkout submit code with fake successful, failed, missing-ID and malformed JSON API replies. Saved orders still clear the cart even if analytics cannot record them. No real test order or Google purchase event sent by the agent.

Next: user accepts the revised consent, adds one item and opens checkout without submitting; verify add_to_cart/begin_checkout in Realtime. Confirm purchase on a genuine later order or an explicitly authorized test order. Quantity editing +/- and remove_from_cart are not tracked in this phase.

Search Console: user screenshot confirmed sitemap successfully processed, 3165 discovered pages; this is not a guarantee of indexing.
