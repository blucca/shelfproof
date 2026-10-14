const CURRENCIES = '$£€';
const MIN_CONFIDENCE = 80;

function decimalCents(value) {
  const [whole, fraction = ''] = value.replaceAll(',', '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

/** Read a complete decimal amount. OCR letter substitutions stay unresolved. */
export function parsePrice(text) {
  const value = String(text ?? '').normalize('NFKC').trim();
  const match = value.match(/^([$£€])?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*([$£€])?$/);
  return match && !(match[1] && match[3]) ? decimalCents(match[2]) : null;
}

export function formatPrice(cents, currency = '$') {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Price must be a non-negative integer number of cents.');
  return `${currency}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function normalizeSKU(text) {
  return text.normalize('NFKC').toUpperCase()
    .replace(/[‐‑‒–—―−]/g, '-')
    .trim().replace(/^SKU(?:\s*[:#]\s*|\s+)/, '').replace(/\s+/g, '');
}

export function parseCatalogCSV(text) {
  if (typeof text !== 'string') throw new Error('Provide a CSV text file.');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const endField = () => { row.push(field); field = ''; closed = false; };
  const endRow = () => {
    endField();
    if (row.some(value => value.trim())) rows.push(row);
    row = [];
  };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') endField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else if (char === '"') {
      if (field.trim() || closed) throw new Error(`CSV row ${rows.length + 1}: unexpected quote.`);
      field = ''; quoted = true;
    } else if (closed) {
      if (!/\s/.test(char)) throw new Error(`CSV row ${rows.length + 1}: text after a closing quote.`);
    } else field += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  if (field || row.length || closed) endRow();
  const headers = (rows.shift() ?? []).map(value => value.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names.');
  if (['sku', 'name', 'price'].some(key => !headers.includes(key))) throw new Error('CSV needs sku, name, and price columns.');
  if (!rows.length) throw new Error('CSV needs at least one product.');
  if (rows.length > 50) throw new Error('A proof supports up to 50 catalogue products.');
  const seen = new Set();
  return rows.map((values, index) => {
    const location = `CSV row ${index + 2}`;
    if (values.length !== headers.length) throw new Error(`${location}: expected ${headers.length} fields.`);
    const read = key => values[headers.indexOf(key)].trim();
    const sku = read('sku'), name = read('name'), price = read('price');
    const key = normalizeSKU(sku);
    if (!key || !name) throw new Error(`${location}: sku and name are required.`);
    if (seen.has(key)) throw new Error(`${location}: duplicate SKU ${sku}.`);
    if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw new Error(`${location}: use a decimal price such as 24.50.`);
    const expectedCents = decimalCents(price);
    if (expectedCents === null) throw new Error(`${location}: price exceeds the supported amount.`);
    seen.add(key);
    return { sku, name, price, expectedCents };
  });
}

const cx = box => (box.x0 + box.x1) / 2;
const cy = box => (box.y0 + box.y1) / 2;
const height = box => box.y1 - box.y0;
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const sameLine = (a, b) => overlap(a.y0, a.y1, b.y0, b.y1) >= Math.min(height(a), height(b)) * 0.4;
const unionBox = words => ({
  x0: Math.min(...words.map(word => word.bbox.x0)), y0: Math.min(...words.map(word => word.bbox.y0)),
  x1: Math.max(...words.map(word => word.bbox.x1)), y1: Math.max(...words.map(word => word.bbox.y1)),
});

function cleanWords(words) {
  return (words ?? []).map((word, index) => ({
    ...word, index, text: String(word.text ?? '').normalize('NFKC').trim(),
    confidence: Number.isFinite(Number(word.confidence)) ? Math.max(0, Math.min(100, Number(word.confidence))) : 0,
    bbox: { ...word.bbox },
  })).filter(word => word.text && ['x0', 'y0', 'x1', 'y1'].every(key => Number.isFinite(word.bbox[key]))
    && word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0);
}

function nextWord(word, words) {
  return words.filter(next => next.index !== word.index && sameLine(word.bbox, next.bbox)
    && next.bbox.x0 >= word.bbox.x1 - 2
    && next.bbox.x0 - word.bbox.x1 <= Math.max(height(word.bbox), height(next.bbox)) * 0.9 + 3)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)[0];
}

export function priceCandidates(words, currency = '$') {
  const clean = cleanWords(words), used = new Set(), result = [];
  const add = group => {
    // A split cents fragment keeps its pixels and requires transcription review.
    if (!group.some(word => word.text.includes('.'))) {
      let tail = nextWord(group.at(-1), clean);
      if (tail && !used.has(tail.index) && /^(?:\.|\.\d{1,2}|\d{2})$/.test(tail.text)) {
        group.push(tail);
        if (tail.text === '.') {
          tail = nextWord(tail, clean);
          if (tail && !used.has(tail.index) && /^\d{1,2}$/.test(tail.text)) group.push(tail);
        }
      }
    }
    const text = group.map(word => word.text).join(' ');
    const symbols = text.match(/[$£€]/g) ?? [];
    result.push({ pageIndex: 0, text, cents: symbols.some(symbol => symbol !== currency) ? null : parsePrice(text),
      bbox: unionBox(group), confidence: Math.min(...group.map(word => word.confidence)) });
    group.forEach(word => used.add(word.index));
  };
  for (const word of clean) {
    if (word.text.length !== 1 || !CURRENCIES.includes(word.text)) continue;
    const next = nextWord(word, clean);
    if (next && /^[\dOIl][\w.,]*$/.test(next.text) && !used.has(next.index)) add([word, next]);
  }
  for (const word of clean) {
    if (used.has(word.index)) continue;
    // Bare integer tokens also occur in SKUs and counts; currency or cents makes a price candidate.
    if ((/[$£€]/.test(word.text) && word.text.length > 1)
      || /^\d[\d,]*\.\d{2}$/.test(word.text)) add([word]);
  }
  return result.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

const uncertainSKU = sku => sku.replace(/O/g, '0').replace(/[IL]/g, '1');

function findSKUs(words, catalog, pageIndex) {
  const targets = new Map(catalog.map(item => [normalizeSKU(item.sku), item.sku]));
  const hits = [];
  for (const first of words) {
    const group = [];
    let word = first;
    // ponytail: six adjacent OCR words cover a split SKU label; wider layouts use manual region review.
    while (word && group.length < 6 && !group.some(part => part.index === word.index)) {
      group.push(word);
      const key = normalizeSKU(group.map(part => part.text).join(' '));
      const exact = targets.get(key);
      const matches = exact ? [exact] : [...targets].filter(([target]) => /[\d-]/.test(key)
        && uncertainSKU(key) === uncertainSKU(target)).map(([, sku]) => sku);
      for (const sku of matches) {
        const hit = { sku, pageIndex, bbox: unionBox(group), confidence: Math.min(...group.map(part => part.confidence)),
          indices: group.map(part => part.index), ambiguous: !exact };
        const existing = hits.findIndex(other => other.sku === sku && other.indices.some(index => hit.indices.includes(index)));
        if (existing === -1) hits.push(hit);
        else if ((hits[existing].ambiguous && exact) || hit.indices.length < hits[existing].indices.length) hits[existing] = hit;
      }
      word = nextWord(word, words);
    }
  }
  for (const hit of hits) {
    if (hits.some(other => other.sku !== hit.sku && other.indices.some(index => hit.indices.includes(index)))) hit.ambiguous = true;
    const parts = words.filter(word => hit.indices.includes(word.index)).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const tail = nextWord(parts.at(-1), words);
    const prefix = words.find(word => !hit.indices.includes(word.index) && /[-_/]$/.test(word.text)
      && nextWord(word, words)?.index === parts[0].index);
    if (prefix || (tail && /^(?:[-_/]|\d+)$/.test(tail.text))) hit.ambiguous = true;
  }
  return hits;
}

function pairingScore(hit, candidate, hits, page) {
  const a = hit.bbox, b = candidate.bbox;
  if (overlap(a.x0, a.x1, b.x0, b.x1) && overlap(a.y0, a.y1, b.y0, b.y1)) return null;
  const dx = Math.abs(cx(a) - cx(b));
  if (sameLine(a, b)) {
    const right = b.x0 >= a.x1 - 2;
    const gap = right ? b.x0 - a.x1 : a.x0 - b.x1;
    if (gap < -2) return null;
    const between = hits.some(other => other !== hit && sameLine(a, other.bbox)
      && cx(other.bbox) > Math.min(cx(a), cx(b)) && cx(other.bbox) < Math.max(cx(a), cx(b)));
    if (between) return null;
    return Math.max(0, gap) * 0.3 + Math.abs(cy(a) - cy(b)) + (right ? 0 : page.width * 0.3);
  }
  const below = b.y0 >= a.y1;
  const gap = below ? b.y0 - a.y1 : a.y0 - b.y1;
  if (gap < 0 || gap > page.height * 0.22 || dx > page.width * 0.3) return null;
  if (hits.some(other => other !== hit && Math.abs(cx(other.bbox) - cx(a)) < page.width * 0.16
    && cy(other.bbox) > Math.min(cy(a), cy(b)) && cy(other.bbox) < Math.max(cy(a), cy(b)))) return null;
  return gap * 2 + dx + height(a) * (below ? 1 : 2);
}

/** Monetary equality is evaluated only after OCR identity and spatial association. */
export function buildReview(catalog, pages, currency = '$') {
  const allHits = [], owners = new Map(), byHit = new Map();
  pages.forEach((page, pageIndex) => {
    const words = cleanWords(page.words);
    const hits = findSKUs(words, catalog, pageIndex);
    allHits.push(...hits);
    for (const hit of hits) byHit.set(hit, []);
    for (const price of priceCandidates(words, currency)) {
      const candidate = { ...price, pageIndex };
      const scores = hits.map(hit => ({ hit, score: pairingScore(hit, candidate, hits, page) }))
        .filter(item => item.score !== null).sort((a, b) => a.score - b.score);
      if (!scores.length) continue;
      const tolerance = Math.max(height(scores[0].hit.bbox) * 1.2, scores[0].score * 0.2);
      const plausible = scores.filter(item => item.score <= scores[0].score + tolerance);
      owners.set(candidate, plausible.map(item => item.hit));
      for (const { hit } of plausible) byHit.get(hit).push(candidate);
    }
  });
  return catalog.map(item => {
    const hits = allHits.filter(hit => hit.sku === item.sku);
    const candidates = [...new Set(hits.flatMap(hit => byHit.get(hit)))];
    const selected = candidates.length === 1 ? candidates[0] : null;
    const hit = hits.find(entry => selected && byHit.get(entry).includes(selected)) ?? hits[0];
    const confidence = hit ? Math.min(hit.confidence, selected?.confidence ?? hit.confidence) : 0;
    const row = { sku: item.sku, name: item.name, expectedCents: item.expectedCents,
      ocrCents: selected?.cents ?? null, ocrText: selected?.text ?? '', confidence,
      pageIndex: hit?.pageIndex ?? null, skuBox: hit?.bbox ?? null, priceBox: selected?.bbox ?? null,
      status: 'review', candidates, reason: '' };
    if (!hits.length) { row.status = 'notFound'; row.reason = 'Complete SKU reading missing; locate this item on the artwork.'; }
    else if (hits.some(entry => entry.ambiguous)) row.reason = 'Confusable or overlapping SKU readings; confirm the printed identifier.';
    else if (hits.length > 1) row.reason = `${hits.length} SKU occurrences; choose the intended occurrence and price.`;
    else if (candidates.some(candidate => owners.get(candidate).length > 1)) row.reason = 'A price region is shared by several SKU matches; confirm the association.';
    else if (!candidates.length) row.reason = 'Select the price region for this SKU.';
    else if (candidates.length > 1) row.reason = `${candidates.length} nearby price regions; select the intended price.`;
    else if (selected.cents === null) row.reason = 'Confirm the currency and read the amount in the highlighted price region.';
    else if (confidence < MIN_CONFIDENCE) row.reason = `The pair OCR score is below ${MIN_CONFIDENCE}/100; confirm the highlighted SKU and price.`;
    else {
      row.status = selected.cents === item.expectedCents ? 'match' : 'mismatch';
      row.reason = `Approved ${formatPrice(item.expectedCents, currency)}; OCR read ${formatPrice(selected.cents, currency)}.`;
    }
    return row;
  });
}

const skuShape = key => /^\d+$/.test(key) ? `digits:${key.length}` : key.replace(/[A-Z]+/g, 'A').replace(/\d+/g, '0');
const coversReading = (box, reading) => overlap(box.x0, box.x1, reading.x0, reading.x1)
  * overlap(box.y0, box.y1, reading.y0, reading.y1) >= (reading.x1 - reading.x0) * (reading.y1 - reading.y0) * 0.8;

/** Retain artwork readings beyond the current approved-SKU selections. */
export function unclaimedReadings(catalog, pages, rows, currency = '$') {
  const targets = catalog.map(item => normalizeSKU(item.sku));
  const shapes = new Set(targets.map(skuShape));
  const extras = [];
  pages.forEach((page, pageIndex) => {
    const words = cleanWords(page.words), prices = priceCandidates(words, currency), claimed = new Set();
    for (const row of rows) {
      if (row.pageIndex !== pageIndex || !row.priceBox) continue;
      const inside = prices.filter(price => coversReading(row.priceBox, price.bbox));
      // A broad manual selection containing several prices keeps them in the artwork check.
      if (inside.length === 1) claimed.add(inside[0]);
    }
    for (const price of prices) if (!claimed.has(price)) extras.push({ ...price, pageIndex, kind: 'price' });

    const labels = [];
    for (const first of words) {
      const group = [];
      let word = first;
      // ponytail: use the catalogue's code shapes or explicit SKU labels; other copy stays on the full proof.
      while (word && group.length < 6 && !group.some(part => part.index === word.index)) {
        group.push(word);
        const text = group.map(part => part.text).join(' '), key = normalizeSKU(text);
        const explicit = /^SKU(?:\s*[:#]\s*|\s+)\S/i.test(text);
        if (/^[A-Z0-9][A-Z0-9_/-]*$/.test(key)
          && (explicit || (/\d/.test(key) && shapes.has(skuShape(key))))
          && !targets.some(target => uncertainSKU(key) === uncertainSKU(target))
          && !group.some(part => prices.some(price => coversReading(price.bbox, part.bbox)))) {
          const label = { kind: 'sku', text, key, pageIndex, bbox: unionBox(group),
            confidence: Math.min(...group.map(part => part.confidence)), indices: group.map(part => part.index) };
          const existing = labels.findIndex(other => other.indices.some(index => label.indices.includes(index)));
          if (existing === -1) labels.push(label);
          else if ((labels[existing].key === key && label.indices.length < labels[existing].indices.length)
            || (labels[existing].key !== key && label.indices.length > labels[existing].indices.length)) labels[existing] = label;
        }
        word = nextWord(word, words);
      }
    }
    for (const { key, indices, ...label } of labels) extras.push(label);
  });
  return extras.sort((a, b) => a.pageIndex - b.pageIndex || a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}
