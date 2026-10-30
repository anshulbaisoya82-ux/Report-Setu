import { describe, it, expect } from 'vitest';
import { clinicalEvaluator, ClinicalEvaluator } from './clinicalEvaluator';

describe('Task 5.3: Deterministic Clinical Range Evaluator', () => {
  it('instantiates ClinicalEvaluator singleton', () => {
    expect(clinicalEvaluator).toBeInstanceOf(ClinicalEvaluator);
  });

  describe('Range Parser (Diverse Formats)', () => {
    it('parses hyphen range "13.0 - 17.0"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('13.0 - 17.0');
      expect(parsed.low).toBe(13.0);
      expect(parsed.high).toBe(17.0);
    });

    it('parses en-dash range "13.0 – 17.0"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('13.0 – 17.0');
      expect(parsed.low).toBe(13.0);
      expect(parsed.high).toBe(17.0);
    });

    it('parses em-dash range "0.7 — 1.3"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('0.7 — 1.3');
      expect(parsed.low).toBe(0.7);
      expect(parsed.high).toBe(1.3);
    });

    it('parses "to" separator "4000 to 11000"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('4000 to 11000');
      expect(parsed.low).toBe(4000);
      expect(parsed.high).toBe(11000);
    });

    it('parses comma-separated values "150,000 - 450,000"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('150,000 - 450,000');
      expect(parsed.low).toBe(150000);
      expect(parsed.high).toBe(450000);
    });

    it('parses less-than format "< 5.7"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('< 5.7');
      expect(parsed.low).toBeUndefined();
      expect(parsed.high).toBe(5.7);
    });

    it('parses less-than-equal format "<= 100"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('<= 100');
      expect(parsed.high).toBe(100);
    });

    it('parses "up to" format "Up to 200"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('Up to 200');
      expect(parsed.high).toBe(200);
    });

    it('parses greater-than format "> 40"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('> 40');
      expect(parsed.low).toBe(40);
      expect(parsed.high).toBeUndefined();
    });

    it('parses greater-than-equal format ">= 60"', () => {
      const parsed = clinicalEvaluator.parseReferenceRange('>= 60');
      expect(parsed.low).toBe(60);
    });
  });

  describe('Deterministic Status Calculation', () => {
    it('evaluates normal parameter within range', () => {
      const result = clinicalEvaluator.evaluateParameter('Hemoglobin', 14.5, '13.0 – 17.0', 'g/dL');
      expect(result.status).toBe('Normal');
      expect(result.percentageDiff).toBeUndefined();
    });

    it('evaluates moderately low parameter as Low (< 30% below lower limit)', () => {
      // 11.5 is ~11.5% below 13.0
      const result = clinicalEvaluator.evaluateParameter('Hemoglobin', 11.5, '13.0 – 17.0', 'g/dL');
      expect(result.status).toBe('Low');
      expect(result.percentageDiff).toBeDefined();
    });

    it('evaluates severely low parameter as Critical (>= 30% below lower limit)', () => {
      // 8.0 is 38.5% below 13.0
      const result = clinicalEvaluator.evaluateParameter('Hemoglobin', 8.0, '13.0 – 17.0', 'g/dL');
      expect(result.status).toBe('Critical');
      expect(result.explanation).toContain('CRITICAL ALERT');
    });

    it('evaluates moderately elevated parameter as High (< 50% above upper limit)', () => {
      // 18.0 is ~5.9% above 17.0
      const result = clinicalEvaluator.evaluateParameter('Hemoglobin', 18.0, '13.0 – 17.0', 'g/dL');
      expect(result.status).toBe('High');
    });

    it('evaluates severely elevated parameter as Critical (>= 50% above upper limit)', () => {
      // Total Cholesterol 320 with upper limit 200 is 60% above limit
      const result = clinicalEvaluator.evaluateParameter('Total Cholesterol', 320, '< 200', 'mg/dL');
      expect(result.status).toBe('Critical');
      expect(result.explanation).toContain('CRITICAL ALERT');
    });

    it('enforces medical critical rules for HbA1c >= 10.0', () => {
      const result = clinicalEvaluator.evaluateParameter('HbA1c', 10.5, '< 5.7', '%');
      expect(result.status).toBe('Critical');
    });

    it('enforces medical critical rules for Hemoglobin < 7.0', () => {
      const result = clinicalEvaluator.evaluateParameter('Hemoglobin', 6.8, '12.0 - 16.0', 'g/dL');
      expect(result.status).toBe('Critical');
    });

    it('enforces medical critical rules for Platelets < 50,000', () => {
      const result = clinicalEvaluator.evaluateParameter('Platelet Count', 35, '150 - 450', 'lakh/µL');
      expect(result.status).toBe('Critical');
    });
  });

  describe('Comprehensive 50+ Medical Parameter Battery', () => {
    const testCases: { name: string; val: number; range: string; expected: string }[] = [
      // CBC (10 tests)
      { name: 'Hemoglobin', val: 14.0, range: '13.0 - 17.0', expected: 'Normal' },
      { name: 'Hemoglobin', val: 12.0, range: '13.0 - 17.0', expected: 'Low' },
      { name: 'Hemoglobin', val: 6.5, range: '13.0 - 17.0', expected: 'Critical' },
      { name: 'Hemoglobin', val: 21.0, range: '13.0 - 17.0', expected: 'Critical' },
      { name: 'Total WBC Count', val: 7500, range: '4000 - 11000', expected: 'Normal' },
      { name: 'Total WBC Count', val: 12500, range: '4000 - 11000', expected: 'High' },
      { name: 'Total WBC Count', val: 18000, range: '4000 - 11000', expected: 'Critical' }, // > 50%
      { name: 'Platelets', val: 250, range: '150 - 450', expected: 'Normal' },
      { name: 'Platelets', val: 120, range: '150 - 450', expected: 'Low' },
      { name: 'Platelets', val: 40, range: '150 - 450', expected: 'Critical' },

      // Diabetes / HbA1c (10 tests)
      { name: 'HbA1c', val: 5.4, range: '< 5.7', expected: 'Normal' },
      { name: 'HbA1c', val: 6.2, range: '< 5.7', expected: 'High' },
      { name: 'HbA1c', val: 7.8, range: '< 5.7', expected: 'High' },
      { name: 'HbA1c', val: 11.2, range: '< 5.7', expected: 'Critical' },
      { name: 'Fasting Blood Sugar', val: 90, range: '70 - 100', expected: 'Normal' },
      { name: 'Fasting Blood Sugar', val: 125, range: '70 - 100', expected: 'High' },
      { name: 'Fasting Blood Sugar', val: 320, range: '70 - 100', expected: 'Critical' },
      { name: 'Post Prandial Blood Sugar', val: 130, range: '< 140', expected: 'Normal' },
      { name: 'Post Prandial Blood Sugar', val: 180, range: '< 140', expected: 'High' },
      { name: 'Post Prandial Blood Sugar', val: 350, range: '< 140', expected: 'Critical' },

      // Lipid Profile (10 tests)
      { name: 'Total Cholesterol', val: 180, range: '< 200', expected: 'Normal' },
      { name: 'Total Cholesterol', val: 230, range: '< 200', expected: 'High' },
      { name: 'Total Cholesterol', val: 340, range: '< 200', expected: 'Critical' }, // > 50%
      { name: 'Triglycerides', val: 130, range: '< 150', expected: 'Normal' },
      { name: 'Triglycerides', val: 180, range: '< 150', expected: 'High' },
      { name: 'Triglycerides', val: 280, range: '< 150', expected: 'Critical' }, // > 50%
      { name: 'HDL Cholesterol', val: 52, range: '> 40', expected: 'Normal' },
      { name: 'HDL Cholesterol', val: 35, range: '> 40', expected: 'Low' },
      { name: 'HDL Cholesterol', val: 22, range: '> 40', expected: 'Critical' }, // < 30% below 40
      { name: 'LDL Cholesterol', val: 95, range: '< 100', expected: 'Normal' },

      // Kidney Function Test - KFT (10 tests)
      { name: 'Serum Creatinine', val: 1.0, range: '0.7 – 1.3', expected: 'Normal' },
      { name: 'Serum Creatinine', val: 1.6, range: '0.7 – 1.3', expected: 'High' },
      { name: 'Serum Creatinine', val: 4.5, range: '0.7 – 1.3', expected: 'Critical' },
      { name: 'Blood Urea Nitrogen', val: 15, range: '7 – 20', expected: 'Normal' },
      { name: 'Blood Urea Nitrogen', val: 26, range: '7 – 20', expected: 'High' },
      { name: 'Blood Urea Nitrogen', val: 45, range: '7 – 20', expected: 'Critical' }, // > 50%
      { name: 'Uric Acid', val: 5.5, range: '3.5 – 7.2', expected: 'Normal' },
      { name: 'Uric Acid', val: 8.5, range: '3.5 – 7.2', expected: 'High' },
      { name: 'Serum Calcium', val: 9.5, range: '8.5 – 10.5', expected: 'Normal' },
      { name: 'Serum Calcium', val: 13.0, range: '8.5 – 10.5', expected: 'High' },

      // Liver Function Test - LFT (10 tests)
      { name: 'Bilirubin Total', val: 0.8, range: '0.2 – 1.2', expected: 'Normal' },
      { name: 'Bilirubin Total', val: 1.6, range: '0.2 – 1.2', expected: 'High' },
      { name: 'Bilirubin Total', val: 3.2, range: '0.2 – 1.2', expected: 'Critical' }, // > 50%
      { name: 'SGOT / AST', val: 25, range: '10 – 40', expected: 'Normal' },
      { name: 'SGOT / AST', val: 55, range: '10 – 40', expected: 'High' },
      { name: 'SGOT / AST', val: 120, range: '10 – 40', expected: 'Critical' }, // > 50%
      { name: 'SGPT / ALT', val: 30, range: '10 – 45', expected: 'Normal' },
      { name: 'SGPT / ALT', val: 60, range: '10 – 45', expected: 'High' },
      { name: 'SGPT / ALT', val: 140, range: '10 – 45', expected: 'Critical' }, // > 50%
      { name: 'Alkaline Phosphatase', val: 95, range: '40 – 130', expected: 'Normal' },
    ];

    it(`executes all ${testCases.length} test cases with 100% deterministic accuracy`, () => {
      for (const tc of testCases) {
        const res = clinicalEvaluator.evaluateParameter(tc.name, tc.val, tc.range);
        expect(res.status).toBe(tc.expected);
      }
    });
  });

  describe('Overall Report Status Computation', () => {
    it('returns "Normal" when all parameters are Normal', () => {
      const status = clinicalEvaluator.computeOverallReportStatus(['Normal', 'Normal', 'Normal']);
      expect(status).toBe('Normal');
    });

    it('returns "Unbalanced" when parameters contain High or Low without Critical', () => {
      const status = clinicalEvaluator.computeOverallReportStatus(['Normal', 'High', 'Normal', 'Low']);
      expect(status).toBe('Unbalanced');
    });

    it('returns "Critical" when any parameter is Critical', () => {
      const status = clinicalEvaluator.computeOverallReportStatus(['Normal', 'High', 'Critical']);
      expect(status).toBe('Critical');
    });
  });
});
