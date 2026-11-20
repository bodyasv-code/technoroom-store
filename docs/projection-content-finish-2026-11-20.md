# Projection content completion, 20 November 2026

Four-card continuation of the 16 November batch. Fresh production snapshots were read before preparation. Operation `projection-content-finish-20261120` changes content only, with full-row private backups, exact identity and content checks, one transaction, and a guarded recovery script. Earlier review enrollments remain intact.

- Optoma HZ147X / E3P7PK1E123: five product views from its official gallery.
- Optoma HZ151X / E3P7PR1E113H: six product and remote-control views from its official gallery. Lifestyle scenes, OMS badges and duplicate reflection views are excluded.
- Elite Screens T120UWH: manufacturer illustration bound to variation 23300, black / 120-inch / 16:9, becomes the main image. The existing exact-model dimensional drawing stays second. This is a series illustration, not a photograph identifying an individual physical unit.
- ViewSonic PA503S / VS16905: 3800 lm and a matching Ukrainian description. The owner-supplied MTI price has GTIN 766907904710; the manufacturer's 1 April 2024 document associates that exact UPC with PA503S at 3800 lumens. The current 4000-lumen version uses another UPC. Brightness is recorded in lm as stated by the UPC-specific source, without adding an unsupported measurement standard. The new brightness field and description are protected from supplier imports.

Sources and image hashes are in `projection-content-finish-plan-20261120.json`. Optoma's public product page exposes its gallery endpoint and exact model request; files were downloaded without authentication and visually inspected. The Elite Screens product page embeds the exact variation-to-image association. The image service permits only the twelve newly reviewed URLs on these domains, rather than trusting entire manufacturer hosts.

One unresolved source conflict remains: Acer S1386WH / MR.JQU11.001 / GTIN 4713883722711. The [same official part page](https://www.acer.com/si-en/projectors/classroom/pdp/MR.JQU11.001) states 3600 lm in the summary and 4000 ANSI lumens in the detailed table. MTI's supplied price says 4000 lm. An older manufacturer-authored datasheet says 3600, so matching the part number or GTIN alone does not resolve the revision. The Acer card remains unchanged; brightness requires manufacturer clarification tied to the supplied revision. Structured evidence: `projection-content-unresolved-20261120.json`.

ViewSonic identity source: [manufacturer document, page 4](https://www.viewsonic.com/media/wysiwyg/pdfs/US_MSRP_040124.pdf). Elite Screens variation: [black 120-inch 16:9](https://elitescreens.com/products/tripod-series/?attribute_pa_color=black&attribute_pa_size=120-169). Optoma: [HZ147X](https://www.optomaeurope.com/product/hz147x), [HZ151X](https://beta.optomaeurope.com/product/hz151x).

Validation includes actual PostgreSQL execution and recovery, cancellation of the whole batch when the last card is stale, preservation of later commercial edits and earlier review records, protection against a later 4000-lumen supplier value, and strict image URL checks. No price, stock, visibility, warranty or supplier-offer changes are included.
