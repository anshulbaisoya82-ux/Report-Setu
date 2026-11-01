import { describe, expect, it } from 'vitest';
import { MedicineCatalog, getMedicineCatalog } from './medicineCatalog';

const small = new MedicineCatalog([
  ['Dolo 650 Tablet', 'Paracetamol(650mg)', 'strip of 15 tablets', 'Micro Labs Ltd', 0],
  ['Paracip 500 Tablet', 'Paracetamol(500mg)', 'strip of 10 tablets', 'Cipla Ltd', 0],
  ['Paracetamol 500mg Tablet', 'Paracetamol(500mg)', 'strip of 10 tablets', 'Generic Co', 0],
  ['Calpol 500mg Tablet', 'Paracetamol(500mg)', 'strip of 15 tablets', 'GSK', 1],
  ['Glycomet 500 Tablet', 'Metformin(500mg)', 'strip of 20 tablets', 'USV Ltd', 0],
  ['Dolo 650 Tablet', 'Paracetamol(650mg)', 'strip of 10 tablets', 'Micro Labs Ltd', 0],
]);

describe('MedicineCatalog.search', () => {
  it('puts names starting with the text first, then ingredient matches, discontinued last, one row per name', () => {
    const r = small.search('para');
    expect(r.items.map((i) => i.name)).toEqual(['Paracetamol 500mg Tablet', 'Paracip 500 Tablet', 'Dolo 650 Tablet', 'Calpol 500mg Tablet']);
    expect(r.items.map((i) => i.match)).toEqual(['name', 'name', 'composition', 'composition']);
    expect(r.items[3].discontinued).toBe(true);
    expect(r.total).toBe(4);
  });

  it('needs every typed word (name or ingredients), so "paracetamol 650" finds Dolo 650', () => {
    expect(small.search('paracetamol 650').items.map((i) => i.name)).toEqual(['Dolo 650 Tablet']);
  });

  it('pages with offset and limit, and ignores 1-letter queries', () => {
    expect(small.search('para', { limit: 2, offset: 2 }).items.map((i) => i.name)).toEqual(['Dolo 650 Tablet', 'Calpol 500mg Tablet']);
    expect(small.search('p')).toEqual({ total: 0, items: [] });
  });
});

describe('bundled Indian medicine catalogue', () => {
  const catalog = getMedicineCatalog();

  it('loads ~250k products', () => {
    expect(catalog).not.toBeNull();
    expect(catalog!.size).toBeGreaterThan(250000);
  });

  it('returns a long list for "para" with Dolo 650 among paracetamol products, fast', () => {
    const t = Date.now();
    const r = catalog!.search('para', { limit: 100 });
    const ms = Date.now() - t;
    expect(r.total).toBeGreaterThan(500);
    expect(r.items).toHaveLength(100);
    expect(r.items[0].name.toLowerCase().startsWith('para')).toBe(true);
    expect(catalog!.search('dolo 650').items.some((i) => /^Dolo 650/i.test(i.name))).toBe(true);
    expect(ms).toBeLessThan(1500);
  });
});
