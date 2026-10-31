import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchMedicines } from '../api/medicineSearch';

afterEach(() => vi.unstubAllGlobals());

describe('searchMedicines (NLM RxTerms)', () => {
  it('turns the RxTerms response into "name strength form" suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      2, ['metFORMIN (Oral Pill)', 'metFORMIN ER (Oral Pill)'],
      { STRENGTHS_AND_FORMS: [[' 500 mg Tab', '1000 mg Tab'], ['500 mg Tab']] }, [],
    ]))));
    expect(await searchMedicines('metf')).toEqual(['metFORMIN 500 mg Tab', 'metFORMIN 1000 mg Tab', 'metFORMIN ER 500 mg Tab']);
  });

  it('returns nothing (so typing continues) when the service fails or the text is too short', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await searchMedicines('zzzq')).toEqual([]);
    expect(await searchMedicines('m')).toEqual([]);
  });
});
