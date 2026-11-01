import { config } from '../config/env';
import { logger } from '../utils/logger';
import { ServiceUnavailableError } from '../utils/errors';

/**
 * Reads a photo of a food packet: copies the ingredient list and the nutrition-table numbers.
 * Transcription only. It does not judge the food; the app compares the result with the
 * doctor's rules, and the patient reviews/corrects the text first. The photo is not stored.
 * Uses the same Gemini Vision setup as the lab-report reader (GEMINI_API_KEY).
 */

export interface NutritionValues {
  sugars: number | null;
  salt: number | null;
  sodium: number | null;
  saturatedFat: number | null;
}

export interface LabelReading {
  ingredientsText: string;
  /** Grams per 100 g/ml, when the label prints a per-100 column (or we could convert from per serving). */
  per100g: NutritionValues;
  /** True when per-100 g values were calculated from per-serving values and serving size. */
  convertedFromServing: boolean;
  /** Text the reader could not be sure about, shown to the patient to check. */
  warnings: string[];
}

const PROMPT = `You are transcribing a photo of a packaged food label. Copy text exactly; do not judge or advise.
Return strictly valid JSON with this schema:
{
  "ingredientsText": "the full ingredient list exactly as printed, including any 'Contains' / 'May contain' allergen lines; empty string if not visible",
  "nutrition": {
    "basis": "per100g" | "perServing" | "none",
    "servingSizeG": number | null,
    "sugars_g": number | null,
    "salt_g": number | null,
    "sodium_mg": number | null,
    "saturatedFat_g": number | null
  },
  "unreadable": ["short notes about any part that is blurred or cut off"]
}
Reading tips: packets are often shiny, curved or crinkled. Read text under glare and reflections as far as it is visible.
Dotted (dot-matrix / inkjet) print, embossed text and light text on dark film are normal: read them as ordinary letters.
If the ingredient list continues on another panel in the photo, include all of it, in printed order.
If a word or number is only partly visible, copy what is certain and add a short note to "unreadable"; never fill gaps with likely words.
Rules: prefer the per 100 g / 100 ml column when the label has one. Use null for anything not printed. Never estimate.`;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const round = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

/** Turns the model's JSON into a LabelReading. Exported for tests. */
export function toLabelReading(parsed: any): LabelReading {
  const n = parsed?.nutrition || {};
  const basis = n.basis === 'perServing' ? 'perServing' : n.basis === 'per100g' ? 'per100g' : 'none';
  const warnings: string[] = Array.isArray(parsed?.unreadable) ? parsed.unreadable.filter((x: unknown) => typeof x === 'string').slice(0, 5) : [];

  let factor: number | null = basis === 'per100g' ? 1 : null;
  const serving = num(n.servingSizeG);
  if (basis === 'perServing') {
    if (serving && serving > 0) factor = 100 / serving;
    else warnings.push('Nutrition is given per serving without a serving size, so it could not be compared per 100 g.');
  }

  const scale = (v: unknown) => (factor == null ? null : round(num(v) == null ? null : num(v)! * factor));
  const sodiumMg = scale(n.sodium_mg);
  let salt = scale(n.salt_g);
  // Salt ≈ sodium × 2.5. Only derived when the label prints sodium but not salt.
  if (salt == null && sodiumMg != null) salt = round((sodiumMg / 1000) * 2.5);

  return {
    ingredientsText: typeof parsed?.ingredientsText === 'string' ? parsed.ingredientsText.trim().slice(0, 4000) : '',
    per100g: { sugars: scale(n.sugars_g), salt, sodium: sodiumMg, saturatedFat: scale(n.saturatedFat_g) },
    convertedFromServing: basis === 'perServing' && factor != null,
    warnings,
  };
}

export async function readFoodLabel(buffer: Buffer, mimeType: string): Promise<LabelReading> {
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError('Reading photos is not set up on this server. Please type the ingredients instead.');
  }

  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: buffer.toString('base64') } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };

  for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(t));
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return toLabelReading(JSON.parse(text.replace(/```json|```/g, '').trim()));
    } catch (err) {
      logger.warn({ err, model, type: 'food_label_read_failed' }, 'Food label reading attempt failed');
    }
  }
  throw new ServiceUnavailableError('Could not read this photo. Try a clearer photo, or type the ingredients.');
}
