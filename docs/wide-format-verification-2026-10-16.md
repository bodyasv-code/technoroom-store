# Wide-format manufacturer verification — 2026-10-16

Read-only investigation. No product records, import rules or public filters changed.

The active catalog contains 30 products in `office-wide-format`. Seventeen lack a direct `Формат` key (some have detailed aliases). Two additional products have an incorrect A4 summary alongside larger printing-format evidence. The focused verification below covers these 19 records, not a manufacturer re-audit of every specification on all 30 products.

## Incorrect summaries

| ID / SKU | Model | Manufacturer evidence | Proposed correction, not applied |
| --- | --- | --- | --- |
| 4610 / F9A28D | HP T830 24-inch MFP | A4/A3 tray; A2/A1 manual feed; media up to 610 mm | Maximum standard A-series format A1; media-width class 24-inch |
| 4611 / 2Y9H2A | HP T850 36-inch MFP | A4/A3 tray; manual feed through A0; maximum media width 914 mm | Maximum standard A-series format A0; media-width class 36-inch |

Sources: [HP T830 exact SKU](https://www.hp.com/ca-en/shop/product.aspx?id=F9A28D&opt=B1K&sel=PRN), [HP T850 exact SKU](https://www.hp.com/gb-en/shop/products/printers/hp-designjet-t850-36-in-multifunction-printer-2y9h2a-b19).

## Missing direct format fields

Listed A-series values below mean the largest A-series size explicitly listed in the cited specification, not the largest possible custom print or necessarily the largest standard in every series.

| ID / SKU | Model | Verified A-series support / separate media class | Source |
| --- | --- | --- | --- |
| 4375 / 6856C006 | Canon PRO-1100 | Through A2; sheet-fed, do not label as roll printer | [Canon manual](https://ij.manual.canon/ij/webmanual/Manual/All/PRO-1100%20series/EN/BG/bg_b030.html) |
| 4472 / C11CJ36301A0 | Epson SC-T3100M | A1; 24-inch roll | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t3100m-mfp-(optional-stand)-220v/p/31488) |
| 4473 / C11CH65301A0 | Epson SC-T5400M | A0; 36-inch | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t5400m-mfp---220v/p/29396) |
| 4474 / C11CH82301A0 | Epson SC-T5700DM | A0; 36-inch roll | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t5700dm-(with-ssd-and-postscript)/p/34329) |
| 4475 / C11CH84301A0 | Epson SC-T7700DM | A0 listed; 44-inch roll (1118 mm); scanner only 36-inch | [Epson](https://www.epson.co.uk/en_GB/products/printers/large-format/surecolor-sc-t7700dm-(with-ssd-and-postscript)/p/34332) |
| 4476 / C11CJ50301A0 | Epson SC-P8500D | A0 and B0 explicitly listed; 44-inch | [Epson](https://www.epson.co.uk/en_GB/products/printers/large-format/surecolor-sc-p8500d-std/p/32346) |
| 4479 / C11CJ15301A0 | Epson SC-T3100X | A1; 24-inch | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t3100x---(optional-stand)-220v/p/29651) |
| 4481 / C11CH80301A0 | Epson SC-T3700D | A1; 24-inch roll | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t3700d-(with-adobe-postscript)/p/32361) |
| 4484 / C11CJ56301A0 | Epson SC-T5405 | A0; 36-inch | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t5405-%28with-stand%29-220v/p/30671) |
| 4485 / C11CH81301A0 | Epson SC-T5700D | A0; 36-inch roll | [Epson](https://www.epson.eu/en_EU/products/printers/large-format/surecolor-sc-t5700d-%28with-adobe-postscript%29/p/32364) |
| 4486 / C11CH83301A0 | Epson SC-T7700D | A0 and B0 explicitly listed; 44-inch | [Epson](https://www.epson.co.uk/en_GB/products/printers/large-format/surecolor-sc-t7700d-(with-adobe-postscript)/p/32427) |
| 4612 / 2Y9H3A | HP T950 MFP | A0; 914 mm maximum media width | [HP](https://www.hp.com/za-en/products/large-format-printers/product-details/product-specifications/2100456045) |
| 4613 / W6B55A | HP T1700 | A0 listed; 1118 mm maximum media width | [HP specification](https://www.hp.com/emea_middle_east-en/products/large-format-printers/product-details/product-specifications/17572081) |
| 4614 / 1VD87A | HP T1700 PostScript | 44-inch / 1118 mm family specification | [HP exact model](https://www.hp.com/ie-en/products/large-format-printers/product-details/17572084), [HP family datasheet](https://h20195.www2.hp.com/v2/GetPDF.aspx/4AA7-1557EEP.pdf) |
| 4615 / W6B56A | HP T1700dr | 44-inch / 1118 mm family specification | [HP family datasheet, all four SKUs](https://h20195.www2.hp.com/v2/GetPDF.aspx/4AA7-1557EEP.pdf) |
| 4616 / 1VD88A | HP T1700dr PostScript | 44-inch / 1118 mm family specification | [HP family datasheet, all four SKUs](https://h20195.www2.hp.com/v2/GetPDF.aspx/4AA7-1557EEP.pdf) |
| 4623 / 2Y9H1A | HP T950 | A0; 914 mm maximum media width | [HP](https://www.hp.com/emea_middle_east-en/products/large-format-printers/product-details/product-specifications/2100456043) |

## Implementation implications (not implemented)

- Keep maximum A-series format, other supported standards (e.g. B0), maximum media width, and scanner width separate. Do not derive all of them from one another.
- A4 in an input tray is not the maximum printing format. Generic text search currently mixes tray, scanner and printer formats; the catalog filter only extracts A3/A4.
- Some Epson 44-inch printers explicitly list B0, while the SC-T7700DM page lists A0 plus 44-inch roll support. Do not infer B0 for every 44-inch model.
- Do not invent A0+ / A1+ solely from inch width. Preserve manufacturer wording and exact SKU scope.
- The manufacturer's T7700DM regional summary mentions 36-inch features; the UK technical section distinguishes 44-inch roll handling from 36-inch scanning. Prefer field-specific technical data over marketing summaries.
- The next change should extend editor/filter support beyond A3/A4 and then apply reviewed exact-model corrections. A blind mass update would lose information.
