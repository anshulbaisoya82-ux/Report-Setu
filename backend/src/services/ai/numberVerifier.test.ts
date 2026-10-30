import { describe, it, expect } from 'vitest';
import { verifyGeneratedClinicalNumbers } from './numberVerifier';

describe('Task 10.3: Post-Generation Number Verification Engine', () => {
  const actualParameters = [
    { name: 'Haemoglobin', value: 13.2, unit: 'g/dL', trendDirection: 'down' },
    { name: 'Platelet Count', value: 120000, unit: '/µL', trendDirection: 'up' },
    { name: 'HbA1c', value: 6.8, unit: '%', trendDirection: 'neutral' },
    { name: 'Total Leukocyte Count (WBC)', value: 7500, unit: '/µL', trendDirection: 'neutral' },
  ];

  it('should accept valid AI texts where numbers match laboratory records exactly or with lakh conversion', () => {
    const validTexts = [
      'Your Haemoglobin is 13.2 g/dL and platelet count of 120000 shows recovery.',
      'Recent evaluation shows Hb: 13.2 with HbA1c at 6.8% and platelet count of 1.2 lakh.',
      'Haemoglobin of 13.2 and WBC count of 7.5k remain within acceptable clinical boundaries.',
    ];

    for (const text of validTexts) {
      const result = verifyGeneratedClinicalNumbers(text, actualParameters as any);
      expect(result.isValid).toBe(true);
      expect(result.mismatches.length).toBe(0);
    }
  });

  it('should reject texts containing hallucinated numerical readings', () => {
    // Hemoglobin hallucinated as 14.5 (DB is 13.2)
    const hallucinatedHbText =
      'Patient shows excellent progress with Haemoglobin of 14.5 g/dL and platelet count of 120000.';

    const result = verifyGeneratedClinicalNumbers(hallucinatedHbText, actualParameters as any);
    expect(result.isValid).toBe(false);
    expect(result.mismatches.length).toBe(1);
    expect(result.mismatches[0].parameter).toBe('haemoglobin');
    expect(result.mismatches[0].foundValue).toBe(14.5);
    expect(result.mismatches[0].expectedValue).toBe(13.2);
  });

  it('should reject texts stating incorrect trend direction contrary to clinical database', () => {
    // DB has Haemoglobin trendDirection: 'down', but text claims it is rising
    const contradictoryTrendText =
      'Haemoglobin is 13.2 and haemoglobin is rising steadily over the last three weeks.';

    const result = verifyGeneratedClinicalNumbers(contradictoryTrendText, actualParameters as any);
    expect(result.isValid).toBe(false);
    expect(result.mismatches.some((m) => m.reason.includes('contradicts') || m.reason.includes('rising'))).toBe(true);
  });

  it('should reject texts where multiple parameter readings are hallucinated', () => {
    const multiHallucinatedText =
      'Haemoglobin is 16.0 g/dL, HbA1c is 8.5%, and platelet count is 350000.';

    const result = verifyGeneratedClinicalNumbers(multiHallucinatedText, actualParameters as any);
    expect(result.isValid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThanOrEqual(2);
  });
});
