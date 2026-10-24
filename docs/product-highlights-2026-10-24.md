# Product highlights — 24.10.2026

Presentation-only summary near the price, below existing purchase controls. Maximum six entries, with profiles for projectors, printers/MFPs, projection screens and a conservative generic fallback. A summary with fewer than two eligible fields is omitted.

- Uses existing display specification entries; does not infer or manufacture specifications.
- Entire topics with conflicting aliases are excluded rather than selecting one candidate. Unknown, placeholder, long, markup-like or supplier-fragment values are not promoted.
- Brightness is deliberately not summarized while measurement standards remain ambiguous. Processor/memory fields are not selected by these profiles.
- Complete Laser/Лазер type aliases can agree; RGB/LED/laser hybrid details are not collapsed into a generic type.
- Source labels retain units; scanner resolution is not treated as a printer's main resolution.
- Explicit link to the existing full specification section; full table remains unchanged.
- Two-column responsive list, one column under 380px; existing purchase/inquiry buttons remain above the summary.
- No database writes, commercial-data changes, messages, test orders or new inquiry workflow.

Verification: pure selector/escaping/integration tests, app syntax check, local Chrome with product 439 (six rows) and HP 178nw / 4530 (five rows), 390 × 844 mobile iframe visual check, and full-table link navigation. Desktop product page has no horizontal overflow. The responsive preview is not a physical-device certification.
