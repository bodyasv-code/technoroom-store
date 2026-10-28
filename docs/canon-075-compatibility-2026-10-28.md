# Canon 075/075H product links

## Verified scope

Manufacturer series compatibility: https://www.canon.co.uk/store/toner-cartridge-075/

The public catalog was checked on 2026-10-28. Four active device cards exist:

| ID | Item code | Model |
|---|---|---|
| 4330 | 6928C008 | MF664Cdw |
| 4331 | 6928C001 | MF667Cdw |
| 4364 | 6929C007 | LBP646Cdw |
| 4365 | 6929C001 | LBP647Cdw |

Eight active toner cards exist: 4903–4910, item codes 6365C002, 6364C002,
6369C002, 6368C002, 6367C002, 6366C002, 6363C002, 6362C002.

## Behavior

Device pages show two groups of four cartridges, standard and high yield.
Cartridge pages show the four compatible device cards. Existing storefront cards
provide current prices, availability and cart behavior. All relationships require
exact manufacturer item codes, Canon brand, and the appropriate product category.
Hidden cards, variants, duplicate item codes and partial/similar codes are excluded.
No compatibility is inferred from supplier prose or model-name fragments.

No database, pricing, stock, description, image or import changes are made.
The product page explicitly fetches compatible item codes in parallel with its
existing category and recent-product requests. It does not load the whole catalog.
The query is restricted to active root cards from Canon. A failed compatibility
request is logged and does not prevent the main product page from rendering.

## Validation

Six focused tests cover both directions for every item, standard/high-yield order,
wrong region/brand/category, duplicates, hidden products, variants, empty groups,
and explicit loading of compatible products from the other category.
Browser connection failed twice with timeouts; visual verification remains pending.
