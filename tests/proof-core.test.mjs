import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogCSV, parsePrice, formatPrice, priceCandidates, buildReview, unclaimedReadings } from '../web/proof-core.mjs';

const word = (text, x, y, width = 90, confidence = 96) => ({
  text, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + 24 }, lineId: `line-${y}`,
});
const page = words => ({ width: 1400, height: 1800, words });

test('CSV quoting, exact cents, and catalogue errors', () => {
  const rows = parseCatalogCSV('\uFEFFsku,name,price\r\nSP-1,"Notebook, \"\"Blue\"\"",8.50\r\nSP-2,"Two\nlines",12\r\n');
  assert.deepEqual(rows, [
    { sku: 'SP-1', name: 'Notebook, "Blue"', price: '8.50', expectedCents: 850 },
    { sku: 'SP-2', name: 'Two\nlines', price: '12', expectedCents: 1200 },
  ]);
  for (const invalid of [
    'sku,name,price\nA,One,2.999', 'sku,name,price\nA,One,-2',
    'sku,name,price\nA,One,2e2', 'sku,name,price\nA,One,900719925474099.00',
    'sku,name,price\nA,One,2\nA,Two,3', 'sku,name,price\nSP–1,One,2\nSP-1,Two,3',
    'sku,name,price\nA,"Open,2', 'sku,name,price\nA,"Name"oops,2', 'sku,price\nA,2',
    `sku,name,price\n${Array.from({ length: 51 }, (_, i) => `A${i},Name,2`).join('\n')}`,
  ]) assert.throws(() => parseCatalogCSV(invalid), Error);
});

test('price text stays separate from OCR correction', () => {
  for (const [text, cents] of [['$ 24.50', 2450], ['£8.5', 850], ['€1,024.09', 102409], ['12.00 €', 1200], ['0.29', 29], ['32', 3200]]) {
    assert.equal(parsePrice(text), cents);
  }
  for (const text of ['$2O.00', '24,50', '-12.00', '1.234', '$24£', '12 34', 'sale $12.00']) assert.equal(parsePrice(text), null);
  assert.equal(formatPrice(29), '$0.29');
  assert.equal(formatPrice(102409, '€'), '€1024.09');
  const candidates = priceCandidates([word('$', 100, 100, 12), word('24.50', 118, 100, 75), word('200', 400, 100)]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].cents, 2450);
  assert.deepEqual(candidates[0].bbox, { x0: 100, y0: 100, x1: 193, y1: 124 });
  assert.equal(priceCandidates([word('£24.50', 100, 100)], '$')[0].cents, null);
  const splitCents = priceCandidates([word('$12', 100, 100, 35), word('.50', 141, 100, 30)])[0];
  assert.equal(splitCents.cents, null);
  assert.equal(splitCents.text, '$12 .50');
});

test('two-column proof catches swapped prices and keeps every expected SKU', () => {
  const catalog = parseCatalogCSV('sku,name,price\nSP-101,Dot Notebook,8.50\nSP-102,Canvas Pouch,12.00\nSP-103,Ceramic Mug,14.50\nSP-104,Desk Planter,18.00\nSP-105,Brass Clips,6.75\nSP-106,Task Light,32.00\nSP-107,Felt Coaster,4.25');
  const words = [
    word('SKU:', 100, 400, 38), word('SP–101', 147, 400), word('$12.00', 510, 400),
    word('SP-102', 780, 400), word('$8.50', 1180, 400),
    word('SP-103', 100, 900), word('$14.50', 510, 900),
    word('SP-104', 780, 900), word('$18.00', 1180, 900),
    word('SP-105', 100, 1400), word('$6.75', 510, 1400),
    word('SP-106', 780, 1400), word('$23.00', 1180, 1400),
    word('SP-1070', 100, 1600),
  ];
  const result = buildReview(catalog, [page(words)]);
  assert.deepEqual(result.map(row => row.status), ['mismatch', 'mismatch', 'match', 'match', 'match', 'mismatch', 'notFound']);
  assert.deepEqual(result.map(row => row.ocrCents), [1200, 850, 1450, 1800, 675, 2300, null]);
  assert.equal(result[0].pageIndex, 0);
  assert.equal(result[0].priceBox.x0, 510);
  assert.equal(result[1].priceBox.x0, 1180);
});

test('multiple prices, shared regions, duplicate identifiers, and weak readings require review', () => {
  const one = parseCatalogCSV('sku,name,price\nSP-101,Item,8.50');
  assert.equal(buildReview(one, [page([word('SP-101', 100, 100), word('$8.50', 300, 100), word('$12.00', 450, 100)])])[0].status, 'review');
  const two = parseCatalogCSV('sku,name,price\nSP-101,One,8.50\nSP-102,Two,8.50');
  const shared = buildReview(two, [page([word('SP-101', 100, 100), word('SP-102', 240, 100), word('$8.50', 170, 175)])]);
  assert.deepEqual(shared.map(row => row.status), ['review', 'review']);
  assert.ok(shared.every(row => row.reason.includes('shared')));
  const duplicate = buildReview(one, [page([word('SP-101', 100, 100), word('$8.50', 300, 100)]), page([word('SP-101', 100, 100), word('$8.50', 300, 100)])])[0];
  assert.equal(duplicate.status, 'review');
  assert.equal(duplicate.candidates.length, 2);
  assert.deepEqual(duplicate.candidates.map(candidate => candidate.pageIndex), [0, 1]);
  assert.equal(buildReview(one, [page([word('SP-101', 100, 100), word('$8.50', 300, 100, 90, 45)])])[0].status, 'review');
  assert.equal(buildReview(one, [page([word('SP-1O1', 100, 100), word('$8.50', 300, 100)])])[0].status, 'review');
  const unreadable = buildReview(one, [page([word('SP-101', 100, 100), word('$8.SO', 300, 100)])])[0];
  assert.equal(unreadable.status, 'review');
  assert.equal(unreadable.ocrText, '$8.SO');
  assert.equal(unreadable.priceBox.x0, 300);
  const partialSKU = buildReview(one, [page([word('SP-101', 100, 100), word('0', 195, 100, 12), word('$8.50', 300, 100)])])[0];
  assert.equal(partialSKU.status, 'review');
});

test('split SKU words and the same-column price below remain paired', () => {
  const catalog = parseCatalogCSV('sku,name,price\nSP-101,One,8.50\nSP-102,Two,12.00');
  const words = [word('SKU:', 100, 100, 36), word('SP', 144, 100, 28), word('—', 180, 100, 12), word('101', 200, 100, 40),
    word('$8.50', 150, 160), word('SP-102', 800, 100), word('$12.00', 850, 160)];
  const copy = structuredClone(words);
  const result = buildReview(catalog, [page(words)]);
  assert.deepEqual(result.map(row => row.status), ['match', 'match']);
  assert.deepEqual(words, copy);
});


test('two prices across a wide single-SKU row stay in manual review', () => {
  const word = (text, x0, x1) => ({ text, confidence: 96, bbox: { x0, y0: 100, x1, y1: 140 } });
  const catalog = parseCatalogCSV('sku,name,price\nPN-206,Pen Loop,4.50\n');
  const page = { width: 1400, height: 900, words: [word('PN-206', 80, 225), word('£6.00', 650, 820), word('£4.50', 1030, 1200)] };
  const [row] = buildReview(catalog, [page], '£');
  assert.equal(row.status, 'review');
  assert.equal(row.candidates.length, 2);
  assert.equal(row.ocrCents, null);
});

test('extra labels and prices survive the review and follow current region selections', () => {
  const catalog = parseCatalogCSV('sku,name,price\nSP-106,Task Light,32.00');
  const base = [word('SP-106', 780, 1400), word('$23.00', 1180, 1400)];
  const baseline = buildReview(catalog, [page(base)]);
  assert.deepEqual(unclaimedReadings(catalog, [page(base)], baseline), []);
  const check = extra => {
    const pages = [page([...base, ...extra])], rows = buildReview(catalog, pages);
    return { pages, rows, extras: unclaimedReadings(catalog, pages, rows) };
  };
  const label = check([word('SP-999', 100, 100)]);
  assert.deepEqual(label.rows, baseline);
  assert.deepEqual(label.extras.map(x => [x.kind, x.text]), [['sku', 'SP-999']]);
  const distant = check([word('$99.00', 100, 100)]);
  assert.deepEqual(distant.rows, baseline);
  assert.deepEqual(distant.extras.map(x => [x.kind, x.cents]), [['price', 9900]]);
  const nearby = check([word('SP-999', 780, 1470), word('$99.00', 1180, 1470)]);
  assert.equal(nearby.rows[0].status, 'review');
  assert.deepEqual(nearby.extras.map(x => [x.kind, x.text]), [['price', '$23.00'], ['sku', 'SP-999'], ['price', '$99.00']]);
  nearby.rows[0].priceBox = nearby.rows[0].candidates[0].bbox;
  assert.deepEqual(unclaimedReadings(catalog, nearby.pages, nearby.rows).map(x => x.text), ['SP-999', '$99.00']);
  nearby.rows[0].priceBox = { x0: 1170, y0: 1390, x1: 1280, y1: 1500 };
  assert.equal(unclaimedReadings(catalog, nearby.pages, nearby.rows).filter(x => x.kind === 'price').length, 2);
  const split = check([word('SKU:', 100, 100, 36), word('SP', 144, 100, 28), word('—', 180, 100, 12), word('999', 200, 100, 40)]);
  assert.equal(split.extras.length, 1);
  assert.equal(split.extras[0].text, 'SP — 999');
  const twoPages = [page(base), page([word('$23.00', 1180, 1400)])];
  assert.deepEqual(unclaimedReadings(catalog, twoPages, buildReview(catalog, twoPages)).map(x => x.pageIndex), [1]);
});
