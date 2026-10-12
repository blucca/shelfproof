#!/usr/bin/env python3
"""Render ShelfProof's fictional, deliberately imperfect retail proof."""

import csv
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "web" / "assets"
INK = "#16324F"
WHITE = "#FFFFFF"
FONT_DIR = Path("/usr/share/fonts/liberation")
PRODUCTS = [
    ("SP-101", "Dot Notebook", "8.50", "12.00", "Price swapped with SP-102"),
    ("SP-102", "Canvas Pouch", "12.00", "8.50", "Price swapped with SP-101"),
    ("SP-103", "Ceramic Mug", "14.50", "14.50", "Match"),
    ("SP-104", "Desk Planter", "18.00", "18.00", "Match"),
    ("SP-105", "Brass Clips", "6.75", "6.75", "Match"),
    ("SP-106", "Task Light", "32.00", "23.00", "Wrong price"),
    ("SP-107", "Felt Coaster", "4.25", None, "Missing from artwork"),
]
COLORS = ["#EFE7FF", "#FFF0C9", "#DDF3E9", "#FFE2D7", "#DFEDFF", "#FAE8C7"]


def font(size, *, bold=False, mono=False):
    family = "LiberationMono" if mono else "LiberationSans"
    return ImageFont.truetype(str(FONT_DIR / f"{family}-{'Bold' if bold else 'Regular'}.ttf"), size)


def illustration(draw, item, cx, cy, background):
    """Original geometric artwork; every coordinate is relative to its card."""
    if item == 0:  # Notebook with a contrasting spine and dotted cover.
        draw.rounded_rectangle((cx - 81, cy - 79, cx + 81, cy + 82), radius=10, fill="#4C5FD7", outline=INK, width=4)
        draw.rectangle((cx - 79, cy - 69, cx - 61, cy + 72), fill="#F29A75")
        draw.line((cx - 55, cy - 77, cx - 55, cy + 79), fill=INK, width=3)
        for dx in (-22, 17, 56):
            for dy in (-38, 1, 40):
                draw.ellipse((cx + dx - 4, cy + dy - 4, cx + dx + 4, cy + dy + 4), fill=WHITE)
        draw.line((cx - 50, cy + 69, cx + 72, cy + 69), fill="#DADFF8", width=3)
    elif item == 1:  # Canvas zipper pouch.
        draw.rounded_rectangle((cx - 107, cy - 44, cx + 103, cy + 76), radius=22, fill="#F08C64", outline=INK, width=4)
        draw.line((cx - 90, cy - 26, cx + 87, cy - 26), fill=INK, width=5)
        for dx in range(-82, 78, 10):
            draw.line((cx + dx, cy - 33, cx + dx, cy - 19), fill=WHITE, width=3)
        draw.rounded_rectangle((cx + 84, cy - 35, cx + 98, cy - 8), radius=4, outline=INK, width=3)
        draw.line((cx - 88, cy + 5, cx - 88, cy + 54, cx + 83, cy + 54, cx + 83, cy + 5), fill="#AC563E", width=3)
        draw.rounded_rectangle((cx - 34, cy + 5, cx + 31, cy + 32), radius=4, fill="#FFF6E8", outline=INK, width=2)
    elif item == 2:  # Ceramic mug with a visible handle.
        draw.ellipse((cx + 35, cy - 44, cx + 114, cy + 44), fill="#78BAA2", outline=INK, width=5)
        draw.ellipse((cx + 55, cy - 25, cx + 93, cy + 25), fill=background, outline=INK, width=3)
        draw.rounded_rectangle((cx - 86, cy - 67, cx + 60, cy + 81), radius=22, fill=WHITE, outline=INK, width=5)
        draw.ellipse((cx - 86, cy - 83, cx + 60, cy - 48), fill="#B5D9C9", outline=INK, width=4)
        draw.ellipse((cx - 70, cy - 75, cx + 45, cy - 56), fill="#A3633C")
        draw.line((cx - 68, cy + 25, cx + 43, cy + 25), fill="#78BAA2", width=8)
        draw.line((cx - 68, cy + 43, cx + 43, cy + 43), fill="#78BAA2", width=8)
    elif item == 3:  # Small leafy desk planter.
        draw.line((cx, cy + 44, cx, cy - 66), fill=INK, width=5)
        draw.line((cx, cy + 7, cx - 58, cy - 39), fill=INK, width=4)
        draw.line((cx, cy - 13, cx + 58, cy - 57), fill=INK, width=4)
        draw.ellipse((cx - 78, cy - 60, cx - 25, cy - 22), fill="#5D9573", outline=INK, width=3)
        draw.ellipse((cx + 23, cy - 76, cx + 78, cy - 39), fill="#85AD65", outline=INK, width=3)
        draw.ellipse((cx - 18, cy - 93, cx + 19, cy - 39), fill="#388166", outline=INK, width=3)
        draw.polygon(((cx - 69, cy + 20), (cx + 69, cy + 20), (cx + 51, cy + 89), (cx - 51, cy + 89)), fill="#CF6F51", outline=INK, width=4)
        draw.rounded_rectangle((cx - 75, cy + 13, cx + 75, cy + 34), radius=5, fill="#EF9B74", outline=INK, width=4)
        draw.line((cx - 33, cy + 46, cx - 28, cy + 72), fill="#F6BE94", width=6)
    elif item == 4:  # Three rounded brass paper clips.
        for dx, dy in ((-81, 13), (-12, -11), (58, 10)):
            draw.rounded_rectangle((cx + dx - 25, cy + dy - 68, cx + dx + 25, cy + dy + 69), radius=24, outline=INK, width=10)
            draw.rounded_rectangle((cx + dx - 25, cy + dy - 68, cx + dx + 25, cy + dy + 69), radius=24, outline="#C48A36", width=6)
            draw.rounded_rectangle((cx + dx - 11, cy + dy - 44, cx + dx + 10, cy + dy + 42), radius=10, outline="#C48A36", width=5)
            draw.line((cx + dx - 12, cy + dy - 42, cx + dx - 12, cy + dy + 50), fill=background, width=4)
    else:  # Adjustable task lamp.
        draw.ellipse((cx - 91, cy + 62, cx + 65, cy + 87), fill="#667CC3", outline=INK, width=4)
        draw.line((cx - 12, cy + 66, cx - 38, cy + 1, cx + 18, cy - 49), fill=INK, width=13)
        draw.line((cx - 12, cy + 66, cx - 38, cy + 1, cx + 18, cy - 49), fill="#7186D0", width=7)
        draw.ellipse((cx - 47, cy - 8, cx - 29, cy + 10), fill="#F0987A", outline=INK, width=3)
        draw.polygon(((cx + 17, cy - 80), (cx + 96, cy - 49), (cx + 53, cy + 4), (cx - 18, cy - 25)), fill="#ED8D78", outline=INK, width=4)
        draw.line((cx - 16, cy - 22, cx + 51, cy + 4), fill="#FFF5BF", width=6)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    page = Image.new("RGB", (1400, 1800), WHITE)
    draw = ImageDraw.Draw(page)
    draw.rectangle((80, 59, 92, 86), fill="#EC8E70")
    draw.text((108, 56), "SUNDAY SHELF", font=font(32, bold=True), fill=INK, anchor="lt")
    draw.text((77, 113), "GOOD THINGS.", font=font(98, bold=True), fill=INK, anchor="lt")
    draw.text((83, 228), "Stationery & small comforts for every day.", font=font(30), fill=INK, anchor="lt")
    draw.ellipse((1207, 78, 1303, 174), fill="#F3C45F")
    for dx, dy in ((-20, -11), (20, -11)):
        draw.ellipse((1255 + dx - 4, 124 + dy - 4, 1255 + dx + 4, 124 + dy + 4), fill=INK)
    draw.arc((1237, 119, 1273, 143), start=0, end=180, fill=INK, width=3)

    geometry = []
    for index, (sku, name, expected, shown, status) in enumerate(PRODUCTS[:6]):
        x = 80 + (index % 2) * 640
        y = 302 + (index // 2) * 442
        draw.rounded_rectangle((x, y, x + 600, y + 412), radius=18, fill=WHITE, outline="#CCD8E1", width=2)
        draw.rounded_rectangle((x + 17, y + 17, x + 583, y + 217), radius=12, fill=COLORS[index])
        illustration(draw, index, x + 300, y + 116, COLORS[index])
        draw.text((x + 29, y + 241), name, font=font(38, bold=True), fill=INK, anchor="lt")
        sku_box = draw.textbbox((x + 180, y + 329), sku, font=font(32, mono=True), anchor="lt")
        draw.text((x + 180, y + 329), sku, font=font(32, mono=True), fill=INK, anchor="lt")
        price_box = draw.textbbox((x + 568, y + 306), "$" + shown, font=font(70, bold=True), anchor="rt")
        draw.text((x + 568, y + 306), "$" + shown, font=font(70, bold=True), fill=INK, anchor="rt")
        geometry.append((sku, (x, y, x + 600, y + 412), sku_box, price_box))

    draw.line((80, 1652, 1320, 1652), fill=INK, width=2)
    draw.text((81, 1677), "A LITTLE COLOUR FOR YOUR DESK & HOME.", font=font(25, bold=True), fill=INK, anchor="lt")
    draw.text((81, 1734), "Fictional sample / seeded price errors", font=font(28), fill=INK, anchor="lt")
    page.save(ASSETS / "sample-promo.png", optimize=True)
    page.save(ASSETS / "sample-promo.pdf", "PDF", resolution=140.0, title="ShelfProof fictional sample — seeded price errors", author="ShelfProof")
    with (ASSETS / "sample-prices.csv").open("w", newline="", encoding="utf-8") as target:
        writer = csv.writer(target)
        writer.writerow(("sku", "name", "price"))
        writer.writerows((sku, name, price) for sku, name, price, _, _ in PRODUCTS)

    table = "\n".join(f"| {sku} | {name} | {expected} | {shown or 'Absent'} | {status} |" for sku, name, expected, shown, status in PRODUCTS)
    boxes = "\n".join(f"| {sku} | `{card}` | `{sku_box}` | `{price_box}` |" for sku, card, sku_box, price_box in geometry)
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "sample-proof.md").write_text(f"""# Fictional retail proof

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
{table}

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
{boxes}

The table gives generator text bounds. An OCR engine's glyph boxes may be slightly tighter. The PDF contains the rendered page as an image so its price text is recognized from pixels during the workflow.
""", encoding="utf-8")

    assert len(PRODUCTS) == 7 and len(geometry) == 6
    assert sum(expected == shown for _, _, expected, shown, _ in PRODUCTS) == 3
    assert PRODUCTS[0][2] == PRODUCTS[1][3] and PRODUCTS[1][2] == PRODUCTS[0][3]
    assert sum(shown is None for _, _, _, shown, _ in PRODUCTS) == 1
    print(ASSETS / "sample-promo.png")
    print(ASSETS / "sample-promo.pdf")
    print(ASSETS / "sample-prices.csv")


if __name__ == "__main__":
    main()
