/**
 * Food-label check: compares what is printed on a packet with the food rules the
 * patient's DOCTOR set. Plain rules, no AI judgement, no diagnosis:
 *  - every finding points to the exact words or numbers on the label;
 *  - nothing here decides from a disease; without doctor rules there is no verdict.
 */

export interface FoodLimits {
  /** grams per 100 g */
  sugar: number | null;
  salt: number | null;
  saturatedFat: number | null;
}

export interface FoodRules {
  limits: FoodLimits;
  allergies: string[];
  avoid: string[];
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Per100g {
  sugars: number | null;
  salt: number | null;
  saturatedFat: number | null;
}

export type Verdict = 'avoid' | 'check' | 'ok' | 'no_rules';

export interface Finding {
  kind: 'allergy' | 'avoid' | 'limit' | 'missing';
  severity: 'avoid' | 'check';
  /** The doctor's rule, e.g. "Peanut" or "Sugar under 5 g per 100 g". */
  rule: string;
  /** What on the label matched, e.g. "Groundnut (3rd ingredient)" or "22 g per 100 g". */
  evidence: string;
  /** "may contain" line rather than an ingredient. */
  trace?: boolean;
}

export interface CheckResult {
  verdict: Verdict;
  findings: Finding[];
  /** Rules that were checked and not found on the label, for transparency. */
  cleared: string[];
}

interface Group {
  label: string;
  terms: string[];
  /** Phrases that contain a term but are something else (e.g. "coconut milk"). */
  not?: string[];
}

/** Common allergen groups, with Indian names. Keys are matched against the doctor's items. */
export const ALLERGEN_GROUPS: Record<string, Group> = {
  peanut: { label: 'Peanut', terms: ['peanut', 'groundnut', 'arachis', 'moongphali', 'mungfali'], not: [] },
  milk: {
    label: 'Milk',
    terms: ['milk', 'milk solids', 'milk powder', 'whey', 'casein', 'caseinate', 'lactose', 'butter', 'ghee', 'cream', 'cheese', 'paneer', 'curd', 'yogurt', 'yoghurt', 'khoa', 'khoya', 'dahi', 'malai'],
    not: ['coconut milk', 'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk', 'cocoa butter', 'peanut butter', 'shea butter', 'coconut cream', 'cream of tartar'],
  },
  egg: { label: 'Egg', terms: ['egg', 'albumin', 'albumen', 'mayonnaise'], not: ['eggplant', 'eggless'] },
  gluten: { label: 'Gluten (wheat)', terms: ['wheat', 'gluten', 'maida', 'atta', 'semolina', 'suji', 'sooji', 'rava', 'barley', 'rye', 'malt', 'seitan', 'spelt'], not: ['buckwheat', 'gluten free', 'gluten-free'] },
  soy: { label: 'Soy', terms: ['soy', 'soya', 'soybean', 'soyabean', 'edamame', 'tofu'] },
  treenuts: { label: 'Tree nuts', terms: ['almond', 'cashew', 'walnut', 'pistachio', 'hazelnut', 'pecan', 'macadamia', 'badam', 'kaju', 'akhrot', 'pista'], not: ['almond milk'] },
  sesame: { label: 'Sesame', terms: ['sesame', 'til', 'gingelly'] },
  fish: { label: 'Fish', terms: ['fish', 'anchovy', 'tuna', 'salmon', 'sardine'] },
  shellfish: { label: 'Shellfish', terms: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster'] },
  mustard: { label: 'Mustard', terms: ['mustard', 'sarson'] },
};

/** Ingredients a doctor may ask a patient to avoid. */
export const AVOID_GROUPS: Record<string, Group> = {
  'added-sugar': {
    label: 'Added sugar',
    terms: ['sugar', 'sucrose', 'glucose', 'dextrose', 'fructose', 'corn syrup', 'glucose syrup', 'invert sugar', 'invert syrup', 'jaggery', 'gur', 'honey', 'maltodextrin', 'liquid glucose', 'cane sugar', 'brown sugar', 'molasses'],
    not: ['sugar free', 'sugar-free', 'no added sugar', 'no sugar'],
  },
  salt: { label: 'Added salt', terms: ['salt', 'sodium chloride', 'iodised salt', 'iodized salt', 'rock salt', 'sendha namak', 'black salt', 'kala namak'], not: ['salt free', 'no added salt'] },
  'palm-oil': { label: 'Palm oil', terms: ['palm', 'palmolein', 'palm kernel'] },
  hydrogenated: { label: 'Hydrogenated fat', terms: ['hydrogenated', 'vanaspati', 'interesterified'] },
  caffeine: { label: 'Caffeine', terms: ['caffeine', 'coffee', 'guarana'], not: ['decaffeinated'] },
  msg: { label: 'MSG (621)', terms: ['monosodium glutamate', 'msg', 'e621', '621'] },
  sweeteners: { label: 'Artificial sweeteners', terms: ['aspartame', 'sucralose', 'acesulfame', 'saccharin', 'neotame', '950', '951', '954', '955'] },
  alcohol: { label: 'Alcohol', terms: ['alcohol', 'ethanol', 'wine', 'rum', 'brandy', 'beer'] },
};

const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Finds the built-in group for a doctor's item ("Peanut", "peanuts", "Added sugar") or treats it as a plain word. */
export function groupFor(item: string, groups: Record<string, Group>): Group {
  const k = key(item);
  for (const [id, g] of Object.entries(groups)) {
    if (key(id) === k || key(g.label) === k || key(g.label) === k.replace(/s$/, '') || g.terms.some((t) => key(t) === k || `${key(t)}s` === k)) return g;
  }
  return { label: item.trim(), terms: [item.trim().toLowerCase()] };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

interface Segment {
  text: string;
  index: number; // 1-based ingredient number
  trace: boolean;
}

/** Splits an ingredient list on commas/semicolons outside brackets; marks "may contain" parts. */
export function splitIngredients(text: string): Segment[] {
  const out: Segment[] = [];
  const lower = text.toLowerCase();
  const traceRe = /(may contain|may also contain|contains traces|traces of|processed in a facility|manufactured in a facility|made on equipment)/g;
  const traceRanges: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = traceRe.exec(lower))) {
    const end = lower.indexOf('.', m.index);
    traceRanges.push([m.index, end === -1 ? lower.length : end]);
  }
  const stack: { ch: string; at: number }[] = [];
  const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let start = 0;
  let n = 0;
  const push = (from: number, to: number) => {
    const raw = text.slice(from, to).trim().replace(/^[.:\s]+|[.\s]+$/g, '');
    if (!raw) return;
    const trace = traceRanges.some(([a, b]) => from >= a - 1 && from <= b);
    if (!trace) n += 1;
    out.push({ text: raw, index: trace ? 0 : n, trace });
  };
  const traceStarts = new Set(traceRanges.map(([a]) => a));
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // OCR often breaks brackets ("([Maida)", "[503(ii)}"). A closer closes back to its matching
    // opener (or the latest one), and a bracket open for 80+ characters is treated as closed.
    while (stack.length && i - stack[0].at > 80) stack.shift();
    if (traceStarts.has(i) && i > start) {
      push(start, i);
      start = i;
      stack.length = 0;
    }
    if (c === '(' || c === '[' || c === '{') stack.push({ ch: c, at: i });
    else if (PAIR[c] && stack.length) {
      const k = stack.map((x) => x.ch).lastIndexOf(PAIR[c]);
      stack.length = k === -1 ? stack.length - 1 : k;
    } else if (c === ',' || c === ';' || (c === '.' && /\s/.test(text[i + 1] || ' '))) {
      const sentenceEnd = c === '.' && /^\s+[A-Z]{3,}/.test(text.slice(i + 1, i + 8));
      if (stack.length === 0 || sentenceEnd) {
        stack.length = 0;
        push(start, i);
        start = i + 1;
      }
    }
  }
  push(start, text.length);
  return out;
}

/** First segment that contains one of the group's words (as a whole word, plural allowed), skipping exclusions. */
export function findInIngredients(segments: Segment[], group: Group): Segment | null {
  for (const seg of segments) {
    let s = ` ${seg.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
    for (const ex of group.not || []) s = s.split(` ${ex.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `).join(' ~ ');
    for (const term of group.terms) {
      const t = term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (new RegExp(`\\s${escape(t)}(s|es)?\\s`).test(s)) return seg;
    }
  }
  return null;
}

const LIMIT_LABEL: Record<keyof FoodLimits, string> = { sugar: 'Sugar', salt: 'Salt', saturatedFat: 'Saturated fat' };
const VALUE_OF: Record<keyof FoodLimits, keyof Per100g> = { sugar: 'sugars', salt: 'salt', saturatedFat: 'saturatedFat' };
const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function checkLabel(ingredientsText: string, per100g: Per100g, rules: FoodRules | null): CheckResult {
  if (!rules || !hasAnyRule(rules)) return { verdict: 'no_rules', findings: [], cleared: [] };
  const findings: Finding[] = [];
  const cleared: string[] = [];
  const segments = splitIngredients(ingredientsText || '');
  const hasText = (ingredientsText || '').trim().length >= 3;

  const where = (seg: Segment) => (seg.trace ? `“${seg.text}”` : `${seg.text} (${ORDINAL(seg.index)} ingredient)`);

  for (const item of rules.allergies) {
    const g = groupFor(item, ALLERGEN_GROUPS);
    const seg = findInIngredients(segments, g);
    if (seg) findings.push({ kind: 'allergy', severity: 'avoid', rule: `Allergy: ${g.label}`, evidence: where(seg), trace: seg.trace });
    else if (hasText) cleared.push(`No ${g.label.toLowerCase()} found`);
  }
  for (const item of rules.avoid) {
    const g = groupFor(item, AVOID_GROUPS);
    const seg = findInIngredients(segments, g);
    if (seg) findings.push({ kind: 'avoid', severity: 'avoid', rule: `Avoid: ${g.label}`, evidence: where(seg), trace: seg.trace });
    else if (hasText) cleared.push(`No ${g.label.toLowerCase()} found`);
  }
  if (!hasText && (rules.allergies.length || rules.avoid.length)) {
    findings.push({ kind: 'missing', severity: 'check', rule: 'Ingredients', evidence: 'The ingredient list could not be read' });
  }

  (Object.keys(LIMIT_LABEL) as (keyof FoodLimits)[]).forEach((k) => {
    const max = rules.limits?.[k];
    if (max == null) return;
    const value = per100g[VALUE_OF[k]];
    const rule = `${LIMIT_LABEL[k]} up to ${fmt(max)} g per 100 g`;
    if (value == null) findings.push({ kind: 'missing', severity: 'check', rule, evidence: `${LIMIT_LABEL[k]} not found in the nutrition table` });
    else if (value > max) findings.push({ kind: 'limit', severity: 'avoid', rule, evidence: `${LIMIT_LABEL[k]}: ${fmt(value)} g per 100 g on the label` });
    else cleared.push(`${LIMIT_LABEL[k]} ${fmt(value)} g per 100 g (limit ${fmt(max)} g)`);
  });

  const verdict: Verdict = findings.some((f) => f.severity === 'avoid') ? 'avoid' : findings.length ? 'check' : 'ok';
  return { verdict, findings, cleared };
}

export const hasAnyRule = (r: FoodRules | null) =>
  !!r && (r.allergies.length > 0 || r.avoid.length > 0 || Object.values(r.limits || {}).some((v) => v != null));

// ---------------------------------------------------------------------------
// Conditions from the patient's record → label FACTS worth discussing with the doctor.
// These are facts read from the label (amounts, where an ingredient appears), never a verdict.

interface ConditionFocus {
  match: RegExp;
  topic: string;
  nutrients: (keyof Per100g)[];
  groups: Group[];
}

const CONDITION_FOCUS: ConditionFocus[] = [
  { match: /diabet|pre-?diabet|hba1c|blood\s*sugar|glucose|insulin\s*resist/i, topic: 'sugar', nutrients: ['sugars'], groups: [AVOID_GROUPS['added-sugar']] },
  { match: /hypertens|blood\s*pressure|\bbp\b|kidney|renal|ckd|heart\s*failure/i, topic: 'salt', nutrients: ['salt'], groups: [AVOID_GROUPS.salt] },
  { match: /cholesterol|lipid|dyslipid|triglycerid|heart|cardiac|coronary|fatty\s*liver/i, topic: 'fat', nutrients: ['saturatedFat'], groups: [AVOID_GROUPS.hydrogenated, AVOID_GROUPS['palm-oil']] },
  { match: /c[o]?eliac|gluten/i, topic: 'gluten', nutrients: [], groups: [ALLERGEN_GROUPS.gluten] },
  { match: /lactose/i, topic: 'milk', nutrients: [], groups: [ALLERGEN_GROUPS.milk] },
];

const NUTRIENT_NAME: Record<keyof Per100g, string> = { sugars: 'Sugar', salt: 'Salt', saturatedFat: 'Saturated fat' };

export interface ConditionFacts {
  condition: string;
  facts: string[];
}

/** Every segment matching a group (not just the first), for listing. */
function findAll(segments: Segment[], group: Group): Segment[] {
  return segments.filter((seg) => findInIngredients([seg], group));
}

export function conditionFacts(ingredientsText: string, per100g: Per100g, conditions: string[]): ConditionFacts[] {
  const segments = splitIngredients(ingredientsText || '');
  const hasText = (ingredientsText || '').trim().length >= 3;
  const out: ConditionFacts[] = [];
  for (const condition of conditions) {
    const focus = CONDITION_FOCUS.filter((f) => f.match.test(condition));
    if (focus.length === 0) continue;
    const facts: string[] = [];
    for (const f of focus) {
      for (const n of f.nutrients) {
        const v = per100g[n];
        facts.push(v == null ? `${NUTRIENT_NAME[n]} per 100 g: not found on the label` : `${NUTRIENT_NAME[n]}: ${fmt(v)} g per 100 g`);
      }
      for (const g of f.groups) {
        if (!hasText) continue;
        const hits = findAll(segments, g);
        facts.push(
          hits.length
            ? `${g.label}: ${hits.map((h) => (h.trace ? `“${h.text}”` : `${h.text} (${ORDINAL(h.index)})`)).join(', ')}`
            : `No ${g.label.toLowerCase()} in the ingredient list`
        );
      }
    }
    out.push({ condition, facts: [...new Set(facts)] });
  }
  return out;
}
