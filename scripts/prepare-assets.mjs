import { mkdir, cp, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = join(root, 'web/vendor');
const modules = join(root, 'node_modules');
await mkdir(vendor, { recursive: true });
async function copy(source, target) {
  const destination = join(vendor, target);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(modules, source), destination, { recursive: true });
}
async function download(url, destination, gzip = false) {
  const path = join(vendor, destination);
  try { if ((await stat(path)).size > 0) return; } catch {}
  await mkdir(dirname(path), { recursive: true });
  console.log(`Fetching ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Asset download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, gzip ? gzipSync(bytes, { level: 9 }) : bytes);
}
for (const file of ['tesseract.min.js', 'worker.min.js', 'tesseract.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt']) {
  await copy(`tesseract.js/dist/${file}`, `tesseract/${file}`);
}
await copy('tesseract.js/LICENSE.md', 'tesseract/LICENSE.md');
for (const file of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'LICENSE']) {
  await copy(`tesseract.js-core/${file}`, `tesseract/core/${file}`);
}
for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) await copy(`pdfjs-dist/build/${file}`, `pdfjs/${file}`);
for (const directory of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) await copy(`pdfjs-dist/${directory}`, `pdfjs/${directory}`);
await copy('pdfjs-dist/LICENSE', 'pdfjs/LICENSE');
await download('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata', 'tesseract/lang/eng.traineddata.gz', true);
await download('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/LICENSE', 'tesseract/lang/LICENSE');
for (const [directory, names] of [['barlow', ['Barlow-Regular.ttf', 'Barlow-SemiBold.ttf']], ['barlowcondensed', ['BarlowCondensed-SemiBold.ttf']]]) {
  for (const name of names) await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${directory}/${name}`, `fonts/${name}`);
  await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${directory}/OFL.txt`, `fonts/${directory}-OFL.txt`);
}
for (const path of ['tesseract/worker.min.js', 'tesseract/core/tesseract-core-lstm.wasm.js', 'tesseract/lang/eng.traineddata.gz', 'pdfjs/pdf.worker.min.mjs', 'fonts/Barlow-Regular.ttf']) {
  assert((await stat(join(vendor, path))).size > 0, `${path} is present`);
}
console.log('Local OCR, PDF rendering, font assets and licenses are ready.');
