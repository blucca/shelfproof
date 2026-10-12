# Release checks

October 12, 2026. Chromium 154, with desktop and 390 px viewports.

The public GitHub Pages deployment also completed this flow in a fresh anonymous browser context: real PDF OCR, price-region rereading, seven scripted decisions and the exported review. The page returned HTTP 200; page errors and failed requests both remained at zero. The [workflow video](https://blucca.github.io/shelfproof/demo/) uses that recording.

## A complete proof

The [fictional Sunday Shelf artwork](sample-proof.md) is an image-only PDF. The real Tesseract LSTM model reads the rendered pixels in the browser. Six visible SKU labels and six prices were read correctly; the approved list has seven SKUs.

| SKU | Approved | Printed | Initial review state |
| --- | --- | --- | --- |
| SP-101 | $8.50 | $12.00 | Confirm pairing: SKU OCR score about 40/100 |
| SP-102 | $12.00 | $8.50 | Price differs |
| SP-103 | $14.50 | $14.50 | Price matches |
| SP-104 | $18.00 | $18.00 | Price matches |
| SP-105 | $6.75 | $6.75 | Price matches |
| SP-106 | $32.00 | $23.00 | Price differs |
| SP-107 | $4.25 | Absent | Locate SKU |

The two swapped prices both occur in the approved list. Matching each price to its own SKU exposes the swap. The low-scoring SP-101 reading keeps its source regions visible and asks the reviewer to check the association.

The browser check selected and reread a price region, confirmed the six visible readings, and marked SP-107 missing. The final summary contained three price differences, three matching readings, and one missing SKU. The exported HTML held all seven decisions and twelve embedded source crops, about 264 KB. Opening the review requires a browser; its crops travel with the file.

These decisions were performed by the development script. Customer artwork and independent studio feedback are the next validation step.

## A second layout

A separate fictional PNG used pounds, three SKUs, and a competing second price on one row. It produced one match, one request to confirm the pairing, and one price difference. This check exposed a distance cutoff that hid the competing price; the shared pairing rule now considers that same-row candidate and sends the ambiguous row for review.

Replacing the price list with an invalid CSV preserved the existing proof. Its subsequent export retained the original filenames and pound currency.

## Reproduce

```sh
npm test
python -m http.server 8138 --directory web
```

Open the app and select **Try the sample proof**. Inspect the SKU and price crops, confirm the readings, mark the final item missing, and choose **Download review**.

`tests/browser-smoke.py` automates that flow against an existing CDP browser. Its output directory belongs outside the source tree. The six focused Node checks cover CSV input, integer money values, identifier matching, spatial pairing, competing prices, and review decisions. The release check also exercises the narrow mobile layout and reports page errors.

The first-release workflow accepts one currency, visible SKU labels and up to five artwork pages / fifty approved SKUs. Multi-price layouts use explicit region selection. Artwork and readings live in the browser tab; the downloaded review preserves the decisions.
