import { describe, it, expect } from 'vitest';
import { reportAnalyzer, formatFileSize, ReportAnalyzer } from './reportAnalyzer';

describe('Task 5.2: Text Extraction & Modular analyzeReport Pipeline', () => {
  it('instantiates ReportAnalyzer and exports formatFileSize helper', () => {
    expect(reportAnalyzer).toBeInstanceOf(ReportAnalyzer);
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('correctly analyzes and classifies a CBC report', async () => {
    const cbcText = `
      APOLLO DIAGNOSTICS
      Patient: Sneha Patel
      Complete Blood Count (CBC)
      Hemoglobin: 12.8 g/dL
      Total WBC Count: 6800 /µL
      Platelet Count: 2.4 lakh/µL
      Neutrophils: 62 %
    `;
    const buffer = Buffer.from(cbcText);

    const result = await reportAnalyzer.analyzeReport(buffer, 'apollo_cbc_report.pdf', 'application/pdf');

    expect(result.recognized).toBe(true);
    expect(result.category).toBe('CBC');
    expect(result.reportType).toContain('Complete Blood Count');
    expect(result.labName).toContain('Apollo Diagnostics');
    expect(result.specimen).toBe('EDTA Whole Blood');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.totalValuesCount).toBeGreaterThanOrEqual(3);
    expect(result.parameters.some((p) => p.name.includes('Hemoglobin'))).toBe(true);
  });

  it('correctly analyzes and classifies an HbA1c report with Indian lab detection', async () => {
    const hba1cText = `
      DR. LAL PATHLABS
      Patient: Rohan Sharma
      HbA1c Glycated Hemoglobin: 8.4 %
      Estimated Average Glucose: 194 mg/dL
    `;
    const buffer = Buffer.from(hba1cText);

    const result = await reportAnalyzer.analyzeReport(buffer, 'lal_path_hba1c.pdf', 'application/pdf');

    expect(result.recognized).toBe(true);
    expect(result.category).toBe('HbA1c');
    expect(result.labName).toContain('Dr. Lal PathLabs');
    expect(result.parameters.length).toBeGreaterThanOrEqual(2);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('correctly analyzes a Lipid Profile report', async () => {
    const lipidText = `
      METROPOLIS HEALTHCARE
      Lipid Profile
      Total Cholesterol: 215 mg/dL
      Triglycerides: 160 mg/dL
      HDL Cholesterol: 48 mg/dL
    `;
    const buffer = Buffer.from(lipidText);

    const result = await reportAnalyzer.analyzeReport(buffer, 'metropolis_lipid.png', 'image/png');

    expect(result.recognized).toBe(true);
    expect(result.category).toBe('Lipid');
    expect(result.labName).toContain('Metropolis');
    expect(result.specimen).toContain('Serum');
  });

  it('flags report with low confidence and recognized: false if filename contains "unknown"', async () => {
    const unknownText = 'Some ambiguous medical discharge notes without clear lab tests.';
    const buffer = Buffer.from(unknownText);

    const result = await reportAnalyzer.analyzeReport(buffer, 'unknown_document.pdf', 'application/pdf');

    expect(result.recognized).toBe(false);
    expect(result.confidence).toBeLessThan(0.60);
    expect(result.category).toBe('Other');
    expect(result.reportType).toBe('Unknown Report (Needs Classification)');
  });

  it('formats fileSizeFormatted and totalValuesCount correctly', async () => {
    const text = 'Hemoglobin: 14.2 g/dL\nPlatelets: 1.8 lakh/µL';
    const buffer = Buffer.from(text);

    const result = await reportAnalyzer.analyzeReport(buffer, 'quick_cbc.pdf', 'application/pdf');

    expect(result.fileSizeFormatted).toBeDefined();
    expect(result.totalValuesCount).toBe(result.parameters.length);
    expect(result.rawFileName).toBe('quick_cbc.pdf');
  });
});
