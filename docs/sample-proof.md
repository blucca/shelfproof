# Fictional retail proof

All shop names, products, prices and offers in this fixture are fictional. Original geometric illustrations are drawn by the generator. The page footer reads **Fictional sample / seeded price errors**.

## Files and generation

- `web/assets/sample-promo.png`: 1400 × 1800 RGB artwork.
- `web/assets/sample-promo.pdf`: one raster-only PDF page containing the same artwork, saved at 140 dpi (720 × 925.714 PDF points).
- `web/assets/sample-prices.csv`: seven approved `sku,name,price` records; USD prices with exactly two decimal places.

From the workspace root:

```sh
temp/work-env/bin/python -B products/shelfproof/scripts/make-sample.py
```

The script uses the installed Pillow package and Liberation Sans/Mono under `/usr/share/fonts/liberation/`. The delivered PNG/PDF already contain the type rendering. Generated artwork uses original shapes and system typography.

## Seeded findings

The approved CSV lists seven SKUs. Six appear on the artwork: three matching prices, a two-product price swap and one other incorrect price. One expected SKU is absent.

| SKU | Fictional product | Approved USD | Artwork USD | Finding |
| --- | --- | ---: | ---: | --- |
| SP-101 | Dot Notebook | 8.50 | 12.00 | Price swapped with SP-102 |
| SP-102 | Canvas Pouch | 12.00 | 8.50 | Price swapped with SP-101 |
| SP-103 | Ceramic Mug | 14.50 | 14.50 | Match |
| SP-104 | Desk Planter | 18.00 | 18.00 | Match |
| SP-105 | Brass Clips | 6.75 | 6.75 | Match |
| SP-106 | Task Light | 32.00 | 23.00 | Wrong price |
| SP-107 | Felt Coaster | 4.25 | Absent | Missing from artwork |

Both swapped values occur in the approved price list. Pairing the price to its visible SKU is therefore essential. The missing SKU appears in the CSV and the checklist.

## Geometry

Coordinates use the PNG's 1400 × 1800 space, origin at the top left, in `(left, top, right, bottom)` pixels. Scale both axes by the rendered width divided by 1400 when reviewing a fitted page. Six cards form two columns and three rows; each price is to the right of its SKU on the same reading line. Product illustration panels contain shapes only.

- Card size: 600 × 412 px.
- Column left edges: 80 and 720 px; horizontal gap: 40 px.
- Row top edges: 302, 744 and 1186 px; vertical gap: 30 px.
- Name origin: card + (29, 241).
- SKU origin: card + (180, 329), 32 px Liberation Mono.
- Price anchor: card + (568, 306), right aligned, 70 px bold Liberation Sans.
- Header ends above y=260; footer begins at y=1652.

| SKU | Card bounds | Expected SKU text bounds | Expected price text bounds |
| --- | --- | --- | --- |
| SP-101 | `(80, 302, 680, 714)` | `(260, 631, 375, 652)` | `(434, 608, 648, 665)` |
| SP-102 | `(720, 302, 1320, 714)` | `(900, 631, 1015, 652)` | `(1113, 608, 1288, 665)` |
| SP-103 | `(80, 744, 680, 1156)` | `(260, 1073, 375, 1094)` | `(434, 1050, 648, 1107)` |
| SP-104 | `(720, 744, 1320, 1156)` | `(900, 1073, 1015, 1094)` | `(1074, 1050, 1288, 1107)` |
| SP-105 | `(80, 1186, 680, 1598)` | `(260, 1515, 375, 1536)` | `(473, 1492, 648, 1549)` |
| SP-106 | `(720, 1186, 1320, 1598)` | `(900, 1515, 1015, 1536)` | `(1074, 1492, 1288, 1549)` |

The table gives generator text bounds. An OCR engine's glyph boxes may be slightly tighter. The PDF contains the rendered page as an image so its price text is recognized from pixels during the workflow.
