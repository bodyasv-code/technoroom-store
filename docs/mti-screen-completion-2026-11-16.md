# Screen content protection and remaining galleries

Scope: the 13 reviewed MTI projection screens, without changing prices, quantities, descriptions, specifications or publication state.

- Added private, field-level review enrollment: 45 previously checked specification keys and 13 descriptions. Unverified fields, including the legacy ELPSC26 viewing-angle and overall-size entries, remain outside the new protection.
- Whole-table protection for earlier Canon/UPS reviews remains unchanged. Import writes reject changes to protected content; direct manual edits remain available. The import planner, comparison, description review and bulk enrichment respect the derived protection markers.
- Fixed editor round trips so unchanged array/numeric specification values retain their JSON types. This matters for the multi-aspect ELPSC26.
- OMS100H2 now uses the assembled screen from its exact manufacturer B2B product page; its dimensional drawing and existing carrying-bag photo remain in the gallery.
- T120UWH now has the manufacturer drawing labelled with the exact SKU. This is a diagram, not a clean product photo. Generic 4:3 photos on that 16:9 model's page were rejected.
- Images use direct manufacturer URLs. The shared PlentyONE CDN is permitted only for the three exact reviewed files, not the entire domain or other tenants. Browser file transfer to Storage did not complete; the cards do not depend on those attempted uploads.

Manufacturer pages: [T120UWH](https://www.elitescreens.biz/a_210_1507/), [OMS100H2](https://www.elitescreens.biz/a_224_1591/). The manifest records the sources for the earlier checks.

Database upgrade: `supabase/reviewed-content-guard-upgrade.sql`.
Executed batch: `supabase/mti-screen-protection-20261116.sql`.
Private backup: `technoroom_maintenance.product_repair_backup`, operation `mti-screen-protection-20261116`, 13 rows.
Guarded recovery: `supabase/restore-mti-screen-protection-20261116.sql`. It preserves later commercial changes and aborts if reviewed content or images changed subsequently.

Validation: 44 related tests passed, including actual PostgreSQL batch execution and rollback, stale-batch cancellation, compatibility with existing full-table reviews, preserved commercial values, manual editing, client-marker forgery rejection, source restrictions and specification type round trips. After cache-version updates, three affected packaging/UI/comparison checks passed again. This was a targeted run; the previously reported two unrelated full-suite failures were not changed.

Remaining content quality issue: obtain a clean, exact T120UWH photo. The diagram is an interim main image; this hidden draft was not published. Other hidden screen drafts also remain hidden.
