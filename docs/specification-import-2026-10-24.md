# Specification import safeguards — 2026-10-24

Root cause: the importer parsed both table rows and their flattened text, then split descriptions on every semicolon. This produced labels such as `кол.` and unclosed `Копір (швидкість`. Repeated keys silently overwrote values. Broad resolution matching mixed scan-specific and general resolution fields.

Changes apply to future import previews/writes, not a database-wide rewrite:
- Process structured HTML table cells once, preserve word boundaries at HTML breaks.
- Parse only bounded label/value records in prose; retain ratios, URLs, times and semicolons within parentheses.
- Reject fragment labels and flattened multi-field paragraphs. Original supplier prose remains available in the description/source; do not invent replacements.
- Strip markup from incoming structured attribute text, retaining zero and false.
- Keep conflicting values with distinct suffixes and require explicit import review.
- Preserve qualified scanning resolution labels.
- Flag suspect existing values under `Перевірити характеристики` without deleting them.
- Existing manual-field protection and write confirmation remain unchanged.

Read-only public catalog audit: 3027 active products, 421 candidates. 171 have malformed/fragment labels, 185 contain HTML, 157 contain flattened fields; groups overlap. These are review candidates, not 421 proven erroneous products. Hidden products were not included in the public read.

No product rows, prices, stock or descriptions were modified by this task. Bulk cleanup requires a separate preview and approval. In particular, a malformed label may contain useful data and must not be blindly removed.

Node regression tests pass. A local browser fixture is available at `/specification-check` using scripts/preview-admin-sidebar.mjs. Interactive browser QA was blocked by two browser connection timeouts; do not represent the fixture as visually verified.
