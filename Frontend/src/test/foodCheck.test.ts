import { describe, expect, it } from 'vitest';
import { checkLabel, splitIngredients, type FoodRules } from '../features/foodCheck/checkLabel';

const rules = (over: Partial<FoodRules> = {}): FoodRules => ({
  limits: { sugar: null, salt: null, saturatedFat: null }, allergies: [], avoid: [], ...over,
});
const none = { sugars: null, salt: null, saturatedFat: null };

const BISCUIT = 'Refined wheat flour (maida), sugar, edible vegetable oil (palm), invert syrup, milk solids, leavening agents [503(ii), 500(ii)], iodised salt, emulsifier (soy lecithin). Contains wheat, milk and soy. May contain peanut and tree nuts.';

describe('splitIngredients', () => {
  it('keeps brackets together, numbers ingredients, and marks the "may contain" part', () => {
    const segs = splitIngredients(BISCUIT);
    expect(segs[0]).toMatchObject({ text: 'Refined wheat flour (maida)', index: 1, trace: false });
    expect(segs.find((s) => s.text.startsWith('leavening'))!.text).toBe('leavening agents [503(ii), 500(ii)]');
    expect(segs.filter((s) => s.trace).map((s) => s.text)).toEqual(['May contain peanut and tree nuts']);
  });
});

describe('checkLabel', () => {
  it('gives no verdict without doctor rules', () => {
    expect(checkLabel(BISCUIT, none, null).verdict).toBe('no_rules');
    expect(checkLabel(BISCUIT, none, rules()).verdict).toBe('no_rules');
  });

  it('flags a peanut allergy from a "may contain" line, with the exact words', () => {
    const r = checkLabel(BISCUIT, none, rules({ allergies: ['Peanut'] }));
    expect(r.verdict).toBe('avoid');
    expect(r.findings[0]).toMatchObject({ kind: 'allergy', rule: 'Allergy: Peanut', trace: true });
    expect(r.findings[0].evidence).toContain('May contain peanut');
  });

  it('knows Indian names: groundnut = peanut, maida/suji = gluten, ghee = milk', () => {
    expect(checkLabel('Roasted groundnut, salt', none, rules({ allergies: ['peanuts'] })).findings[0].evidence).toBe('Roasted groundnut (1st ingredient)');
    expect(checkLabel('Suji, water', none, rules({ allergies: ['Gluten'] })).verdict).toBe('avoid');
    expect(checkLabel('Rice, ghee', none, rules({ allergies: ['milk'] })).findings[0].evidence).toBe('ghee (2nd ingredient)');
  });

  it('does not confuse coconut milk with milk, or "no added sugar" with sugar', () => {
    const r = checkLabel('Coconut milk, water. No added sugar.', none, rules({ allergies: ['Milk'], avoid: ['Added sugar'] }));
    expect(r.verdict).toBe('ok');
    expect(r.cleared).toEqual(['No milk found', 'No added sugar found']);
  });

  it('finds added sugar as the 2nd ingredient and palm oil inside brackets', () => {
    const r = checkLabel(BISCUIT, none, rules({ avoid: ['Added sugar', 'palm oil'] }));
    expect(r.findings.map((f) => f.evidence)).toEqual(['sugar (2nd ingredient)', 'edible vegetable oil (palm) (3rd ingredient)']);
  });

  it('compares nutrition with the doctor’s limit; equal is fine, above is not, missing asks to check', () => {
    expect(checkLabel('Oats', { sugars: 22, salt: null, saturatedFat: null }, rules({ limits: { sugar: 5, salt: null, saturatedFat: null } })).findings[0])
      .toMatchObject({ kind: 'limit', severity: 'avoid', evidence: 'Sugar: 22 g per 100 g on the label', rule: 'Sugar up to 5 g per 100 g' });
    expect(checkLabel('Oats', { sugars: 5, salt: null, saturatedFat: null }, rules({ limits: { sugar: 5, salt: null, saturatedFat: null } })).verdict).toBe('ok');
    const missing = checkLabel('Oats', none, rules({ limits: { sugar: 5, salt: 1.5, saturatedFat: null } }));
    expect(missing.verdict).toBe('check');
    expect(missing.findings).toHaveLength(2);
  });

  it('asks to check when the ingredient list is empty but ingredient rules exist', () => {
    expect(checkLabel('', none, rules({ allergies: ['Egg'] })).verdict).toBe('check');
  });

  it('uses a plain word for items that are not in a built-in group', () => {
    expect(checkLabel('Potato, karela extract', none, rules({ avoid: ['Karela'] })).findings[0].evidence).toBe('karela extract (2nd ingredient)');
    expect(checkLabel('Potato, salt', none, rules({ avoid: ['Karela'] })).verdict).toBe('ok');
  });
});

import { conditionFacts } from '../features/foodCheck/checkLabel';
import { extractLabel } from '../features/foodCheck/labelText';

describe('conditionFacts (from the patient record, facts only)', () => {
  it('lists sugar amount and every added sugar for diabetes, salt for hypertension, nothing for unknown conditions', () => {
    const r = conditionFacts(BISCUIT, { sugars: 24.5, salt: 0.95, saturatedFat: 9.8 }, ['Type 2 Diabetes', 'Hypertension', 'Migraine']);
    expect(r.map((x) => x.condition)).toEqual(['Type 2 Diabetes', 'Hypertension']);
    expect(r[0].facts).toEqual(['Sugar: 24.5 g per 100 g', 'Added sugar: sugar (2nd), invert syrup (4th)']);
    expect(r[1].facts).toEqual(['Salt: 0.95 g per 100 g', 'Added salt: iodised salt (7th)']);
  });
  it('says when a value is missing instead of guessing', () => {
    expect(conditionFacts('Oats', { sugars: null, salt: null, saturatedFat: null }, ['Prediabetes'])[0].facts).toEqual(['Sugar per 100 g: not found on the label', 'No added sugar in the ingredient list']);
  });
});

describe('extractLabel (OCR text → ingredients and per-100 g numbers)', () => {
  const OCR = `Brand Biscuits
lNGREDlENTS: Refined Wheat Flour (Maida), Sugar, Edible Veg-
etable Oil (Palm), Nilk Solids, lodised Salt.
MAY CONTAIN PEANUT.
NUTRITIONAL INFORMATION Per 100 g Per serve (25 g)
Energy (kcal) 480 120
Total Sugars (9) 24.5 6.1
Added Sugars (g) 20.1 5.0
Saturated Fat (g) 9.8 2.5
Sodium (mg) 380 95
FSSAI Lic. No. 10012345678901`;
  it('finds the list despite OCR slips, joins broken lines and fixes near-miss words', () => {
    const r = extractLabel(OCR);
    expect(r.foundIngredientsHeading).toBe(true);
    expect(r.ingredientsText).toBe('Refined Wheat Flour (Maida), Sugar, Edible Vegetable Oil (Palm), Milk Solids, Iodised Salt. MAY CONTAIN PEANUT.');
  });
  it('reads the per-100 g column, ignores "(9)" unit misreads and "Added sugars", converts sodium to salt', () => {
    expect(extractLabel(OCR).per100g).toEqual({ sugars: 24.5, salt: 0.95, saturatedFat: 9.8 });
    expect(extractLabel(OCR).warnings).toEqual([]);
  });
  it('flags a number when the two columns disagree, and refuses to guess when a number is missing', () => {
    const bad = OCR.replace('Saturated Fat (g) 9.8 2.5', 'Saturated Fat (g) 2.3 2.4').replace('Sodium (mg) 380 95', 'Sodium (mg) 380 PS');
    const r = extractLabel(bad);
    expect(r.per100g.saturatedFat).toBe(2.3);
    expect(r.warnings).toContain('Please check the saturated fat number: the two columns on the label don’t agree.'.replace('’', "'"));
    expect(r.per100g.salt).toBeNull();
  });
  it('uses the per-100 g column even when it comes second', () => {
    const r = extractLabel('Ingredients: Oats.\nNutrition per serve (40 g) per 100 g\nTotal Sugars 2.0 5.0');
    expect(r.per100g.sugars).toBe(5);
  });
});

describe('splitIngredients with OCR-broken brackets', () => {
  it('does not let an unclosed bracket swallow the rest of the list', () => {
    const t = "Refined wheat Flour ([Maida), Sugar, Invert Syrup, Raising Agents [S5@3{i-' S068(ii})]. Emulsifier (Soy Leczdhiin]. CONTAINS WHEAT, MILK AMD S0Y. MAY CONTAIN PEANUT.";
    const r = checkLabel(t, { sugars: null, salt: null, saturatedFat: null }, { limits: { sugar: null, salt: null, saturatedFat: null }, allergies: ['Peanut'], avoid: ['Added sugar'] });
    expect(r.findings.map((f) => f.evidence)).toEqual(['“MAY CONTAIN PEANUT”', 'Sugar (2nd ingredient)']);
  });
});
