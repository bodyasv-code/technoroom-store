# Canon 075 / 075H — magenta and yellow, executed 2026-10-28

Operation: `canon-075-magenta-yellow-20261028`.

| ID / exact SKU | Series | Printing color | Declared resource | Evidence |
| --- | --- | --- | --- | --- |
| 4907 / 6367C002 | 075H | Magenta | Up to 2500 pages | [Canon](https://www.canon.co.uk/store/canon-075-h-high-yield-magenta-toner-cartridge/6367C002/) |
| 4908 / 6366C002 | 075H | Yellow | Up to 2500 pages | [Canon](https://www.canon.co.uk/store/canon-075-h-high-yield-yellow-toner-cartridge/6366C002/) |
| 4909 / 6363C002 | 075 | Magenta | Up to 1300 pages | [Canon](https://www.canon.co.uk/store/canon-075-magenta-toner-cartridge/6363C002/) |
| 4910 / 6362C002 | 075 | Yellow | Up to 1300 pages | [Canon](https://www.canon.co.uk/store/canon-075-yellow-toner-cartridge/6362C002/) |

Each exact manufacturer's SKU page confirms MF664Cdw, MF667Cdw, LBP646Cdw and
LBP647Cdw compatibility. Added seven structured fields to each previously empty
table, using the same schema as the black/cyan group. Magenta is displayed as
`Пурпуровий (Magenta)` and yellow as `Жовтий`.

## Production outcome

The apply transaction succeeded for exactly IDs 4907–4910. Four complete original
rows were saved in the RLS-protected maintenance backup table, and four exact
ID/SKU/brand review records now protect the specification tables from importer
writes. Existing descriptions, names, categories, price/stock/media/publication
fields were preserved by the full-row side-effect comparison. No other product
rows or categories were changed. Descriptions were not rewritten or certified;
the supplier's existing 5% wording remains outside the new verified fields.

Public REST verification compared all eight IDs 4903–4910 with their respective
plans: all specification values, descriptions and protection flags matched.
All four new storefront cards were also inspected for their own color/resource
and complete compatibility list. Screenshot in parent workspace:
`canon-075-yellow-verified-2026-10-28.png`.

The production verification script confirmed importer rejection, permitted a
commercial update, and checked four backups/review records. It then rolled back
all test writes and returned:
`Remaining-color guards, commercial updates and backups passed; test writes rolled back`.

## RLS and validation

Automatic approval review declined the initial SQL Editor “Run without RLS”
action, citing a possible production table access risk. No query was executed.
The dialog was cancelled; explicit RLS was added to the temporary plan table,
and the revised SQL was retested and then executed successfully without that
warning. The temporary table is still dropped on commit. The new restore SQL
also explicitly enables RLS on its temporary plan table. No persistent access
permissions were expanded or security protections disabled.

The full serial suite passed 130/130. After the RLS adjustment, all seven focused
cartridge tests passed again, including actual apply/restore SQL. Tests check
the four new identities/resources/colors, preserve the historical first batch's
SQL output, leave the first four rows untouched, protect later edits and preserve
later commercial values during restore.

## Artifacts and recovery

- `canon-075-magenta-yellow-plan-2026-10-28.json`: original snapshots and intended values.
- `../supabase/apply-canon-075-magenta-yellow-20261028.sql`: already executed; do not rerun.
- `../supabase/restore-canon-075-magenta-yellow-20261028.sql`: restores only the four
  specification tables from backup; refuses subsequent content/provenance edits
  and preserves later prices, stock, media and import protection.
- `../supabase/verify-canon-075-magenta-yellow-20261028.sql`: rollback-only probe.

Do not regenerate snapshots against the now-enriched production rows.
No new media downloads or mass import were performed. The eight reviewed cards
cover the four colors in standard/high-yield 075 versions; this is not a claim
that other Canon cartridge families have been reviewed.
