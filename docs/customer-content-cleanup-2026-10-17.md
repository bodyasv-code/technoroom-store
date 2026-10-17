# Customer-facing product content cleanup — 2026-10-17

Owner requested removal of confidential distributor/dealer notices across all products and automatic Epson print-technology defaults.

## Applied safeguards

- Shared content policy removes clearly identified dealer-only program/promotion blocks from descriptions and specification keys/values. It does not treat ordinary consumer promotions, authorized-service references or document-security features as dealer notices.
- Customer storefront rendering, manual product saves and supplier description/specification import paths apply the policy. Existing imported specifications are sanitized when merged as well.
- Epson inkjet defaults fill only missing print technology on printer/MFP device records. Existing explicit technology is retained. Scanners, projectors, consumables, matrix families (FX/DFX/LX/LQ/DLQ/PLQ), thermal POS families and laser/AcuLaser/EPL evidence are excluded.
- Epson matrix exception verified against [FX-890IIN](https://www.epson.eu/en_EU/products/printers/dot-matrix/fx-890iin/p/21462) and [LQ-350 specifications](https://support2.epson.net/manuals/english/sidm/lq_350/useg/html/apspe_2.htm).
- No raw confidential descriptions or backups were committed or exported. Restoration, if ever needed, requires the owner's original source or database backup.

## Live cleanup

Authenticated admin scanned all 5195 product records, including hidden products. Initial plan: 182 affected records, of which 181 contained dealer-only notices; 3 missing Epson technology values were filled (overlap with cleanup records).

Applied 60 records, then the server rejected an overly long comparison URL. No retries were performed blindly. Read-only diagnostics confirmed that including an unchanged description lengthened a successful 17 KB specifications-only comparison into a rejected 29 KB request.

The writer now compares only fields it actually updates, plus product ID and SKU. This retains compare-and-swap protection for written content without filtering on unrelated unchanged descriptions. The remaining 122 records completed successfully through the admin's in-page confirmation dialog. A temporary GitHub network outage interrupted deployment of this fix; retry completed after connectivity returned.

Only descriptions/specifications were patched. Product names, prices, categories and photos were not modified by this cleanup. No raw content backup was created, to avoid duplicating confidential material.

## Verification

- All 38 test files pass, including negative/positive content classification, retained consumer copy, Epson exceptions, import protections, idempotence and field-scoped CAS filters.
- Re-read all 4814 publicly readable product rows: zero remaining dealer-policy matches and zero pending content/technology repair plans.
- Authenticated admin after reload: zero pending plans across all 5195 records; cleanup button hidden and DOM count zero.
- Reopened Epson SC-T5700DM, SKU C11CH82301A0 (owner screenshot example): dealer notice absent; technology is inkjet; other technical fields remain.
- Screenshot: `C:/Users/Bohdan/Documents/ChatGPT/Сайт/customer-content-cleaned-2026-10-17.png`.

Detection is rule-based for identifiable dealer-only text, not a guarantee that every possible future wording can be classified automatically. New supplier wording should be added to the policy with a regression test.
