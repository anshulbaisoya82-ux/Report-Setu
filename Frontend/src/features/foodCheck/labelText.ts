/**
 * Turns raw OCR text from a food packet into: the ingredient list, and the per-100 g
 * numbers for sugar, salt (or sodium) and saturated fat. Pure functions, unit-tested.
 * Nothing is guessed: a value that cannot be found stays null and the patient can type it.
 */

export interface ExtractedLabel {
  ingredientsText: string;
  per100g: { sugars: number | null; salt: number | null; saturatedFat: number | null };
  /** Things the patient should look at, e.g. "Could not find the word Ingredients". */
  warnings: string[];
  foundIngredientsHeading: boolean;
}

/** Common OCR slips on packets: "lngredients", "INGREDlENTS", "Ingrediants", "Ingred1ents". */
const INGREDIENTS_RE = /\b[il1|]n[gq]r[eéc][d][il1|][eéa]n[t1l][s5]?\b\s*[:;.\-–]?/i;
const STOP_RE = new RegExp(
  [
    'nutrition(al)?\\s*(information|facts|value|values|info)',
    'nutrient',
    'allergen\\s*(advice|information|info)',
    'storage',
    'store in',
    'best\\s*before',
    'use\\s*by',
    'mfd|mfg|manufactured\\s*(by|on)',
    'marketed\\s*by',
    'packed\\s*(by|on)',
    'net\\s*(wt|weight|qty|quantity)',
    'batch',
    'm\\.?r\\.?p',
    'fssai',
    'customer\\s*care',
    'lic\\.?\\s*no',
    'energy\\s*\\(?kcal',
  ].join('|'),
  'i'
);

const tidy = (s: string) =>
  s
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2') // join words split at line end: "veg-\netable"
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[|]/g, 'l')
    .replace(/\b[l1]od(i[sz]ed)\b/gi, 'Iod$1') // OCR reads capital I as l
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** Reads "2.5", "2,5", "O.5" (OCR O for 0), "l2" (l for 1). */
const num = (raw: string): number | null => {
  const s = raw.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// A number must start with a digit (or O/o directly before a decimal point), never inside a word.
const NUM = '(?<![A-Za-z])([0-9][0-9OolI]*(?:[.,][0-9Oo]+)?|[Oo][.,][0-9]+)(?![A-Za-z])';

/** Index (0-based) of the per-100 g column, from a header like "Per 100 g | Per serve (30 g)". */
function per100Column(lines: string[]): { index: number; columns: number; servingG: number | null } | null {
  for (const line of lines) {
    const l = line.toLowerCase();
    const p100 = l.search(/(per|\/)\s*1\s*[0o]\s*[0-9o]\s*(g|gm|ml|¢|9|q)?\b|(per|\/)\s*100/);
    if (p100 === -1) continue;
    const serve = l.search(/per\s*(serv|serving|serve|portion|pack)/);
    if (serve === -1) return { index: 0, columns: 1, servingG: null };
    const sm = /per\s*serv\w*\s*[([]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(g|gm|ml|9|¢)/i.exec(line);
    return { index: p100 < serve ? 0 : 1, columns: 2, servingG: sm ? num(sm[1]) : null };
  }
  return null;
}

function nutrientValue(lines: string[], label: RegExp, col: { index: number; columns: number; servingG: number | null }, unitDefault: 'g' | 'mg', skip?: RegExp): { value: number; unit: string; other?: number } | null {
  for (const line of lines) {
    if (!label.test(line) || (skip && skip.test(line))) continue;
    // Drop unit brackets such as "(g)", "(mg)" (OCR often reads "(g)" as "(9)").
    const after = line.slice(line.search(label)).replace(/[([{]\s*[^)\]}]{0,4}\s*[)\]}]/g, ' ');
    const matches = [...after.matchAll(new RegExp(`${NUM}\\s*(mg|g|gm)?\\b`, 'gi'))]
      .map((m) => ({ value: num(m[1]), unit: (m[2] || unitDefault).toLowerCase().replace('gm', 'g') }))
      .filter((m): m is { value: number; unit: string } => m.value != null);
    if (matches.length === 0) continue;
    // A number could not be read on this row: we can't tell which column is which, so don't guess.
    if (matches.length < col.columns) return null;
    const picked = matches[col.index];
    return col.columns === 2 ? { ...picked, other: matches[1 - col.index].value } : picked;
  }
  return null;
}


const LABEL_VOCAB = `ingredients ingredient contains contain may traces nutritional nutrition information energy kcal protein carbohydrate carbohydrates total sugars sugar added fat fats saturated trans sodium salt fibre fiber cholesterol per serve serving
refined wheat flour maida atta semolina suji rava rice corn maize oats barley rye malt starch gram besan chickpea lentil pulses potato tapioca
edible vegetable oil oils palm palmolein sunflower soybean groundnut peanut mustard sesame coconut olive rapeseed cottonseed rice bran hydrogenated vanaspati interesterified
milk solids skimmed powder whey casein lactose butter ghee cream cheese paneer curd yogurt khoa
egg eggs albumin soy soya lecithin emulsifier emulsifiers stabiliser stabilizer thickener thickeners raising agents agent leavening baking yeast
invert syrup glucose liquid dextrose fructose sucrose jaggery honey maltodextrin molasses cocoa chocolate vanilla
iodised iodized rock black spices spice condiments herbs pepper chilli chili turmeric cumin coriander ginger garlic onion tomato cardamom cinnamon clove
acidity regulator regulators citric acid ascorbic lactic acetic preservative preservatives antioxidant antioxidants colour colours color flavour flavours flavor flavouring natural identical artificial nature
almond cashew walnut pistachio hazelnut raisins nuts dates fruit fruits
water vinegar caffeine coffee tea sweetener sweeteners sucralose aspartame acesulfame saccharin monosodium glutamate
fish shrimp prawn crab shellfish gluten`.split(/\s+/).filter(Boolean);
const VOCAB_SET = new Set(LABEL_VOCAB);

/** Edit distance, or max + 1 as soon as it is certainly larger than max. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const keepCase = (orig: string, fixed: string) =>
  orig === orig.toUpperCase() ? fixed.toUpperCase() : orig[0] === orig[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;

/** Fixes near-miss label words from OCR ("Nilk" → "Milk", "Flaur" → "Flour"). Only words of 4+ letters, only to known label words. */
export function correctLabelWords(text: string): string {
  return text.replace(/[A-Za-z]{4,}/g, (w) => {
    const low = w.toLowerCase();
    if (VOCAB_SET.has(low)) return w;
    const max = low.length >= 8 ? 2 : 1;
    let best: string | null = null;
    let bestD = max + 1;
    let tie = false;
    for (const v of LABEL_VOCAB) {
      if (v.length < 4) continue;
      const d = distance(low, v, max);
      if (d < bestD) {
        best = v;
        bestD = d;
        tie = false;
      } else if (d === bestD && d <= max && v !== best) {
        // "emulsifier" vs "emulsifiers": prefer the one with the same length, else leave as read
        if (v.length === low.length && best!.length !== low.length) best = v;
        else if (!(best!.length === low.length && v.length !== low.length)) tie = true;
      }
    }
    if (tie || bestD > max) return w;
    return best ? keepCase(w, best) : w;
  });
}

/** How many known label words a text contains; used to pick the best OCR attempt. */
export const labelWordCount = (text: string) => (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => VOCAB_SET.has(w)).length;

export function extractLabel(raw: string): ExtractedLabel {
  const text = correctLabelWords(raw.replace(/\r/g, '').replace(/\b[l1]od(i[sz]ed)\b/gi, 'Iod$1'));
  const warnings: string[] = [];

  // ---- Ingredients ------------------------------------------------------
  let ingredientsText = '';
  const m = INGREDIENTS_RE.exec(text);
  if (m) {
    let rest = text.slice(m.index + m[0].length);
    const stop = STOP_RE.exec(rest);
    if (stop) rest = rest.slice(0, stop.index);
    ingredientsText = tidy(rest).replace(/^[:;.\-–\s]+/, '');
  } else {
    warnings.push('Could not find the word “Ingredients”. Please check the text below.');
    const stop = STOP_RE.exec(text);
    ingredientsText = tidy(stop ? text.slice(0, stop.index) : text);
  }
  if (ingredientsText.length > 1500) ingredientsText = ingredientsText.slice(0, 1500);

  // ---- Nutrition per 100 g ---------------------------------------------------
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const col = per100Column(lines);
  const hasTable = lines.some((l) => /sugar|sodium|salt|saturated/i.test(l) && /\d/.test(l));
  let sugars: number | null = null;
  let salt: number | null = null;
  let saturatedFat: number | null = null;

  if (hasTable && col == null) {
    warnings.push('The nutrition table does not show a “per 100 g” column, so its numbers were not used.');
  } else if (hasTable && col != null) {
    // Cross-check: per-serving ≈ per-100 g × serving size / 100. If the two columns disagree,
    // one digit was probably misread, so the patient is asked to check that number.
    const check = (name: string, v: { value: number; other?: number } | null) => {
      if (!v || v.other == null || !col.servingG) return;
      const expected = (v.value * col.servingG) / 100;
      const tol = Math.max(0.15 * expected, 0.15);
      if (Math.abs(v.other - expected) > tol) warnings.push(`Please check the ${name} number: the two columns on the label don't agree.`);
    };
    const s = nutrientValue(lines, /(total\s*)?sugars?\b/i, col, 'g', /added\s*sugar|sugar\s*free|no\s*added/i);
    if (s) {
      sugars = s.unit === 'mg' ? s.value / 1000 : s.value;
      check('sugar', s);
    }
    const sa = nutrientValue(lines, /\bsalt\b/i, col, 'g');
    if (sa) {
      salt = sa.unit === 'mg' ? sa.value / 1000 : sa.value;
      check('salt', sa);
    }
    if (salt == null) {
      const so = nutrientValue(lines, /\bsodium\b/i, col, 'mg');
      if (so) {
        salt = Math.round(((so.unit === 'g' ? so.value * 1000 : so.value) / 1000) * 2.5 * 100) / 100;
        check('sodium', so);
      }
    }
    const sf = nutrientValue(lines, /saturated\s*(fat|fatty)/i, col, 'g');
    if (sf) {
      saturatedFat = sf.unit === 'mg' ? sf.value / 1000 : sf.value;
      check('saturated fat', sf);
    }
  }

  return { ingredientsText, per100g: { sugars, salt, saturatedFat }, warnings, foundIngredientsHeading: !!m };
}
