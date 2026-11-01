// Copies the on-device OCR engine (tesseract.js worker, WASM core, English data) into public/ocr
// so the app serves them itself: no CDN, works offline and inside the demo.
// The language file keeps its gzip bytes but uses a .wasm name, because some static hosts
// (e.g. the demo artifact host) refuse .gz files; tesseract.js detects gzip by its magic bytes.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'ocr');
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const files = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), join(out, 'worker.min.js')],
  [join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'), join(out, 'core', 'tesseract-core-simd-lstm.wasm.js')],
  [join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'), join(out, 'core', 'tesseract-core-lstm.wasm.js')],
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'), join(out, 'lang', 'eng.traineddata.wasm')],
];
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.warn(`[ocr] missing ${from}; on-device OCR will be unavailable`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log('[ocr] assets copied to public/ocr');
