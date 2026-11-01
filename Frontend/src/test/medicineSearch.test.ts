import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchMedicines } from '../api/medicineSearch';
import { demoSearchMedicines } from '../demo/demoMedicineSearch';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('searchMedicines', () => {
  it('uses the backend catalogue: details, total and paging', async () => {
    const fetchMock = vi.fn(async () =>
      json({
        success: true,
        data: {
          query: 'dolo', total: 347, offset: 0, source: 'india-medicine-db',
          items: [{ name: 'Dolo 650 Tablet', composition: 'Paracetamol(650mg)', pack: 'strip of 15 tablets', manufacturer: 'Micro Labs Ltd', discontinued: false, match: 'name' }],
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await searchMedicines('Dolo');
    expect(res.source).toBe('Indian medicine database');
    expect(res.total).toBe(347);
    expect(res.hasMore).toBe(true);
    expect(res.items[0]).toMatchObject({ name: 'Dolo 650 Tablet', composition: 'Paracetamol(650mg)', match: 'name' });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/prescriptions/medicine-suggestions?q=dolo&limit=30&offset=0');

    await searchMedicines('Dolo', { offset: 30 });
    expect(String((fetchMock.mock.calls[1] as unknown[])[0])).toContain('offset=30');
  });

  it('accepts a names-only answer (ML service)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, data: { suggestions: ['Paracetamol', 'Calpol'], total: 2, source: 'ml-service' } })));
    const res = await searchMedicines('calp');
    expect(res.items.map((i) => i.name)).toEqual(['Paracetamol', 'Calpol']);
    expect(res.source).toBe('ReportSetu ML service');
    expect(res.hasMore).toBe(false);
  });

  it('falls back to NLM RxTerms when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('clinicaltables')
        ? json([2, ['metFORMIN (Oral Pill)'], { STRENGTHS_AND_FORMS: [[' 500 mg Tab', '1000 mg Tab']] }, []])
        : json({ success: false, error: { message: 'unavailable' } }, 503)
    ));
    const res = await searchMedicines('metfo');
    expect(res.source).toBe('NLM RxTerms');
    expect(res.items.map((i) => i.name)).toEqual(['metFORMIN 500 mg Tab', 'metFORMIN 1000 mg Tab']);
  });

  it('returns an empty list when everything fails or the text is too short', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await searchMedicines('zzzq')).items).toEqual([]);
    expect((await searchMedicines('m')).items).toEqual([]);
  });
});

describe('demo catalogue search (same ranking as the backend)', () => {
  it('lists the Dolo range first for "dolo" and finds paracetamol products by ingredient', async () => {
    const dolo = await demoSearchMedicines('dolo', 30, 0);
    expect(dolo.items[0].name.startsWith('Dolo ')).toBe(true);
    expect(dolo.items.some((i) => i.name === 'Dolo 650 Tablet')).toBe(true);
    const para = await demoSearchMedicines('paracetamol', 30, 0);
    expect(para.total).toBeGreaterThan(30);
    expect(para.items.some((i) => i.match === 'composition')).toBe(true);
  });
});
