import { describe, it, expect, vi } from 'vitest';
import { MlClient, mlClient, MlMeasurement, MlInsight } from './mlClient';

describe('Task 5.0: Machine Learning Service Adapter & Resilient Client', () => {
  it('instantiates MlClient singleton with configured defaults', () => {
    expect(mlClient).toBeInstanceOf(MlClient);
  });

  it('safely handles offline healthCheck without throwing an unhandled error', async () => {
    const offlineClient = new MlClient('http://127.0.0.1:9999'); // Non-existent port
    const health = await offlineClient.healthCheck();
    expect(health).toBeNull();

    const isAvailable = await offlineClient.isAvailable();
    expect(isAvailable).toBe(false);
  });

  describe('Fallback Heuristics & Resilience', () => {
    const client = new MlClient('http://127.0.0.1:9999'); // Forces fallback mode

    it('extracts measurements from raw report text via fallback heuristic', async () => {
      const sampleText = `
        PATIENT REPORT
        Hemoglobin: 13.5 g/dL
        Fast Blood Sugar: 110 mg/dL
        Serum Creatinine: 1.1 mg/dL
      `;

      const result = await client.extractFromText(sampleText);
      expect(result.lab_name).toBeDefined();
      expect(result.measurements.length).toBeGreaterThanOrEqual(3);

      const hb = result.measurements.find((m) => m.test_name.includes('Hemoglobin'));
      expect(hb).toBeDefined();
      expect(hb?.value).toBe(13.5);
    });

    it('analyzes measurements and produces insights for critical and review flags', async () => {
      const measurements: MlMeasurement[] = [
        {
          test_code: 'HB',
          test_name: 'Hemoglobin',
          value: 6.5,
          unit: 'g/dL',
          date: '2026-10-25',
          flag: 'critical_low',
        },
        {
          test_code: 'FBS',
          test_name: 'Fasting Blood Sugar',
          value: 145,
          unit: 'mg/dL',
          date: '2026-10-25',
          flag: 'high',
        },
        {
          test_code: 'CREAT',
          test_name: 'Creatinine',
          value: 1.0,
          unit: 'mg/dL',
          date: '2026-10-25',
          flag: 'normal',
        },
      ];

      const insights = await client.analyzePatient(measurements);
      expect(insights.length).toBe(2);

      const criticalInsight = insights.find((i) => i.severity === 'critical');
      expect(criticalInsight).toBeDefined();
      expect(criticalInsight?.test_code).toBe('HB');

      const reviewInsight = insights.find((i) => i.severity === 'review');
      expect(reviewInsight).toBeDefined();
      expect(reviewInsight?.test_code).toBe('FBS');
    });

    it('forecasts 90-day trajectory for HbA1c with confidence estimates', async () => {
      const measurements: MlMeasurement[] = [
        {
          test_code: 'HBA1C',
          test_name: 'HbA1c',
          value: 7.2,
          unit: '%',
          date: '2026-07-01',
          flag: 'high',
        },
        {
          test_code: 'HBA1C',
          test_name: 'HbA1c',
          value: 6.9,
          unit: '%',
          date: '2026-10-01',
          flag: 'high',
        },
      ];

      const forecast = await client.forecastHbA1c(measurements);
      expect(forecast.test_code).toBe('HBA1C');
      expect(forecast.horizon_days).toBe(90);
      expect(forecast.n_points).toBe(2);
      expect(forecast.estimate).toBe(6.9);
      expect(forecast.low).toBeDefined();
      expect(forecast.high).toBeDefined();
    });

    it('classifies triage priority as critical when critical insights exist', async () => {
      const insights: MlInsight[] = [
        {
          patient_id: 101,
          test_code: 'PLT',
          type: 'out_of_range',
          severity: 'critical',
          explanation: 'Platelets critically low',
          evidence: [{ date: '2026-10-28', value: 25000 }],
        },
      ];

      const triage = await client.triagePatient(101, insights);
      expect(triage.patient_id).toBe(101);
      expect(triage.priority).toBe('critical');
    });

    it('generates bilingual plain-language summaries (English and Hindi)', async () => {
      const measurements: MlMeasurement[] = [
        {
          test_code: 'HB',
          test_name: 'Hemoglobin',
          value: 14.0,
          unit: 'g/dL',
          date: '2026-10-28',
          flag: 'normal',
        },
      ];

      const enSummary = await client.draftSummary('Rohan Sharma', measurements, [], 'en');
      expect(enSummary.lang).toBe('en');
      expect(enSummary.summary).toContain('Rohan Sharma');
      expect(enSummary.word_count).toBeGreaterThan(5);

      const hiSummary = await client.draftSummary('रोहन शर्मा', measurements, [], 'hi');
      expect(hiSummary.lang).toBe('hi');
      expect(hiSummary.summary).toContain('रोहन शर्मा');
    });

    it('intercepts emergency symptoms and triggers emergency response with escalation', async () => {
      const res = await client.patientChat('I am having severe chest pain and heavy bleeding');
      expect(res.escalate).toBe(true);
      expect(res.answer).toContain('EMERGENCY');
    });

    it('intercepts medication questions and refers to physician with escalation', async () => {
      const res = await client.patientChat('Can I double my medicine tablet dose?');
      expect(res.escalate).toBe(true);
      expect(res.answer).toContain('Medication changes must only be advised by your prescribing physician');
    });

    it('answers normal informational questions citing approved report', async () => {
      const res = await client.patientChat(
        'What was my hemoglobin level?',
        'Your Hemoglobin level is 14.0 g/dL which is in the healthy normal range.'
      );
      expect(res.escalate).toBe(false);
      expect(res.answer).toContain('14.0 g/dL');
    });

    it('runs processPipeline orchestrating insights, forecast, triage, and summaries', async () => {
      const measurements: MlMeasurement[] = [
        {
          test_code: 'HBA1C',
          test_name: 'HbA1c',
          value: 6.8,
          unit: '%',
          date: '2026-10-28',
          flag: 'high',
        },
      ];

      const pipeline = await client.processPipeline(1, measurements);
      expect(pipeline.patient_id).toBe(1);
      expect(pipeline.forecast.test_code).toBe('HBA1C');
      expect(pipeline.triage.priority).toBe('review');
      expect(pipeline.summary_en).toBeDefined();
      expect(pipeline.summary_hi).toBeDefined();
    });
  });
});
