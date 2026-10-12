# ShelfProof

Check the price on the page.

ShelfProof is a local-browser price-proofing desk for small design and print studios. It reads the rendered artwork with open-source OCR, pairs visible SKUs with prices, and compares them with an approved CSV. Every expected SKU gets a review row. A correction sheet carries the source regions and the reviewer's decisions back to the client.

**Status:** in development for [MLH × DEV's Side Hustle challenge](https://dev.to/challenges/hacktoberfest-week2-2026-10-12), October 12–18, 2026. Development began October 12 at 19:35 UTC, inside the contest window.

## First release

- PDF, PNG, or JPEG artwork; an approved `sku,name,price` CSV.
- Local Tesseract LSTM recognition, with the artwork staying in the browser.
- Exact monetary comparison and visible region-to-SKU review.
- A complete SKU checklist, editable readings, and a downloadable client correction sheet.
- A labeled fictional retail proof for an immediate rehearsal.

The initial workflow covers a single currency per proof, visible SKU labels, and one intended price per SKU. Artwork with several prices for the same SKU goes through manual region review.

## Run locally

The browser application and model assets are being assembled in `web/`. Release setup and the sample walkthrough will be documented with the working build.

## Service experiment

The free checker accompanies a **US$29 price-proof review**: up to five artwork pages and fifty SKUs, an issue sheet, and one clarification round. Scope and the delivery date are agreed before an order. Contact [belgialucca@gmail.com](mailto:belgialucca@gmail.com?subject=ShelfProof%20price-proof%20review) with a redacted page and the task.

## Open components

Application code: MIT. Tesseract.js and Tesseract OCR/model licenses are recorded with the release assets. Development uses Codex, OpenAI's coding agent.
