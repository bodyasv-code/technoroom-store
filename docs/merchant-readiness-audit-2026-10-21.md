# Read-only Merchant readiness audit — 2026-10-21

## Follow-up completed

EAN key recognition was authorized, fixed and published as a43a5c7. Live public feed verified HTTP 200, 563 items and 23 GTIN entries (540 items still without explicit identifiers). Added alias, invalid-checksum, multiple-value and conflict regression tests. No database identifier writes or SKU-to-MPN guessing.

The initial image counts below are superseded by a sequential recheck with throttling and rate-limit backoff. All 563 image URLs responded successfully during that run. Header parser read 562; the remaining Samsung AVIF (ID 439) was separately decoded in memory with Pillow: 1368×1094, 46159 bytes. Final counts: 288 at least 500×500, 267 at least 100×100 but below 500, 8 below 100 in one dimension, zero unresolved. Thus prior HTTP 429 results were not missing images. No photo was edited, replaced, uploaded or deleted. See merchant-image-recheck-2026-10-21.json for evidence.

Current sub-100 images requiring better originals or an approved feed exclusion:

| Product ID | SKU | Dimensions |
| --- | --- | --- |
| 4960 | 5219B001 | 128×24 |
| 4961 | 5216B001 | 128×24 |
| 5350 | C13T41E540 | 100×76 |
| 5351 | C13T41E240 | 100×76 |
| 5352 | C13T41E34N | 100×76 |
| 5353 | C13T41E440 | 100×76 |
| 6018 | 008R13036 | 112×84 |
| 6039 | 008R13065 | 114×55 |

The user subsequently approved temporary feed-only exclusion of the eight sub-100 products above. Implemented an exact ID+SKU hold list in server/merchant-feed.js; no catalog visibility, availability or image was modified. Expected initial feed size after publication: 555 (563 minus 8). Holds do not automatically clear on image_path changes: verify the new image and explicitly remove the hold after replacement. Regression tests cover all eight, exact scope and no product mutation. Image identity/watermarks and full manufacturer identifier matching remain separate review tasks.

Scope: 563 currently included feed products (3031 active catalog records). No production catalog edits, identifier writes, photo replacement or Merchant account changes. Added a local read-only inspection utility tools/audit-merchant-feed.mjs; source dimensions checks for PNG and JPEG passed. Images were read in memory with bounded byte ranges, not saved to disk. This is NOT a visual correctness/watermark/product-identity audit.

## Image header results

563 unique main image URLs inspected. Dimensions readable for 455:
- 248 at least 500×500 pixels.
- 206 at least 100×100 but below 500 in one or both dimensions.
- 1 below 100 in at least one dimension.
- 108 unresolved checks: includes storage HTTP 429 rate limiting and an AVIF whose dimensions the utility does not parse. Do NOT call these missing or broken images. No further bulk retry was made after the completed run; retry at a lower rate/back off before drawing availability conclusions.
- No >16MB image was found among successfully dimension-read images. This does not certify undecoded images.

Google currently permits minimum 100×100 for non-apparel until 2027-01-31; the announced minimum becomes 500×500 on that date. Thus below 500 is a future readiness concern, not automatically a current rejection. Quality and product identity remain unverified.
Sources: https://support.google.com/merchants/answer/12159030?hl=en and https://support.google.com/merchants/answer/6324350?hl=en .

## Identifier findings

The live feed omits GTIN/MPN for all 563 products. A broader read of existing specifications found 23 `EAN Код` values with valid GTIN check digits. Current feed identifiers() does not accept that key spelling, so the earlier statement that there are no identifiers in the data was too broad. These are existing identifiers missed by the parser, not new codes to invent. Correct checksum does not prove the code matches the specific variant: product/packaging matching remains a separate verification.

Other fields: one `Артикул` and two `Штрих-коди`; do not blindly relabel these as manufacturer MPN or split multiple codes without matching the exact product/variant/pack size. Supplier SKU must not be universally copied into MPN.

One primary-source spot check: Epson EF-72 SKU V11HB76642 matches an official Epson manufacturer product page https://www.epson.com.tr/projectors/home/entertainment/lifestudio-flex-plus-ef-72-v11hb76642 . This is a candidate verified manufacturer code for that one product only, not evidence for all supplier SKUs or GTINs. Google MPN guidance: https://support.google.com/merchants/answer/6324482?hl=en .

## Recommended next work (not implemented by this audit)

1. Fix feed recognition of `EAN Код` with checksum and ambiguity regression tests; review exact variant matching before relying on codes.
2. Recheck unresolved photos slowly with retry/backoff, and decode AVIF with a supported decoder. Identify/remediate the sub-100 image; plan higher-resolution originals for the 206 others without artificial upscaling as a substitute for detail.
3. Enrich genuine MPN/GTIN by manufacturer evidence, starting with a controlled subset, never guessing identifiers or setting identifier_exists=no to hide missing data.
4. Review actual 100 UAH shipping and 0–1-day Merchant estimates before Google submission; they were not validated by this audit.

No production deployment required for this report. Merchant approval cannot be guaranteed from source checks or image dimensions alone.
