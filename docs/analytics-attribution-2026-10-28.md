# Limited campaign attribution and conversion cleanup — 2026-10-28

## Implemented, pending publication

`analyticsPage()` now appends only a restricted set of campaign parameters to its
otherwise sanitized page URL, which is already used for config and measured events.

- Exact-case gclid, gbraid and wbraid: one value, 10–512 URL-safe characters,
  containing at least one letter. This validates syntax, not real ad-click identity.
- UTM source and medium must both match explicit code allowlists.
- UTM campaign accepts numeric IDs (1–20 digits, nonzero first digit) or one of six
  reviewed category slugs. UTM ID accepts numeric IDs only.
- Arbitrary campaign names, utm_term, utm_content, search text, contacts, tokens,
  duplicates and other URL parameters are not copied. Never put personal data in
  campaign fields; syntax validation cannot prove an opaque identifier's meaning.
- Nothing is added to site links or stored by this code; the Google tag continues
  to handle attribution under the existing consent signals. No custom attribution
  cookie or cross-page ID persistence was added. Internal navigation emits its own
  clean URL without invented campaign parameters.

Consent record advances to v3, with disclosure of referral/campaign measurement.
Old valid refusals remain denied. Old grants are not silently expanded: a new grant
is required. No Google script before grant, no advertising-storage/user-data grant,
no personalization activation, no false purchase or replay of old events.
All nine storefront HTML entries reference the new analytics version.

This fixes removal of these fields from the submitted page context. It does not
certify Google Ads attribution: real click attribution remains subject to consent,
SDK behavior, account configuration and subsequent live validation. The existing
denied advertising signals can limit ad measurement. No consent signal was widened.

## Google Ads cleanup executed

Account TECHNOROOM `629-538-0174`:
- Legacy manually configured website conversion `Покупка`, ID `7865646647`,
  secondary, never received data, not in account goals: changed from ENABLED to
  REMOVED using the individual status selector. UI confirmed removed row/red icon.
- GA4 `TECHNOROOM (web) purchase`, ID `7865937597`, remained enabled and primary.
- No campaign, budget, bidding, value, primary conversion or account-link changes.
- Screenshot: `../google-ads-old-conversion-archived-2026-10-28.png`.
- Recovery: All conversion actions → status All/Removed → old action status Enabled.
  This is Google's reversible archive, not permanent deletion of historical data.

## Verification

Full serial suite passed: 141 tests, no failures or skips. Five new attribution
cases cover exact-case retention, approved fields, malformed/duplicate/free text,
host/page isolation, consent renewal, no custom ID persistence and prior refusals.
Existing analytics and commerce tests continue to verify consent, amounts, order
success/failure, duplicate purchase handling and absence of contact data.
Production receipt of new campaign parameters must be verified after publication.

Sources checked:
- https://developers.google.com/analytics/devguides/collection/ga4/reference/config
- https://support.google.com/analytics/answer/11259997?hl=en
- https://developers.google.com/tag-platform/security/guides/consent
- https://support.google.com/google-ads/answer/10918269?hl=en-GB
