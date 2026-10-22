# Proposed Merchant shipping groups — 2026-10-22

Read-only analysis of the current 555-item public feed. No product updates, feed labels, shipping prices or Merchant settings were changed. Utility: tools/plan-merchant-shipping.mjs. Tests cover explicit package gross weight, unit conversion, missing fields, master-carton exclusion, multipacks and volumetric/oversize logic.

| Proposal | Products | Decision |
| --- | ---: | --- |
| compact_2kg | 22 | Candidate only; verify outer protective packaging, carrier route, declared value and extra costs |
| medium_10kg | 0 | No sufficiently documented candidates in this snapshot; not proof none exist |
| large_30kg | 0 | No sufficiently documented candidates in this snapshot; not proof none exist |
| oversize_review | 3 | Separate carrier acceptance/price review; longest dimensions 260–345 cm |
| needs_data | 530 | 529 without explicit individual-package gross weight; 1 with gross weight but missing package dimensions |

The 22 compact candidates are product IDs 3782, 3792, 3816, 3821, 3823, 3836, 3844, 3845, 3848, 3869, 3874, 3886, 3892, 3894, 3896, 3898, 3899, 3900, 3902, 4003, 4033, 4036. Dimensions are supplier packaging data, not certified outer shipping-box dimensions. Never use the much heavier master-carton gross for one sale unit, or treat bare/net device weight as shipping weight. Some goods may require special packaging/transport review independently of size (for example batteries).

Oversize candidates:
- ID 710 / 2EFIX150D: 22 kg gross, 345×22×14 cm, volumetric 26.565 kg.
- ID 711 / 2EFIX120D: 17.5 kg gross, 285×22×14 cm, volumetric 21.945 kg.
- ID 712 / 2EFIX108D: 15.9 kg gross, 260×22×14 cm, volumetric 20.02 kg.

Volumetric estimate uses length×width×height in cm / 4000 and the larger of actual and volumetric weight. Dimensions over 120 cm are flagged for review rather than quoted automatically. This is NOT a carrier quote or confirmation of acceptance.

There are 21 items individually priced at or above 50000 UAH in the live feed. This overlaps the physical groups (one compact candidate is above threshold) and is not an extra group to sum with the table. Basket aggregation/discounts must also be considered when applying the approved free-shipping threshold. A price threshold alone does not determine delivery cost.

Conclusion: do not activate a blanket 150 UAH shipping estimate based on this incomplete dataset. Even compact items need complete cost/declared-value checks; no value was invented. Obtain supplier outer-package weights/dimensions or representative actual invoices, then approve rates by group. Unknown items stay on the website and in the existing feed for now; this analysis does NOT authorize removing the 530 unknown items or launching paid ads.

Existing approved website policy remains carrier tariffs below 50000 UAH, free shipping from 50000 inclusive, total estimate 2–7 working days. Merchant still requires corresponding numeric costs for the paid portion. No site policy was changed by this analysis.
