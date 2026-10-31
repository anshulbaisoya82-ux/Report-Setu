import { describe, expect, it } from 'vitest';
import { BIOMARKER_CATALOG, extractBiomarkerTrend, findBiomarkerDefinition, matchesBiomarker } from '../components/charts/clinicalDataTransformer';
import { describeParameter, parseRange } from '../components/ui/status';
import { formatDate } from '../utils/format';

const def = (key: string) => BIOMARKER_CATALOG.find((b) => b.key === key)!;

describe('biomarker matching never mixes different tests', () => {
  it('keeps HbA1c and MCH out of Hemoglobin', () => {
    expect(matchesBiomarker('Hemoglobin (Hb)', def('hemoglobin'))).toBe(true);
    expect(matchesBiomarker('HbA1c', def('hemoglobin'))).toBe(false);
    expect(matchesBiomarker('Glycated Hemoglobin', def('hemoglobin'))).toBe(false);
    expect(matchesBiomarker('Mean Corpuscular Hemoglobin (MCH)', def('hemoglobin'))).toBe(false);
    expect(findBiomarkerDefinition('HbA1c').key).toBe('hba1c');
  });

  it('keeps LDL/HDL out of Total Cholesterol and eAG out of glucose', () => {
    expect(matchesBiomarker('Total Cholesterol', def('cholesterol'))).toBe(true);
    expect(matchesBiomarker('LDL Cholesterol', def('cholesterol'))).toBe(false);
    expect(matchesBiomarker('HDL Cholesterol', def('cholesterol'))).toBe(false);
    expect(matchesBiomarker('Estimated Average Glucose', def('glucose'))).toBe(false);
    expect(matchesBiomarker('Fasting Blood Sugar', def('glucose'))).toBe(true);
  });

  it('builds a hemoglobin trend only from hemoglobin values', () => {
    const r = (id: string, date: string, params: [string, number][]) => ({
      id, collectionDate: date, parameters: params.map(([name, value], i) => ({ id: `${id}${i}`, name, value, unit: '', referenceRange: '', status: 'Normal' })),
    }) as any;
    const { points } = extractBiomarkerTrend(
      [r('a', '2026-03-01', [['Hemoglobin (Hb)', 12.4]]), r('b', '2026-06-01', [['HbA1c', 7.1]]), r('c', '2026-10-01', [['Hemoglobin (Hb)', 13.2]])],
      'hemoglobin'
    );
    expect(points.map((p) => p.value)).toEqual([12.4, 13.2]);
  });
});

describe('patient-facing status wording', () => {
  it('distinguishes slightly low from low', () => {
    expect(describeParameter({ value: 4.2, referenceRange: '4.5 – 5.9', status: 'Low' }).label).toBe('Slightly low');
    expect(describeParameter({ value: 1.2, referenceRange: '1.5 – 4.5', status: 'Low' }).label).toBe('Low');
    expect(describeParameter({ value: 12.4, referenceRange: '< 5.7', status: 'Critical' }).label).toBe('Needs attention');
  });
  it('parses ranges', () => {
    expect(parseRange('< 5.7')).toEqual({ high: 5.7 });
    expect(parseRange('13.0 – 17.0')).toEqual({ low: 13, high: 17 });
  });
});

describe('formatDate', () => {
  it('formats ISO timestamps and leaves display strings alone', () => {
    expect(formatDate('2026-10-22T09:30:00.000Z')).toBe('22 Oct 2026');
    expect(formatDate('06 Nov 2026')).toBe('06 Nov 2026');
    expect(formatDate(undefined)).toBe('');
  });
});
