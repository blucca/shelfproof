# ShelfProof demonstration

[Watch the 93-second film](https://blucca.github.io/shelfproof/demo/) · [Open the sample correction sheet](https://blucca.github.io/shelfproof/demo/sample-review.html) · [Try ShelfProof](https://blucca.github.io/shelfproof/)

## What the film shows

A fictional retail flyer swaps the notebook and pouch prices, gives the task light a separate wrong price, and omits an expected coaster. A real browser run uses local Tesseract LSTM OCR on the rendered PDF, inspects a 40/100 pair score and its source crops, rereads a selected price region, and confirms all seven expected SKU decisions.

The result is three price differences, three matching readings and one item marked missing. The exported HTML contains seven records and twelve source crops, preserving approved prices, original readings and review decisions. The published sample adds a recording-context notice to the exported report.

This recording uses fictional artwork with seeded errors. Review actions were performed by a script. The English narration is synthesized with Amazon Polly. Actual clips and screenshots follow the captured workflow; reading pauses and source-detail close-ups make the evidence readable.

The film completed a full-speed browser playback with all 19 caption cues. The public player also passed chapter seeking, mobile layout and sample-report checks. Chapter navigation uses HTTP byte-range requests, supported by the published GitHub Pages player.

## Chapters

| Start | Step |
| --- | --- |
| 0:00 | The price swap |
| 0:15 | Local OCR |
| 0:30 | Source evidence |
| 0:43 | Scripted review |
| 0:59 | The correction sheet |
| 1:15 | Your next proof |

## Published files

- `web/demo/index.html`: accessible native video player, chapter buttons and transcript.
- `web/demo/shelfproof-demo.mp4`: 93.021 seconds, 1920 × 1080, H.264 / AAC, burned-in English subtitles.
- `web/demo/shelfproof-demo.vtt`: synchronized English captions.
- `web/demo/shelfproof-poster.webp`: poster using the captured product screen.
- `web/demo/sample-review.html`: the sample’s seven exported records and twelve source crops, with recording context.
- `web/demo/transcript.txt`: plain-text narration.

The free checker processes files locally. The optional US$29 review covers up to five pages and fifty SKUs, one correction sheet and one clarification round. A redacted page starts the scope and delivery-date conversation. Inputs use visible SKUs, one intended price per SKU, and one currency per proof.

## Transcript

### The price swap

Two correct prices can still land beside the wrong products. In this fictional shop flyer, the notebook and pouch prices are swapped. ShelfProof checks the final artwork against an approved price list, one visible SKU at a time.

### Local OCR

Open the sample proof. This is real Tesseract OCR running locally on the rendered PDF. Six visible product codes and prices become a checklist covering all seven expected SKUs. Your files stay in the browser.

### Source evidence

The notebook's paired OCR score is forty out of one hundred. It stays open for review. The blue SKU box and red price box show exactly which printed regions were paired, beside the original reading.

### Scripted review

Select the price area and read it again. Then confirm each pairing and printed value. This demonstration uses scripted review actions. The missing coaster gets its own explicit decision, keeping every expected SKU in the checklist.

### The correction sheet

The completed review records three price differences, three matching readings and one missing item. Download a self-contained correction sheet: seven records, twelve source crops, approved and printed amounts, plus the original OCR and reviewer decisions.

### Your next proof

Try the free local checker with your own PDF or image and approved CSV. For a focused review, the AI-operated studio offers up to five pages and fifty SKUs for twenty-nine dollars. Share one redacted page to agree the scope and date.

