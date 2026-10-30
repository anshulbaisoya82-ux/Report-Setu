import { config } from '../config/env';
import { logger } from '../utils/logger';

export type FlagType = 'low' | 'normal' | 'high' | 'critical_low' | 'critical_high' | 'missing';
export type InsightType = 'out_of_range' | 'trend' | 'unusual_change';
export type InsightSeverity = 'critical' | 'review' | 'info';
export type InsightDirection = 'rising' | 'falling' | 'stable';
export type InsightStatus = 'pending' | 'accepted' | 'dismissed';
export type TriagePriority = 'critical' | 'review' | 'stable';

export interface MlMeasurement {
  report_id?: number;
  test_code: string;
  test_name: string;
  value: number;
  unit: string;
  ref_low?: number;
  ref_high?: number;
  date: string; // YYYY-MM-DD
  flag: FlagType;
  needs_check?: boolean;
}

export interface MlInsightEvidence {
  date: string;
  value: number;
}

export interface MlInsight {
  id?: number;
  patient_id: number;
  test_code: string;
  type: InsightType;
  direction?: InsightDirection;
  severity: InsightSeverity;
  explanation: string;
  evidence: MlInsightEvidence[];
  status?: InsightStatus;
}

export interface MlForecast {
  test_code: string;
  horizon_days: number;
  estimate?: number | null;
  low?: number | null;
  high?: number | null;
  n_points: number;
  baseline_estimate?: number | null;
  warning?: string | null;
}

export interface MlTriageResult {
  patient_id: number;
  priority: TriagePriority;
  reason: string;
}

export interface MlExtractedReport {
  report_date: string;
  lab_name: string;
  measurements: MlMeasurement[];
}

export interface MlChatResponse {
  answer: string;
  escalate: boolean;
}

export interface MlDraftSummary {
  summary: string;
  lang: string;
  word_count: number;
}

export interface MlPipelineResult {
  patient_id: number;
  insights: MlInsight[];
  forecast: MlForecast;
  triage: MlTriageResult;
  summary_en: string;
  summary_hi: string;
}

export interface MlHealthStatus {
  status: string;
  service: string;
  modules: Record<string, string>;
}

export class MlClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl = config.ML_SERVICE_URL, timeoutMs = 8000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Check if ML service is reachable
   */
  async healthCheck(): Promise<MlHealthStatus | null> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) return null;
      return (await res.json()) as MlHealthStatus;
    } catch {
      return null;
    }
  }

  /**
   * Quick boolean check of ML service availability
   */
  async isAvailable(): Promise<boolean> {
    const health = await this.healthCheck();
    return health !== null && health.status === 'ready';
  }

  /**
   * Extract measurements from raw report text
   */
  async extractFromText(rawText: string): Promise<MlExtractedReport> {
    try {
      const res = await this.postJson<MlExtractedReport>('/extract/text', {
        raw_text: rawText,
      });
      return res;
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML extractFromText falling back to local heuristic');
      return this.fallbackExtractText(rawText);
    }
  }

  /**
   * Extract measurements from file buffer (PDF, image, text)
   */
  async extractFromFile(fileBuffer: Buffer, filename: string): Promise<MlExtractedReport> {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, filename);

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}/extract/file`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`ML Service error: ${res.status} ${res.statusText}`);
      }

      return (await res.json()) as MlExtractedReport;
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML extractFromFile falling back to text heuristic');
      const text = fileBuffer.toString('utf-8');
      return this.fallbackExtractText(text);
    }
  }

  /**
   * Run clinical analysis (reference rules, trends, unusual changes)
   */
  async analyzePatient(measurements: MlMeasurement[]): Promise<MlInsight[]> {
    try {
      return await this.postJson<MlInsight[]>('/analysis/analyze', { measurements });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML analyzePatient falling back to local rules');
      return this.fallbackAnalyze(measurements);
    }
  }

  /**
   * Forecast HbA1c 90-day trajectory
   */
  async forecastHbA1c(measurements: MlMeasurement[]): Promise<MlForecast> {
    try {
      return await this.postJson<MlForecast>('/forecast/hba1c', { measurements });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML forecastHbA1c falling back to local linear estimate');
      return this.fallbackForecast(measurements);
    }
  }

  /**
   * Triage patient priority with LangGraph clinical agent
   */
  async triagePatient(patientId: number, insights: MlInsight[]): Promise<MlTriageResult> {
    try {
      return await this.postJson<MlTriageResult>('/triage', {
        patient_id: patientId,
        insights,
      });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML triagePatient falling back to local deterministic rule');
      return this.fallbackTriage(patientId, insights);
    }
  }

  /**
   * Generate plain-language non-alarmist summary in English or Hindi
   */
  async draftSummary(
    patientName: string,
    measurements: MlMeasurement[],
    insights: MlInsight[],
    lang: 'en' | 'hi' = 'en'
  ): Promise<MlDraftSummary> {
    try {
      return await this.postJson<MlDraftSummary>('/summary/draft', {
        measurements,
        insights,
        lang,
      });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML draftSummary falling back to template');
      return this.fallbackSummary(patientName, measurements, lang);
    }
  }

  /**
   * Guardrailed patient chat assistant
   */
  async patientChat(
    question: string,
    approvedSummary = '',
    history?: { role: string; content: string }[]
  ): Promise<MlChatResponse> {
    try {
      return await this.postJson<MlChatResponse>('/chat', {
        question,
        approved_summary: approvedSummary,
        history,
      });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML patientChat falling back to guardrail template');
      return this.fallbackChat(question, approvedSummary);
    }
  }

  /**
   * Run full orchestration pipeline
   */
  async processPipeline(
    patientId: number,
    allMeasurements: MlMeasurement[],
    latestMeasurements?: MlMeasurement[]
  ): Promise<MlPipelineResult> {
    try {
      return await this.postJson<MlPipelineResult>('/pipeline/process', {
        patient_id: patientId,
        all_measurements: allMeasurements,
        latest_measurements: latestMeasurements,
      });
    } catch (err) {
      logger.warn({ err, type: 'ml_client_fallback' }, 'ML processPipeline falling back to composite heuristics');
      const insights = this.fallbackAnalyze(allMeasurements);
      const forecast = this.fallbackForecast(allMeasurements);
      const triage = this.fallbackTriage(patientId, insights);
      const summaryEn = this.fallbackSummary('Patient', latestMeasurements || allMeasurements, 'en');
      const summaryHi = this.fallbackSummary('Patient', latestMeasurements || allMeasurements, 'hi');

      return {
        patient_id: patientId,
        insights,
        forecast,
        triage,
        summary_en: summaryEn.summary,
        summary_hi: summaryHi.summary,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Internal HTTP helper
  // --------------------------------------------------------------------------
  private async postJson<T>(path: string, payload: unknown): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ML Service [${path}] failed with ${res.status}: ${errText || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  // --------------------------------------------------------------------------
  // Safe Deterministic Fallbacks (Offline resilience)
  // --------------------------------------------------------------------------
  private fallbackExtractText(rawText: string): MlExtractedReport {
    const measurements: MlMeasurement[] = [];
    const today = new Date().toISOString().split('T')[0];

    const lines = rawText.split('\n');
    for (const line of lines) {
      // Regex match pattern: TestName [numeric value] [unit]
      const match = line.match(/([A-Za-z0-9\s-]+)[:\t\s]+([0-9.]+)\s*([a-zA-Z/%mgdL\^]+)?/);
      if (match) {
        const testName = match[1].trim();
        const value = parseFloat(match[2]);
        const unit = match[3] || '';
        if (!isNaN(value)) {
          measurements.push({
            test_code: testName.toUpperCase().replace(/\s+/g, '_').slice(0, 10),
            test_name: testName,
            value,
            unit,
            date: today,
            flag: 'normal',
            needs_check: false,
          });
        }
      }
    }

    return {
      report_date: today,
      lab_name: 'Diagnostic Laboratory',
      measurements,
    };
  }

  private fallbackAnalyze(measurements: MlMeasurement[]): MlInsight[] {
    const insights: MlInsight[] = [];
    measurements.forEach((m, idx) => {
      if (m.flag === 'critical_high' || m.flag === 'critical_low') {
        insights.push({
          id: idx + 1,
          patient_id: 1,
          test_code: m.test_code,
          type: 'out_of_range',
          severity: 'critical',
          explanation: `${m.test_name} is critically ${m.flag === 'critical_high' ? 'elevated' : 'low'} at ${m.value} ${m.unit}.`,
          evidence: [{ date: m.date, value: m.value }],
          status: 'pending',
        });
      } else if (m.flag === 'high' || m.flag === 'low') {
        insights.push({
          id: idx + 1,
          patient_id: 1,
          test_code: m.test_code,
          type: 'out_of_range',
          severity: 'review',
          explanation: `${m.test_name} is ${m.flag} at ${m.value} ${m.unit}.`,
          evidence: [{ date: m.date, value: m.value }],
          status: 'pending',
        });
      }
    });
    return insights;
  }

  private fallbackForecast(measurements: MlMeasurement[]): MlForecast {
    const hba1cReadings = measurements
      .filter((m) => m.test_code.toUpperCase().includes('HBA1C'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (hba1cReadings.length === 0) {
      return {
        test_code: 'HBA1C',
        horizon_days: 90,
        n_points: 0,
        estimate: null,
        warning: 'Insufficient readings to compute 90-day trajectory.',
      };
    }

    const lastVal = hba1cReadings[hba1cReadings.length - 1].value;
    return {
      test_code: 'HBA1C',
      horizon_days: 90,
      estimate: lastVal,
      low: Math.max(0, +(lastVal - 0.4).toFixed(1)),
      high: +(lastVal + 0.4).toFixed(1),
      n_points: hba1cReadings.length,
      baseline_estimate: lastVal,
    };
  }

  private fallbackTriage(patientId: number, insights: MlInsight[]): MlTriageResult {
    const hasCritical = insights.some((i) => i.severity === 'critical');
    const hasReview = insights.some((i) => i.severity === 'review');

    if (hasCritical) {
      return {
        patient_id: patientId,
        priority: 'critical',
        reason: 'One or more critical parameters require immediate clinical attention.',
      };
    }

    if (hasReview) {
      return {
        patient_id: patientId,
        priority: 'review',
        reason: 'Out of range parameters require physician review.',
      };
    }

    return {
      patient_id: patientId,
      priority: 'stable',
      reason: 'All lab parameters within expected limits.',
    };
  }

  private fallbackSummary(
    patientName: string,
    measurements: MlMeasurement[],
    lang: 'en' | 'hi'
  ): MlDraftSummary {
    if (lang === 'hi') {
      const summary = `नमस्ते ${patientName}, आपकी हालिया लैब रिपोर्ट तैयार है। कुल ${measurements.length} परीक्षणों का विश्लेषण किया गया है। कृपया अपने डॉक्टर से परामर्श लें।`;
      return {
        summary,
        lang: 'hi',
        word_count: summary.split(/\s+/).length,
      };
    }

    const summary = `Hello ${patientName}, your recent lab tests have been evaluated. A total of ${measurements.length} parameters were recorded. Please discuss these findings with your doctor at your next appointment.`;
    return {
      summary,
      lang: 'en',
      word_count: summary.split(/\s+/).length,
    };
  }

  private fallbackChat(question: string, approvedSummary = ''): MlChatResponse {
    const qLower = question.toLowerCase();
    const medicationKeywords = ['dose', 'dosage', 'medicine', 'tablet', 'pill', 'stop', 'increase', 'decrease'];
    const emergencyKeywords = ['chest pain', 'heart attack', 'unconscious', 'fainted', 'heavy bleeding', 'breathless'];

    if (emergencyKeywords.some((k) => qLower.includes(k))) {
      return {
        answer: 'EMERGENCY: These symptoms may require immediate medical care. Please call 108 or go to the nearest emergency department right away.',
        escalate: true,
      };
    }

    if (medicationKeywords.some((k) => qLower.includes(k))) {
      return {
        answer: 'Medication changes must only be advised by your prescribing physician. This question has been forwarded to your doctor for review.',
        escalate: true,
      };
    }

    return {
      answer: approvedSummary
        ? `Based on your approved report: ${approvedSummary}`
        : 'Your lab report values are available. Please consult your physician for personalized medical advice.',
      escalate: false,
    };
  }
}

export const mlClient = new MlClient();
