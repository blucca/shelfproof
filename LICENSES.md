# Licenses and source components

| Component | Version / source | License | Included notice |
| --- | --- | --- | --- |
| ShelfProof application, sample artwork and generator | Blucca, 2026 | MIT | [LICENSE](LICENSE) |
| Tesseract.js browser runtime and worker | [6.0.1](https://github.com/naptha/tesseract.js/tree/v6.0.1) | Apache-2.0 | [Runtime notice](web/vendor/tesseract/LICENSE.md), bundled third-party notices beside the two scripts |
| Tesseract.js-core WASM LSTM runtime | [6.1.2](https://github.com/naptha/tesseract.js-core) | Apache-2.0 | [Core notice](web/vendor/tesseract/core/LICENSE) |
| English fast LSTM weights | [tessdata_fast 4.1.0](https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0) | Apache-2.0 | [Model notice](web/vendor/tesseract/lang/LICENSE) |
| PDF.js | [6.4.299](https://github.com/mozilla/pdf.js) | Apache-2.0 | [PDF.js notice](web/vendor/pdfjs/LICENSE) |
| PDF font, mapping, image-decoder and ICC resources | Distributed with PDF.js | Notices by resource | Notices included in `standard_fonts/`, `cmaps/`, `wasm/` and `iccs/` |
| Barlow / Barlow Condensed | [The Barlow Project](https://github.com/jpt/barlow), via Google Fonts | SIL Open Font License 1.1 | [Barlow](web/vendor/fonts/barlow-OFL.txt), [Barlow Condensed](web/vendor/fonts/barlowcondensed-OFL.txt) |

The model and all runtime assets are served from the application origin. Artwork is processed in the browser. The sample depicts fictional products and deliberately planted price errors; its illustrations are original.

`scripts/prepare-assets.mjs` records the source download paths. `package-lock.json` pins the JavaScript package versions. Development and the scripted browser rehearsal use Codex, OpenAI's coding agent.
