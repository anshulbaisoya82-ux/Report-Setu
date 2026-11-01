import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/prescriptionService', () => ({ createPrescription: vi.fn(), getPrescriptions: vi.fn() }));
vi.mock('../services/mlClient', () => ({ mlClient: { suggestMedicines: vi.fn() } }));
vi.mock('../services/medicineCatalog', () => ({ getMedicineCatalog: vi.fn() }));

import { handleSuggestMedicines } from './prescriptionController';
import { mlClient } from '../services/mlClient';
import { getMedicineCatalog } from '../services/medicineCatalog';

const run = async (query: Record<string, unknown>) => {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  const next = vi.fn();
  await handleSuggestMedicines({ query, user: { userId: 'u1', role: 'doctor' } } as any, res, next);
  return { res, next };
};

const dolo = { name: 'Dolo 650 Tablet', composition: 'Paracetamol(650mg)', pack: 'strip of 15 tablets', manufacturer: 'Micro Labs Ltd', discontinued: false, match: 'name' };

afterEach(() => {
  vi.mocked(mlClient.suggestMedicines).mockReset();
  vi.mocked(getMedicineCatalog).mockReset();
  delete process.env.MEDICINE_SEARCH_SOURCE;
});

describe('GET /prescriptions/medicine-suggestions controller', () => {
  it('answers from the Indian medicine catalogue with details, total and paging', async () => {
    const search = vi.fn(() => ({ total: 347, items: [dolo] }));
    vi.mocked(getMedicineCatalog).mockReturnValue({ search } as any);
    const { res, next } = await run({ q: ' dolo ', limit: '30', offset: '30' });
    expect(next).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith('dolo', { limit: 30, offset: 30 });
    expect(res.body.data).toEqual({ query: 'dolo', total: 347, offset: 30, suggestions: ['Dolo 650 Tablet'], items: [dolo], source: 'india-medicine-db' });
    expect(mlClient.suggestMedicines).not.toHaveBeenCalled();
  });

  it('caps limit at 100 and ignores 1-letter text', async () => {
    const search = vi.fn(() => ({ total: 0, items: [] }));
    vi.mocked(getMedicineCatalog).mockReturnValue({ search } as any);
    await run({ q: 'met', limit: '5000' });
    expect(search).toHaveBeenCalledWith('met', { limit: 100, offset: 0 });
    const { res } = await run({ q: 'p' });
    expect(res.body.data.items).toEqual([]);
  });

  it('uses the ML service when the catalogue file is missing', async () => {
    vi.mocked(getMedicineCatalog).mockReturnValue(null);
    vi.mocked(mlClient.suggestMedicines).mockResolvedValue(['Paracetamol', 'Dolo 650']);
    const { res } = await run({ q: 'para' });
    expect(mlClient.suggestMedicines).toHaveBeenCalledWith('para', 30);
    expect(res.body.data.source).toBe('ml-service');
    expect(res.body.data.suggestions).toEqual(['Paracetamol', 'Dolo 650']);
  });

  it('uses the ML service when MEDICINE_SEARCH_SOURCE=ml', async () => {
    process.env.MEDICINE_SEARCH_SOURCE = 'ml';
    vi.mocked(mlClient.suggestMedicines).mockResolvedValue(['Paracetamol']);
    const { res } = await run({ q: 'para' });
    expect(getMedicineCatalog).not.toHaveBeenCalled();
    expect(res.body.data.source).toBe('ml-service');
  });

  it('passes a 503 on when no source works (no made-up names)', async () => {
    vi.mocked(getMedicineCatalog).mockReturnValue(null);
    vi.mocked(mlClient.suggestMedicines).mockRejectedValue(new Error('ECONNREFUSED'));
    const { next } = await run({ q: 'para' });
    expect(next.mock.calls[0][0].statusCode).toBe(503);
  });
});
