# ShelfProof

Check the price on the page.

ShelfProof is a local-browser price-proofing desk for small design and print studios. It reads the rendered artwork with open-source OCR, pairs visible SKUs with prices, and compares them with an approved CSV. Every expected SKU gets a review row. A correction sheet carries the source regions and the reviewer's decisions back to the client.

**[Try ShelfProof](https://blucca.github.io/shelfproof/)** · [Watch the workflow](https://blucca.github.io/shelfproof/demo/) · [Sample correction sheet](https://blucca.github.io/shelfproof/demo/sample-review.html) · [Release checks](docs/validation.md)

Built for [MLH × DEV's Side Hustle challenge](https://dev.to/challenges/hacktoberfest-week2-2026-10-12), October 12–18, 2026. Development began October 12 at 19:36 UTC, inside the contest window.

## First release

- PDF, PNG, or JPEG artwork; an approved `sku,name,price` CSV.
- Local Tesseract LSTM recognition, with the artwork staying in the browser.
- Exact monetary comparison and visible region-to-SKU review.
- A complete SKU checklist, editable readings, and a downloadable client correction sheet.
- A labeled fictional retail proof for an immediate rehearsal.

The initial workflow covers a single currency per proof, visible SKU labels, and one intended price per SKU. Artwork with several prices for the same SKU goes through manual region review.

## Run locally

```sh
python -m http.server 8138 --directory web
```

Open `http://localhost:8138` and choose **Try the sample proof**. The complete reading model and PDF runtime ship in `web/vendor/`.

To refresh those assets: `npm ci && npm run assets`. To run the focused domain checks: `npm test`. Browser-flow checks use Playwright and an existing CDP browser; see `tests/browser-smoke.py --help`.

The first browser check completed real OCR of the fictional raster PDF, source-area reselection, seven scripted reviewer decisions, and a self-contained HTML review with twelve source crops. Desktop and 390 px layouts were exercised. A separate pound-denominated PNG covered a competing-price row and preservation of the existing proof after an invalid replacement CSV. See the [release checks](docs/validation.md).

## Review flow

1. Choose a PDF, PNG or JPEG (up to 20 MB and five pages) and an approved CSV with up to fifty SKUs.
2. Read the artwork. Every expected SKU stays in the checklist, including items whose location needs review.
3. Check the blue SKU and red price regions. Select another price region or enter a corrected reading, then confirm its association.
4. Mark an expected SKU missing when appropriate. Download the full review, or copy its issue list.

The model supplies text and locations. The price comparison uses integer cents. Low OCR scores, multiple candidate prices and repeated identifiers go to reviewer confirmation. Readings and decisions stay in the current tab; the exported review keeps the selected evidence.

## Service experiment

The free checker accompanies a **US$29 price-proof review**: up to five artwork pages and fifty SKUs, an issue sheet, and one clarification round. Scope and the delivery date are agreed before an order. Contact [belgialucca@gmail.com](mailto:belgialucca@gmail.com?subject=ShelfProof%20price-proof%20review) with a redacted page and the task.

## Open components

Application code: MIT. Tesseract.js and Tesseract OCR/model licenses are recorded with the release assets. Development uses Codex, OpenAI's coding agent.
