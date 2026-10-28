# Google Ads / GA4 conversion audit — 2026-10-28

Initial read-only continuation of the existing analytics setup. No campaigns, budgets,
conversion goals, account links, consent settings or orders were changed.

## Confirmed in source

- Measurement stream: `G-L3NG1R28PY`.
- `add_to_cart` follows successful cart save, before cart rendering.
- `begin_checkout` requires a nonempty hydrated orderable basket.
- `purchase` follows successful `/api/orders` and requires a numeric server order ID.
- Purchase value is derived from captured item prices and quantities, currency UAH;
  transaction ID is `TR-{orderId}`. It measures accepted orders, not payment receipt.
- Same-page/session duplicate purchase suppression exists. Delivery to Google is not
  guaranteed by entering an event into the gtag queue.
- Analytics requires explicit consent; advertising storage, user data and
  personalization remain denied. No direct AW conversion ID or GTM container is
  embedded in the checked storefront source. Account-side Google tag destinations
  and GA4-to-Ads imports cannot be inferred from this absence.
- Targeted tests `store-analytics.test.mjs` and `store-commerce.test.mjs` passed.

## Attribution finding requiring follow-up

`analyticsPage()` deliberately retains only product/category/article identifiers
and sets that cleaned `page_location` for config and events. It removes gclid,
UTM parameters and other query values; referrers retain only their origin.
This was an explicit privacy limitation in the original implementation, not a new
regression. It may limit campaign attribution. No claim of actual lost conversions
is possible without network and account-side validation. Do not simply send the
entire URL: preserve the existing exclusion of search text, contacts and tokens.

Relevant Google documentation checked:
- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://support.google.com/analytics/answer/9379420?hl=en
- https://support.google.com/google-ads/answer/10632359?hl=en-GB

## Live account verification after user sign-in

The in-app browser now responds and the user signed into Google themselves.
No credentials were read or entered by the agent. Existing Chrome access has not
been demonstrated by this recovery.

- GA4 property TECHNOROOM: `559863877`, account `42064239`.
- Event report for 2026-09-30 through 2026-10-27: 340 events, 3 users;
  add_to_cart 3, begin_checkout 14, purchase 1, purchase revenue 37,765 UAH.
  This proves receipt, not whether the order was genuine/test, paid or fulfilled.
- Home report showed 22 tagassistant.google.com referral sessions in its last-seven-
  day view. These small numbers cannot be treated as representative customer traffic.
- Two completed Google Ads links exist: `292-569-5727` and TECHNOROOM
  `629-538-0174`. Personalized advertising is disabled for both links.
- TECHNOROOM link was created 2026-10-23. Ads auto-tagging checkbox is enabled.
- TECHNOROOM Google Ads campaign is paused; overview showed 0 impressions and
  0 clicks in displayed 2026-10-23–27 period. No ad activation was performed.
- All-conversions list (all statuses) contains two actions:
  - `TECHNOROOM (web) purchase`, conversion ID `7865937597`, source GA4,
    primary and included in account goals, count every conversion, 90-day click
    window, status awaiting conversions, zero Ads-attributed conversions.
  - `Покупка`, source website, secondary and not included in account goals,
    count every conversion, 30-day click window, misconfigured, zero conversions.
- Imported purchase uses GA4 event `purchase` in property TECHNOROOM, values and
  currency from GA4, fallback 1 UAH, data-driven attribution for Google paid channels,
  3-day engaged-view window. Created 2026-10-23.
- Ads status explicitly says lack of conversions may be related to inactive campaigns.
  GA4 receiving one purchase is not evidence that Ads must attribute it to an ad click.
- Account settings unexpectedly displayed call-recording terms. No terms were
  accepted; the decline path opened a destructive confirmation, which was backed
  out of, and Escape closed the terms. No deletion or call-setting change confirmed.
- Auto-tagging was inspected without toggling it; Cancel closed that editor.
- Screenshot saved outside repo: `../google-ads-purchase-audit-2026-10-28.png`.

## Pending account checks

1. Confirm the observed purchase transaction against its real order when appropriate;
   receipt and revenue are confirmed, individual transaction parameters not yet inspected.
2. Decide whether to retain, repair or retire the old secondary website action.
   Do not promote it alongside the primary GA4 purchase or duplicate new imports.
3. Validate campaign attribution using a controlled consented visit; do not click
   paid advertisements or send a fictitious purchase to production analytics.
4. Any real test order requires separate explicit authorization and a cleanup plan.

## Follow-up authorized by user

Legacy action 7865646647 was subsequently archived reversibly; primary GA4 action
7865937597 remains enabled. Limited landing attribution and consent-v3 changes are
implemented and tested locally, pending publication. See
`analytics-attribution-2026-10-28.md` for exact scope, recovery and validation.
