import { parseCatalogCSV, parsePrice, formatPrice, buildReview, unclaimedReadings } from './proof-core.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset = path => new URL(path, import.meta.url).href;
const labels = { match: 'Price matches', mismatch: 'Price differs', review: 'Confirm pairing', notFound: 'Locate SKU', missing: 'Marked missing' };
const extraKinds = { sku: 'Unlisted SKU-like label', price: 'Unclaimed price' };
let pages = [], rows = [], selected = 0, pageIndex = 0, currency = '$', busy = false, picking = false, drag = null;
let approved = [], unclaimed = [];
let worker, workerPromise, progressPage = 0, progressTotal = 1, artworkName = '', catalogName = '', isSample = false;

function say(text) { $('message').textContent = text; }
function fail(error) { $('error').textContent = error.message || 'The file could not be read. Choose a clear PDF, PNG or JPEG proof.'; $('error').hidden = false; }
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#proof-form input,#proof-form select,#proof-form button,#try-sample,#use-files,#start-over,#export-review,#copy-issues,#confirm-form button,#observed-price,#mark-missing,#pick-region,#page-picker').forEach(el => el.disabled = value);
  $('progress-wrap').hidden = !value;
}
function openDesk() {
  document.body.classList.add('working');
  $('desk').hidden = false;
  $('desk').scrollIntoView({ block: 'start' });
}
function tsvWords(tsv = '') {
  return tsv.split('\n').slice(1).flatMap(line => {
    const c = line.split('\t');
    const text = c.slice(11).join('\t').trim();
    if (c[0] !== '5' || !text || Number(c[8]) <= 0 || Number(c[9]) <= 0) return [];
    return [{ text, confidence: Number(c[10]), lineId: c.slice(1, 5).join('/'), bbox: { x0: Number(c[6]), y0: Number(c[7]), x1: Number(c[6]) + Number(c[8]), y1: Number(c[7]) + Number(c[9]) } }];
  });
}
async function reader() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1, {
      workerPath: asset('./vendor/tesseract/worker.min.js'),
      corePath: asset('./vendor/tesseract/core'),
      langPath: asset('./vendor/tesseract/lang'),
      logger: event => {
        const reading = event.status === 'recognizing text';
        $('progress').value = reading ? (progressPage + (event.progress || 0)) / progressTotal : 0;
        $('progress-message').textContent = reading ? `Reading page ${progressPage + 1} of ${progressTotal} on this device… ${Math.round((event.progress || 0) * 100)}%` : 'Preparing the local English reading model…';
      },
    }).then(async value => {
      worker = value;
      await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
      return worker;
    }).catch(error => { workerPromise = undefined; throw error; });
  }
  return workerPromise;
}
async function artworkPages(file) {
  if (!file || file.size === 0) throw new Error('Choose an artwork file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Use an artwork file up to 20 MB.');
  const output = [];
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = asset('./vendor/pdfjs/pdf.worker.min.mjs');
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false,
      cMapUrl: asset('./vendor/pdfjs/cmaps/'), cMapPacked: true,
      standardFontDataUrl: asset('./vendor/pdfjs/standard_fonts/'),
      wasmUrl: asset('./vendor/pdfjs/wasm/'), iccUrl: asset('./vendor/pdfjs/iccs/'),
    });
    const doc = await loading.promise;
    try {
      if (doc.numPages > 5) throw new Error('Choose up to five artwork pages for this proof.');
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        const natural = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: Math.min(2.5, 1800 / Math.max(natural.width, natural.height)) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
        output.push({ canvas, width: canvas.width, height: canvas.height, words: [], src: canvas.toDataURL('image/png') });
        page.cleanup();
      }
    } finally { await loading.destroy(); }
  } else {
    if (!/\.(png|jpe?g)$/i.test(file.name) && !/^image\/(png|jpeg)$/.test(file.type)) throw new Error('Choose a PDF, PNG or JPEG artwork file.');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    output.push({ canvas, width: canvas.width, height: canvas.height, words: [], src: canvas.toDataURL('image/png') });
  }
  return output;
}
async function runProof(artwork, catalog, sample = false) {
  if (busy) return;
  $('error').hidden = true; say(''); openDesk(); setPicking(false); setBusy(true); $('results').hidden = true;
  try {
    if (!catalog) throw new Error('Choose the approved CSV price list.');
    if (catalog.size > 500_000) throw new Error('Use a CSV price list up to 500 KB.');
    const expected = parseCatalogCSV(await catalog.text());
    if (expected.length === 0) throw new Error('Add at least one SKU to the approved price list.');
    const nextCurrency = $('currency').value;
    $('progress-message').textContent = 'Rendering the final artwork…'; $('progress').value = 0;
    const nextPages = await artworkPages(artwork); progressTotal = nextPages.length; progressPage = 0;
    const ocr = await reader();
    for (let index = 0; index < nextPages.length; index++) {
      progressPage = index;
      const { data } = await ocr.recognize(nextPages[index].canvas, {}, { text: true, tsv: true });
      nextPages[index].words = tsvWords(data.tsv);
    }
    const nextRows = buildReview(expected, nextPages, nextCurrency).map(row => ({ ...row, reviewed: false, original: { text: row.ocrText, cents: row.ocrCents, status: row.status, confidence: row.confidence } }));
    pages = nextPages; rows = nextRows; approved = expected; currency = nextCurrency; artworkName = artwork.name; catalogName = catalog.name; isSample = sample;
    $('source-caption').textContent = sample ? 'Fictional sample proof. Live OCR reads the planted errors.' : `${artworkName} with ${catalogName}`;
    $('page-picker').innerHTML = pages.map((_, i) => `<option value="${i}">${i + 1} of ${pages.length}</option>`).join('');
    $('results').hidden = false;
    selected = Math.max(0, rows.findIndex(row => row.status === 'mismatch' || row.status === 'review'));
    renderRows(); selectRow(selected);
    say('Artwork read. Check each pairing, then confirm the printed value.');
  } catch (error) { $('results').hidden = rows.length === 0; fail(error); }
  finally { setBusy(false); }
}
function money(cents) { return Number.isSafeInteger(cents) ? formatPrice(cents, currency) : '—'; }
function renderRows() {
  unclaimed = unclaimedReadings(approved, pages, rows, currency);
  $('unclaimed-readings').hidden = unclaimed.length === 0;
  $('unclaimed-count').textContent = `${unclaimed.length} readings to check`;
  $('unclaimed-list').innerHTML = unclaimed.map(reading => `<figure class="extra-reading"><figcaption><strong>${escape(reading.text)}</strong><span>${extraKinds[reading.kind]} · Page ${reading.pageIndex + 1}</span></figcaption><img src="${crop(pages[reading.pageIndex], reading.bbox)}" alt="Source region for ${escape(reading.text)}"><p>OCR score ${Math.round(reading.confidence)}/100 · Awaiting review</p></figure>`).join('');
  $('sku-list').innerHTML = rows.map((row, index) => `<button type="button" class="sku-row ${escape(row.status)}" data-row="${index}" aria-current="${index === selected}"><span><span class="sku-name">${escape(row.name)}</span><span class="sku-code">${escape(row.sku)}</span></span><span class="row-prices">${escape(money(row.expectedCents))} / <strong>${escape(money(row.ocrCents))}</strong></span><span class="row-state"><i class="state-dot"></i>${escape(labels[row.status])}${row.reviewed ? '<span class="confirmed-mark">Confirmed</span>' : ''}</span></button>`).join('');
  const counts = status => rows.filter(row => row.status === status).length;
  const open = counts('review') + counts('notFound');
  $('summary').textContent = `${counts('mismatch')} price differences, ${counts('match')} matching readings${counts('missing') ? `, ${counts('missing')} marked missing` : ''}${open ? `, ${open} to resolve` : ''}${unclaimed.length ? `, ${unclaimed.length} unclaimed readings` : ''}`;
  $('review-count').textContent = `${rows.filter(row => row.reviewed).length} of ${rows.length} SKU decisions confirmed by you.`;
}
function selectRow(index) {
  selected = index;
  const row = rows[index];
  document.querySelectorAll('.sku-row').forEach((button, i) => button.setAttribute('aria-current', String(i === selected)));
  pageIndex = Number.isInteger(row.pageIndex) && row.pageIndex >= 0 ? row.pageIndex : 0;
  showPage(); renderDetail();
}
function rectMarkup(box, className) {
  if (!box) return '';
  return `<rect class="${className}" x="${box.x0}" y="${box.y0}" width="${Math.max(1, box.x1 - box.x0)}" height="${Math.max(1, box.y1 - box.y0)}" rx="2"/>`;
}
function showPage() {
  const page = pages[pageIndex]; if (!page) return;
  $('page-picker').value = String(pageIndex); $('proof-image').src = page.src;
  $('proof-image').alt = `${isSample ? 'Fictional sample' : 'Artwork'} page ${pageIndex + 1}; selected SKU ${rows[selected]?.sku || ''}`;
  $('proof-overlay').setAttribute('viewBox', `0 0 ${page.width} ${page.height}`);
  drawBoxes();
}
function drawBoxes() {
  const row = rows[selected];
  $('proof-overlay').innerHTML = row && row.pageIndex === pageIndex ? rectMarkup(row.skuBox, 'sku-box') + rectMarkup(row.priceBox, 'price-box') : '';
}
function crop(page, box, padding = 9) {
  if (!page || !box) return '';
  const x = Math.max(0, Math.floor(box.x0 - padding)), y = Math.max(0, Math.floor(box.y0 - padding));
  const width = Math.max(1, Math.min(page.width - x, Math.ceil(box.x1 + padding) - x));
  const height = Math.max(1, Math.min(page.height - y, Math.ceil(box.y1 + padding) - y));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(page.canvas, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
function renderDetail() {
  const row = rows[selected]; if (!row) return;
  $('reading-title').textContent = `${row.sku} / ${row.name}`;
  $('reading-reason').textContent = row.reason || labels[row.status];
  for (const kind of ['sku', 'price']) {
    const src = crop(pages[row.pageIndex], row[`${kind}Box`]);
    $(`${kind}-crop`).hidden = !src; $(`${kind}-crop-empty`).hidden = Boolean(src);
    if (src) $(`${kind}-crop`).src = src;
  }
  const original = row.original;
  $('original-read').textContent = original.text ? `Original price read: “${original.text}”.${Number.isFinite(original.confidence) ? ` Pair OCR score: ${Math.round(original.confidence)}/100 (the lower SKU or price score).` : ''}` : 'Original OCR status: locate this SKU.';
  $('input-currency').textContent = currency;
  $('observed-price').value = Number.isSafeInteger(row.ocrCents) ? (row.ocrCents / 100).toFixed(2) : '';
}
function confirmReading(event) {
  event.preventDefault(); if (busy || !rows[selected]) return;
  $('error').hidden = true;
  const input = $('observed-price').value.trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(input)) { fail(new Error('Enter the price printed on the page, such as 24.50.')); return; }
  const [whole, fraction = ''] = input.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  const row = rows[selected];
  row.ocrCents = cents; row.reviewed = true; row.confirmedAt = new Date().toISOString();
  row.status = cents === row.expectedCents ? 'match' : 'mismatch';
  row.reason = row.priceBox ? `You confirmed the SKU-to-price pairing on page ${row.pageIndex + 1}.` : 'You confirmed a manually entered reading.';
  renderRows(); renderDetail(); drawBoxes(); say(`${row.sku}: reading confirmed.`);
}
function setPicking(value) {
  picking = value; drag = null; $('proof-stage').classList.toggle('picking', value); $('region-hint').hidden = !value;
  $('pick-region').textContent = value ? 'Cancel selection' : 'Choose a price area'; drawBoxes();
}
function point(event) {
  const bounds = $('proof-overlay').getBoundingClientRect(), page = pages[pageIndex];
  return { x: Math.max(0, Math.min(page.width, (event.clientX - bounds.left) * page.width / bounds.width)), y: Math.max(0, Math.min(page.height, (event.clientY - bounds.top) * page.height / bounds.height)) };
}
function boxBetween(a, b) { return { x0: Math.floor(Math.min(a.x, b.x)), y0: Math.floor(Math.min(a.y, b.y)), x1: Math.ceil(Math.max(a.x, b.x)), y1: Math.ceil(Math.max(a.y, b.y)) }; }
async function readRegion(box) {
  if (busy) return;
  const row = rows[selected], regionPage = pageIndex;
  setPicking(false); setBusy(true); $('error').hidden = true; progressPage = 0; progressTotal = 1;
  try {
    const ocr = await reader();
    await ocr.setParameters({ tessedit_pageseg_mode: '6' });
    const { data } = await ocr.recognize(pages[regionPage].canvas, { rectangle: { left: box.x0, top: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 } }, { text: true });
    if (row.pageIndex !== regionPage) row.skuBox = null;
    row.pageIndex = regionPage; row.priceBox = box; row.ocrText = data.text.trim(); row.ocrCents = parsePrice(row.ocrText); row.confidence = data.confidence;
    row.status = 'review'; row.reviewed = false; row.reason = 'You selected this price area. Confirm its SKU pairing and printed value.';
    renderRows(); renderDetail(); drawBoxes(); say('Price area read. Confirm the value beside the selected SKU.');
  } catch (error) { fail(error); }
  finally { if (worker) await worker.setParameters({ tessedit_pageseg_mode: '3' }); setBusy(false); }
}
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function issueText() {
  const issues = rows.filter(row => row.status !== 'match');
  return [`ShelfProof price review${isSample ? ' — fictional sample' : ''}`, `Artwork: ${artworkName}`, `Approved list: ${catalogName}`, `Confirmed decisions: ${rows.filter(row => row.reviewed).length}/${rows.length}`, '', ...issues.map(row => `${row.sku} / ${row.name}: approved ${money(row.expectedCents)}; read ${money(row.ocrCents)}. ${labels[row.status]}. ${row.reviewed ? 'Reviewer confirmed.' : 'Awaiting reviewer confirmation.'}${Number.isInteger(row.pageIndex) && row.pageIndex >= 0 ? ` Page ${row.pageIndex + 1}.` : ''}`), '', `Unclaimed readings: ${unclaimed.length} awaiting artwork review.`, ...unclaimed.map(reading => `${extraKinds[reading.kind]}: ${reading.text}. Page ${reading.pageIndex + 1}. OCR score ${Math.round(reading.confidence)}/100.`)].join('\n');
}
function exportReview() {
  const confirmed = rows.filter(row => row.reviewed).length;
  const content = rows.map(row => {
    const skuImage = crop(pages[row.pageIndex], row.skuBox), priceImage = crop(pages[row.pageIndex], row.priceBox);
    const evidence = skuImage || priceImage ? `<div class="crops">${skuImage ? `<figure><figcaption>SKU region</figcaption><img alt="SKU region" src="${skuImage}"></figure>` : ''}${priceImage ? `<figure><figcaption>Price region</figcaption><img alt="Price region" src="${priceImage}"></figure>` : ''}</div>` : '';
    return `<section><h2>${escape(row.sku)} / ${escape(row.name)}</h2><p class="${escape(row.status)}"><strong>${escape(labels[row.status])}</strong> · ${row.reviewed ? 'Reviewer confirmed' : 'Awaiting reviewer confirmation'}</p><p>Approved: <strong>${escape(money(row.expectedCents))}</strong> &nbsp; Read: <strong>${escape(money(row.ocrCents))}</strong>${Number.isInteger(row.pageIndex) && row.pageIndex >= 0 ? ` &nbsp; Page ${row.pageIndex + 1}` : ''}</p><p>${escape(row.reason || '')}</p>${evidence}<p class="small">Original OCR: ${escape(row.original.text || 'SKU to locate')}. ${row.confirmedAt ? `Decision recorded: ${escape(row.confirmedAt)}.` : ''}</p></section>`;
  }).join('');
  const extraContent = unclaimed.length ? `<h2>Unclaimed readings</h2><p>Review these OCR regions for leftover products, secondary prices or promotional copy. Labels use the approved list’s code shapes or an explicit SKU marker.</p>${unclaimed.map(reading => `<section class="unclaimed-reading"><h2>${escape(reading.text)}</h2><p>${extraKinds[reading.kind]} · Page ${reading.pageIndex + 1} · Awaiting review</p><div class="crops"><figure><figcaption>Artwork region · OCR score ${Math.round(reading.confidence)}/100</figcaption><img alt="Source region for ${escape(reading.text)}" src="${crop(pages[reading.pageIndex], reading.bbox)}"></figure></div></section>`).join('')}` : '';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShelfProof review</title><style>body{font:16px/1.5 Arial,sans-serif;color:#16324f;max-width:880px;margin:36px auto;padding:0 25px}h1{font-size:34px}h2{font-size:18px;margin:0 0 8px}header{border-bottom:3px solid #16324f;padding-bottom:22px;margin-bottom:25px}header p{margin:6px 0}section{border-bottom:1px solid #c4d3de;padding:18px 0;break-inside:avoid}section p{margin:6px 0}.crops{display:flex;gap:25px;flex-wrap:wrap;margin:15px 0}figure{margin:0;max-width:44%;border:1px solid #c4d3de;padding:9px}figcaption,.small{font-size:12px;color:#49667b}img{display:block;max-width:100%;height:60px;object-fit:contain;object-position:left;margin-top:8px}.mismatch,.missing{color:#b82e3a}.match{color:#24704e}.review,.notFound{color:#836018}footer{margin:30px 0;font-size:12px}@media print{body{margin:0;max-width:none}header{break-after:avoid}a{color:inherit}}</style><header><h1>ShelfProof review</h1><p>${isSample ? 'Fictional sample / seeded price errors' : 'Artwork price checklist'}</p><p>Artwork: ${escape(artworkName)}<br>Approved list: ${escape(catalogName)}<br>Currency: ${escape(currency)}</p><p>${confirmed} of ${rows.length} decisions confirmed. ${rows.length - confirmed} awaiting review.</p><p>${unclaimed.length} unclaimed artwork readings await review.</p><p class="small">Prepared ${escape(new Date().toISOString())}. Each record separates the original OCR reading from the reviewer’s decision.</p></header>${content}${extraContent}<footer>Created with <a href="https://blucca.github.io/shelfproof/">ShelfProof</a>. This file contains the checklist, unclaimed readings and source crops. Use your browser’s Print command for a PDF copy.</footer></html>`;
  download(html, 'text/html;charset=utf-8', 'shelfproof-review.html'); say('Review downloaded, including SKU decisions and unclaimed artwork readings.');
}
$('proof-form').addEventListener('submit', event => { event.preventDefault(); runProof($('artwork-file').files[0], $('catalog-file').files[0]); });
$('try-sample').addEventListener('click', async () => {
  try {
    $('currency').value = '$';
    const [art, csv] = await Promise.all([fetch('./assets/sample-promo.pdf'), fetch('./assets/sample-prices.csv')]);
    if (!art.ok || !csv.ok) throw new Error('The sample files failed to load. Reload and try again.');
    await runProof(new File([await art.blob()], 'sample-promo.pdf', { type: 'application/pdf' }), new File([await csv.text()], 'sample-prices.csv', { type: 'text/csv' }), true);
  } catch (error) { openDesk(); fail(error); }
});
$('use-files').addEventListener('click', () => { openDesk(); $('artwork-file').focus(); });
$('start-over').addEventListener('click', async () => {
  if (busy) return;
  rows = []; pages = []; approved = []; unclaimed = []; setPicking(false); $('results').hidden = true; $('desk').hidden = true; $('proof-form').reset(); document.body.classList.remove('working'); $('error').hidden = true; say('');
  if (worker) await worker.terminate(); worker = undefined; workerPromise = undefined;
  $('try-sample').focus(); window.scrollTo({ top: 0 });
});
$('sku-list').addEventListener('click', event => { const button = event.target.closest('[data-row]'); if (button && !busy) { setPicking(false); selectRow(Number(button.dataset.row)); } });
$('confirm-form').addEventListener('submit', confirmReading);
$('mark-missing').addEventListener('click', () => {
  if (busy || !rows[selected]) return;
  const row = rows[selected]; row.status = 'missing'; row.reviewed = true; row.ocrCents = null; row.priceBox = null; row.confirmedAt = new Date().toISOString(); row.reason = 'You marked this expected SKU as missing from the artwork.';
  renderRows(); renderDetail(); drawBoxes(); say(`${row.sku}: recorded as missing.`);
});
$('page-picker').addEventListener('change', () => { setPicking(false); pageIndex = Number($('page-picker').value); showPage(); });
$('pick-region').addEventListener('click', () => { if (!busy) setPicking(!picking); });
$('proof-overlay').addEventListener('pointerdown', event => { if (!picking || busy) return; event.preventDefault(); drag = point(event); $('proof-overlay').setPointerCapture(event.pointerId); });
$('proof-overlay').addEventListener('pointermove', event => { if (!drag) return; drawBoxes(); $('proof-overlay').insertAdjacentHTML('beforeend', rectMarkup(boxBetween(drag, point(event)), 'draw-box')); });
$('proof-overlay').addEventListener('pointerup', event => {
  if (!drag) return;
  const box = boxBetween(drag, point(event)); drag = null;
  if (box.x1 - box.x0 < 8 || box.y1 - box.y0 < 8) { drawBoxes(); say('Drag a box around the printed price.'); return; }
  readRegion(box);
});
$('proof-overlay').addEventListener('pointercancel', () => { drag = null; drawBoxes(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && picking) setPicking(false); });
$('export-review').addEventListener('click', exportReview);
$('copy-issues').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(issueText()); say('Issue list copied.'); }
  catch { download(issueText(), 'text/plain;charset=utf-8', 'shelfproof-issues.txt'); say('Issue list downloaded as a text file.'); }
});
for (const id of ['artwork-file', 'catalog-file', 'currency']) $(id).addEventListener('change', () => { if (rows.length) say('New inputs selected. Read artwork to create a fresh review.'); });
