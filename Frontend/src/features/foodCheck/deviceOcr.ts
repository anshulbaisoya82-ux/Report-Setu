/**
 * On-device OCR for food labels (tesseract.js, served from /ocr; no CDN, no server, works offline).
 *
 * Packets are hard to read: shiny film throws glare, and dates/ingredients are often printed
 * as dotted (dot-matrix / inkjet) text. Before OCR every photo is cleaned up in a canvas:
 *  1. resized so small print has enough pixels (long side ≈ 2200 px);
 *  2. glare and uneven light removed: each pixel is divided by a heavily blurred copy
 *     (flat-field correction), so bright reflections and shadows become an even background;
 *  3. contrast stretched (2nd–98th percentile);
 *  4. "dots" variant: blurred just enough that the dots of dot-matrix print merge into strokes;
 *  5. local (Sauvola) threshold to clean black text, with automatic inversion for
 *     light-on-dark print.
 * Several variants are read and the best one (confidence + label words found) is kept.
 * No OCR is perfect on every photo, so the patient always reviews the text afterwards.
 */
import { extractLabel, labelWordCount, type ExtractedLabel } from './labelText';

export interface DeviceOcrResult extends ExtractedLabel {
  rawText: string;
  confidence: number;
  variant: string;
}

type Progress = (p: { stage: string; pct: number }) => void;

const assetBase = () => new URL('ocr/', document.baseURI).href;

// ---------------------------------------------------------------- image helpers
async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(file);
  }
}

/** Box blur via an integral image: O(pixels), any radius. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function percentile(arr: Float32Array, p: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < arr.length; i++) hist[Math.max(0, Math.min(255, arr[i] | 0))]++;
  const target = arr.length * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/** Glare/shadow removal + contrast stretch. Returns 0..255 grey. */
export function normalizeLighting(gray: Float32Array, w: number, h: number): Float32Array {
  const bg = boxBlur(gray, w, h, Math.max(8, Math.round(Math.min(w, h) / 24)));
  const flat = new Float32Array(w * h);
  for (let i = 0; i < flat.length; i++) flat[i] = Math.min(255, (gray[i] / (bg[i] + 1)) * 200);
  const lo = percentile(flat, 0.02), hi = Math.max(lo + 1, percentile(flat, 0.98));
  for (let i = 0; i < flat.length; i++) flat[i] = Math.max(0, Math.min(255, ((flat[i] - lo) / (hi - lo)) * 255));
  return flat;
}

/** Sauvola local threshold → 0 (ink) / 255 (paper). Inverts light-on-dark print. */
export function sauvola(img: Float32Array, w: number, h: number, r: number, k = 0.25): Uint8ClampedArray {
  const mean = boxBlur(img, w, h, r);
  const sq = new Float32Array(img.length);
  for (let i = 0; i < img.length; i++) sq[i] = img[i] * img[i];
  const meanSq = boxBlur(sq, w, h, r);
  const out = new Uint8ClampedArray(img.length);
  let ink = 0;
  for (let i = 0; i < img.length; i++) {
    const sd = Math.sqrt(Math.max(0, meanSq[i] - mean[i] * mean[i]));
    const t = mean[i] * (1 + k * (sd / 128 - 1));
    const v = img[i] < t ? 0 : 255;
    out[i] = v;
    if (v === 0) ink++;
  }
  if (ink > img.length * 0.5) for (let i = 0; i < out.length; i++) out[i] = 255 - out[i];
  return out;
}

function toCanvas(px: ArrayLike<number>, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const data = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = px[i];
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = v;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** Builds the cleaned-up variants that are sent to OCR. Exported for tests. */
export async function prepareVariants(file: Blob): Promise<{ name: string; canvas: HTMLCanvasElement }[]> {
  const bmp = await loadBitmap(file);
  const long = Math.max(bmp.width, bmp.height);
  const scale = Math.min(3, Math.max(0.3, 2200 / long));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  // Minimum channel keeps coloured print (red/blue ink) dark against white film.
  for (let i = 0; i < w * h; i++) gray[i] = Math.min(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) * 0.6 + (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) * 0.4;

  // Light print on a dark pouch: flip so every variant is dark text on a light background.
  const sorted = Float32Array.from(gray).sort();
  if (sorted[Math.floor(sorted.length / 2)] < 105) for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
  const original = Float32Array.from(gray);

  const flat = normalizeLighting(gray, w, h);
  const win = Math.max(10, Math.round(Math.min(w, h) / 60));
  const dotsSoft = boxBlur(flat, w, h, Math.max(1, Math.round(Math.min(w, h) / 900)));
  const dotsSofter = boxBlur(flat, w, h, Math.max(2, Math.round(Math.min(w, h) / 500)));

  return [
    { name: 'original photo', canvas: toCanvas(original, w, h) },
    { name: 'glare-corrected', canvas: toCanvas(flat, w, h) },
    { name: 'clean black-and-white', canvas: toCanvas(sauvola(flat, w, h, win), w, h) },
    { name: 'dotted print joined', canvas: toCanvas(sauvola(dotsSoft, w, h, win), w, h) },
    { name: 'dotted print joined (strong)', canvas: toCanvas(sauvola(dotsSofter, w, h, win), w, h) },
  ];
}

// ---------------------------------------------------------------- OCR
let workerPromise: Promise<any> | null = null;

async function getWorker(progress?: Progress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const base = assetBase();
      // English model: gzip bytes stored as ocr/lang/eng.traineddata.wasm so any static host serves it.
      // tesseract.js requests `${langPath}/eng.traineddata`; ending langPath with "?" turns that suffix
      // into a query string, so the .wasm file is what gets downloaded (gzip is detected from its bytes).
      const worker = await createWorker('eng', 1, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang/eng.traineddata.wasm?`,
        gzip: false,
        cacheMethod: 'none',
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          if (m.status?.startsWith('loading') || m.status?.startsWith('initializ')) progress?.({ stage: 'Preparing the reader', pct: Math.round((m.progress || 0) * 20) });
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Plain OCR of the untouched photo (no clean-up). Used to compare in tests. */
export async function readRawOnDevice(file: Blob): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  return { text: data.text || '', confidence: data.confidence || 0 };
}

/** Rates an OCR attempt by what matters: known label words, the Ingredients heading, the nutrition column. */
const score = (text: string, conf: number) => {
  const ex = extractLabel(text);
  return conf * 0.5 + labelWordCount(text) * 4 + (ex.foundIngredientsHeading ? 15 : 0) + (ex.per100g.sugars != null || ex.per100g.salt != null ? 10 : 0);
};

/**
 * Reads a label photo on the device. Tries the cleaned variants and keeps the best.
 * Stops early when a variant is clearly good.
 */
export async function readLabelOnDevice(file: Blob, progress?: Progress): Promise<DeviceOcrResult> {
  progress?.({ stage: 'Cleaning up the photo', pct: 2 });
  const [worker, variants] = await Promise.all([getWorker(progress), prepareVariants(file)]);
  let best: { text: string; conf: number; s: number; name: string } | null = null;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    progress?.({ stage: `Reading the text (${i + 1} of ${variants.length})`, pct: 20 + Math.round((i / variants.length) * 75) });
    const { data } = await worker.recognize(v.canvas);
    const text: string = data.text || '';
    const s = score(text, data.confidence || 0);
    if (!best || s > best.s) best = { text, conf: data.confidence || 0, s, name: v.name };
    // Always compare the original with the glare-corrected version before stopping early.
    if (i >= 1 && best.conf >= 85 && /ingred/i.test(best.text) && labelWordCount(best.text) >= 12) break;
  }
  progress?.({ stage: 'Done', pct: 100 });
  const text = best?.text || '';
  const extracted = extractLabel(text);
  const warnings = [...extracted.warnings];
  if (!text.trim()) warnings.unshift('No text could be read. Try again with the label flat, filling the frame, without flash.');
  else if ((best?.conf || 0) < 60) warnings.unshift('The photo was hard to read. Please compare the text with the packet carefully.');
  return { ...extracted, warnings, rawText: text, confidence: Math.round(best?.conf || 0), variant: best?.name || '' };
}
