# Canon 075 / 075H content pilot

Plan prepared 2026-10-27; final verification continued 2026-10-28 (Europe/Kyiv).
Operation identifier remains `canon-075-content-20261027`.

## Exact manufacturer evidence

| ID / SKU | Series | Printing color | Declared resource | Primary source |
| --- | --- | --- | --- | --- |
| 4903 / 6365C002 | 075 | Black | Up to 1400 pages | [Canon](https://www.canon.co.uk/store/store/canon-075-black-toner-cartridge/6365C002/) |
| 4904 / 6364C002 | 075 | Cyan | Up to 1300 pages | [Canon](https://www.canon.co.uk/store/canon-075-cyan-toner-cartridge/6364C002/) |
| 4905 / 6369C002 | 075H | Black | Up to 3500 pages | [Canon](https://www.canon.co.uk/store/canon-075-h-high-yield-black-toner-cartridge/6369C002/) |
| 4906 / 6368C002 | 075H | Cyan | Up to 2500 pages | [Canon](https://www.canon.co.uk/store/canon-075-h-high-yield-cyan-toner-cartridge/6368C002/) |

Each individual manufacturer's SKU page lists compatibility with Canon i-SENSYS
MF664Cdw, MF667Cdw, LBP646Cdw and LBP647Cdw. Standard and high-yield capacities
were not generalized across colors. No copied marketing prose, new photos,
regional commercial promises, ISO testing method or toner volume was imported.
The existing descriptions (including their supplier-provided 5% wording) were
retained; that wording was not independently certified by these four sources.

## Production writes already completed

`apply-canon-075-content-20261027.sql` succeeded for exactly four previously
empty tables. Each card received seven fields: consumable type, cartridge
series, printing color, declared resource, standard/high-yield capacity,
compatible brand and compatible devices.

Four complete pre-change rows were saved in the protected maintenance backup
table. Four exact ID/SKU/brand review records enable the existing database
import guard. Public REST verification confirmed all seven fields, unchanged
descriptions and `verified_specifications=true` on every card.

The transaction compared complete rows to preserve names, categories,
descriptions, prices, stock, media, publication and unrelated metadata (except
normal updated_at and the intended protection flag). A stale card or unexpected
trigger side effect rolls the whole group and its backups back.

Executed `verify-canon-075-content-20261027.sql` in production: attempts to add
an import field were rejected on all four cards; a commercial update was
permitted; all four backups and review records were present. The transaction
rolled back all test writes and returned:
`Four cartridge guards, commercial updates and backups passed; test writes rolled back`.

## Display defect discovered during live verification

The database contained the complete compatibility list, but the storefront
silently discarded any specification value containing `;`, treating it as code.
This hid valid compatibility lists and could hide interfaces or other ordinary
technical lists. `hasSpecificationCode` now distinguishes a separator from
recognizable CSS/code fragments. Existing HTML-to-text handling and escaped
rendering remain in place.

Cartridge type/series/capacity belong to general facts, printing color/resource
to printing, and compatible devices/brand to a dedicated compatibility group.
Printing color is no longer grouped as a body/power property.

## Validation and recovery

The initial complete suite passed 126/126. New checks cover exact yields,
identity/category/manual protections, full-row preservation, atomic batch
failure, importer rejection, and restoring content without overwriting new prices
or subsequent manual edits. A separate regression check covers semicolon lists,
CSS/code rejection and the complete compatibility rendering path.
After the display correction, the complete serial suite passed 127/127; the
focused display test passed again after narrowing code detection to avoid
mistaking ordinary document URLs or color text for executable code.

Prepared plan: `canon-075-content-plan-2026-10-27.json`.
Recovery: `../supabase/restore-canon-075-content-20261027.sql` restores only the
four specification tables, preserves commercial/media fields and the import
guard, and refuses later content/provenance edits. It does not remove enrollment.
Do not rerun apply SQL or regenerate the before snapshots against production.

No other categories or product rows were modified.
