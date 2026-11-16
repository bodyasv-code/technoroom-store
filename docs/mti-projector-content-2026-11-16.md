# MTI projection content batch, 16 November 2026

Baseline: all 94 rows of the owner-supplied MTI 41007 projection price. Live database matched 93 distinct cards by brand and exact part number or existing supplier link; no ambiguous matches. The absent BenQ `9H.JNF77.1JE` remains a deferred import, not a new automatically published card. Content gaps were found on 16 cards. The existing Acer S1386WH / ViewSonic PA503S brightness disputes remain excluded.

Prepared batch: 14 cards, 36 specification fields, 13 Ukrainian descriptions, 11 manufacturer photos. Sources, before-values and image hashes are in `mti-projector-content-plan-20261116.json`. Photos were visually reviewed together; they show the products, not generic series illustrations. BenQ's own TK700 page serves an asset named `tk700i-right30`; its provenance is that exact manufacturer product page. The sources use direct URLs; the image service permits only the exact reviewed files on the new manufacturer domains.

Confirmed corrections:
- Epson EB-815E / V11HA99180: native 1920 × 1080 and separate 4K Enhancement, rather than native 4K UHD. Name and description distinguish them. Manufacturer page identifies this exact part number.
- BenQ MX560C / 9H.JTE77.1NE: 4:3 and throw ratio 1.96–2.15, replacing 16:10 and 1.55–1.7 copied from the wrong variant. The official current specification page and manual take priority over the inconsistent older Indonesian datasheet. Existing description contains the same errors and is replaced.
- Optoma brightness keeps ISO units; BenQ and ViewSonic keep ANSI units. No conversion between the standards.

Database operation: `mti-projector-content-20261116`. SQL uses one transaction, private full-row backups, locked exact identities and content snapshots, field-level review enrollment, and post-write checks of every unrelated column. Prices, inventories, publication, warranties and supplier offers are preserved. Recovery script checks the repaired content and preserves later commercial edits.

Checks: 11 targeted tests passed, including actual PostgreSQL execution/recovery of the 14-card SQL, stale last-card cancellation of the entire batch, protection from a later supplier's 4K value, compatibility with earlier full-table reviews, and exact image-URL restrictions. Both image API files pass Node syntax checks.

At preparation time, browser access to MTI was rejected by automatic approval review because of the account usage limit. No alternate method was used to obtain the blocked browser page. Unauthenticated initial HTML returned only the catalog shell, without exact product content, and was rejected as evidence. Manufacturer sources were consulted separately.

Remaining: exact HZ147X/HZ151X photos; the two brightness disputes; deferred BenQ import; a clean T120UWH product photo instead of the temporary manufacturer diagram. The existing GP520 description is preserved. Other fields not explicitly included in this batch have not been reverified.

Deployment and production application: pending verification.
