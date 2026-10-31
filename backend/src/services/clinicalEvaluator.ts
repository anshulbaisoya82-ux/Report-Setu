import { ParameterStatus, ReportStatus } from '../domain/types';

export interface ParsedRange {
  low?: number;
  high?: number;
  raw: string;
}

export interface EvaluatedParameterResult {
  status: ParameterStatus;
  percentageDiff?: number;
  explanation: string;
  whatItMeans: string;
  pointsToConsider: string;
}

/**
 * Standard known medical explanations by parameter keyword
 */
const PARAMETER_KNOWLEDGE: Record<
  string,
  { whatItMeans: string; explanation: string; pointsToConsider: string }
> = {
  HEMOGLOBIN: {
    whatItMeans: 'Hemoglobin carries oxygen from your lungs to tissues throughout your body.',
    explanation: 'Normal levels ensure optimal energy and tissue oxygenation.',
    pointsToConsider: 'Discuss iron-rich nutrition, hydration, and fatigue levels with your doctor.',
  },
  WBC: {
    whatItMeans: 'White blood cells are your immune defense system fighting infection and inflammation.',
    explanation: 'Elevations can reflect infection or inflammation; low levels indicate weakened immunity.',
    pointsToConsider: 'Report any fever, infection, or persistent weakness to your physician.',
  },
  PLATELET: {
    whatItMeans: 'Platelets are vital blood cells responsible for clotting and wound healing.',
    explanation: 'Low counts increase bruising and bleeding risks; very high counts may increase clotting.',
    pointsToConsider: 'Report unusual bruising, nosebleeds, or prolonged bleeding from minor cuts.',
  },
  HBA1C: {
    whatItMeans: 'HbA1c measures the percentage of glycated hemoglobin, reflecting 2-3 month average blood sugar.',
    explanation: 'Target for non-diabetic adults is below 5.7%. Higher levels indicate prediabetes or diabetes.',
    pointsToConsider: 'Discuss glycemic monitoring, dietary carbohydrate moderation, and medication review.',
  },
  CHOLESTEROL: {
    whatItMeans: 'Total cholesterol measures the complete amount of lipids circulating in your bloodstream.',
    explanation: 'Elevated cholesterol can contribute to arterial plaque buildup over time.',
    pointsToConsider: 'Discuss heart-healthy dietary changes, aerobic activity, and cardiovascular risk profile.',
  },
  TRIGLYCERIDES: {
    whatItMeans: 'Triglycerides are the main form of stored dietary fat in your bloodstream.',
    explanation: 'High levels are often linked to insulin resistance, metabolic syndrome, or excess sugars.',
    pointsToConsider: 'Review sugar and refined carbohydrate intake and regular exercise with your physician.',
  },
  HDL: {
    whatItMeans: 'HDL is protective "good" cholesterol that carries excess lipids back to the liver.',
    explanation: 'Higher levels (>40-50 mg/dL) are associated with reduced cardiovascular risk.',
    pointsToConsider: 'Regular aerobic activity and healthy fats (nuts, seeds, olive oil) help raise HDL.',
  },
  LDL: {
    whatItMeans: 'LDL is "bad" cholesterol that deposits inside artery walls when elevated.',
    explanation: 'Lower levels are desirable to reduce long-term cardiovascular events.',
    pointsToConsider: 'Consult your doctor on lipid-lowering lifestyle choices and follow-up testing.',
  },
  CREATININE: {
    whatItMeans: 'Creatinine is a metabolic waste product filtered out by healthy kidneys.',
    explanation: 'Higher values may reflect reduced glomerular filtration rate (kidney function).',
    pointsToConsider: 'Ensure adequate daily water intake and discuss kidney health with your doctor.',
  },
  BILIRUBIN: {
    whatItMeans: 'Bilirubin is a yellow breakdown product of normal hemoglobin degradation processed by the liver.',
    explanation: 'Elevations can indicate liver processing delays, bile duct issues, or hemolysis.',
    pointsToConsider: 'Report any jaundice (yellowing of eyes/skin), dark urine, or abdominal discomfort.',
  },
};

/**
 * Deterministic Clinical Range Engine
 */
export class ClinicalEvaluator {
  /**
   * Parse reference range string into numerical bounds
   * Examples supported:
   * - "13.0 – 17.0", "13.0 - 17.0", "4000 to 11000", "0.7 — 1.3"
   * - "< 5.7", "<= 100", "UP TO 200"
   * - "> 40", ">= 60"
   */
  parseReferenceRange(rawRange: string): ParsedRange {
    if (!rawRange || typeof rawRange !== 'string') {
      return { raw: rawRange || '' };
    }

    const clean = rawRange.trim().replace(/,/g, '');

    // 1. Less than format: "< 5.7", "<= 100", "up to 200"
    const lessThanMatch = clean.match(/(?:<|<=|up\s*to)\s*([0-9.]+)/i);
    if (lessThanMatch) {
      return {
        high: parseFloat(lessThanMatch[1]),
        raw: rawRange,
      };
    }

    // 2. Greater than format: "> 40", ">= 60"
    const greaterThanMatch = clean.match(/(?:>|>=)\s*([0-9.]+)/i);
    if (greaterThanMatch) {
      return {
        low: parseFloat(greaterThanMatch[1]),
        raw: rawRange,
      };
    }

    // 3. Range format: "13.0 - 17.0", "13.0 – 17.0", "13.0 to 17.0", "13.0 — 17.0"
    const rangeMatch = clean.match(/([0-9.]+)\s*(?:-|–|—|to)\s*([0-9.]+)/i);
    if (rangeMatch) {
      return {
        low: parseFloat(rangeMatch[1]),
        high: parseFloat(rangeMatch[2]),
        raw: rawRange,
      };
    }

    return { raw: rawRange };
  }

  /**
   * Evaluates parameter status purely via code
   * Values > 50% above upper limit or < 30% below lower limit flagged as Critical
   */
  evaluateParameter(
    parameterName: string,
    value: number,
    rawRange?: string,
    unit = ''
  ): EvaluatedParameterResult {
    let rawRangeStr = rawRange || '';
    let unitStr = unit || '';

    // Detect if range and unit were swapped in call arguments
    const rangeChars = /[-–—<>]|\bto\b/i;
    if (rangeChars.test(unitStr) && !rangeChars.test(rawRangeStr)) {
      const temp = rawRangeStr;
      rawRangeStr = unitStr;
      unitStr = temp;
    } else if (!/\d/.test(rawRangeStr) && /\d/.test(unitStr)) {
      const temp = rawRangeStr;
      rawRangeStr = unitStr;
      unitStr = temp;
    }

    const range = this.parseReferenceRange(rawRangeStr);
    const knowledge = this.getKnowledge(parameterName);

    let status: ParameterStatus = 'Normal';
    let percentageDiff: number | undefined;

    // Both Low and High bounds exist
    if (range.low !== undefined && range.high !== undefined) {
      if (value < range.low) {
        percentageDiff = ((range.low - value) / range.low) * 100;
        // < 30% below lower limit or specific medical critical rules
        status = percentageDiff >= 30.0 || this.isKnownCriticalLow(parameterName, value) ? 'Critical' : 'Low';
      } else if (value > range.high) {
        percentageDiff = ((value - range.high) / range.high) * 100;
        // > 50% above upper limit or specific medical critical rules
        status = percentageDiff >= 50.0 || this.isKnownCriticalHigh(parameterName, value) ? 'Critical' : 'High';
      }
    }
    // Only High bound exists (< X)
    else if (range.high !== undefined) {
      if (value > range.high) {
        percentageDiff = ((value - range.high) / range.high) * 100;
        status = percentageDiff >= 50.0 || this.isKnownCriticalHigh(parameterName, value) ? 'Critical' : 'High';
      }
    }
    // Only Low bound exists (> Y)
    else if (range.low !== undefined) {
      if (value < range.low) {
        percentageDiff = ((range.low - value) / range.low) * 100;
        status = percentageDiff >= 30.0 || this.isKnownCriticalLow(parameterName, value) ? 'Critical' : 'Low';
      }
    }

    const explanation = this.buildExplanation(parameterName, value, unit, status, range, percentageDiff);

    return {
      status,
      percentageDiff: percentageDiff ? parseFloat(percentageDiff.toFixed(1)) : undefined,
      explanation,
      whatItMeans: knowledge.whatItMeans,
      pointsToConsider: knowledge.pointsToConsider,
    };
  }

  /**
   * Computes overall report status based on the worst parameter status.
   * Supports array of status strings or array of objects with status property.
   */
  computeOverallReportStatus(
    items: (ParameterStatus | { status: ParameterStatus })[]
  ): ReportStatus {
    const list = items.map((item) =>
      typeof item === 'string' ? item : item?.status
    );
    if (list.includes('Critical')) {
      return 'Critical';
    }
    if (list.includes('High') || list.includes('Low')) {
      return 'Unbalanced';
    }
    return 'Normal';
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  private isKnownCriticalLow(paramName: string, val: number): boolean {
    const p = paramName.toUpperCase();
    if (p.includes('HEMOGLOBIN') || p === 'HB') return val < 7.0;
    if (p.includes('PLATELET') || p === 'PLT') {
      if (val < 10) return val < 0.5; // in lakh/uL (e.g. 1.5 - 4.5)
      if (val < 1000) return val < 50.0; // in 10^3/uL (e.g. 150 - 450)
      return val < 50000; // in absolute count (e.g. 150,000 - 450,000)
    }
    if (p.includes('WBC') || p.includes('LEUKOCYTE')) {
      if (val < 100) return val < 2.0; // in 10^3/uL (e.g. 4.0 - 11.0)
      return val < 2000; // in absolute count (e.g. 4000 - 11000)
    }
    return false;
  }

  private isKnownCriticalHigh(paramName: string, val: number): boolean {
    const p = paramName.toUpperCase();
    if (p.includes('HBA1C')) return val >= 10.0;
    if (p.includes('HEMOGLOBIN') || p === 'HB') return val > 20.0;
    if (p.includes('GLUCOSE') || p.includes('SUGAR')) return val >= 300;
    if (p.includes('CREATININE')) return val >= 4.0;
    if (p.includes('PLATELET') || p === 'PLT') {
      if (val < 20) return val > 10.0; // in lakh/uL
      if (val < 2000) return val > 1000; // in 10^3/uL
      return val > 1000000; // in absolute count
    }
    return false;
  }

  private getKnowledge(name: string) {
    const upper = name.toUpperCase();
    for (const [key, val] of Object.entries(PARAMETER_KNOWLEDGE)) {
      if (upper.includes(key)) {
        return val;
      }
    }
    return {
      whatItMeans: `${name} is an important biological indicator measured in this laboratory test.`,
      explanation: 'Values outside normal reference intervals warrant discussion with your treating doctor.',
      pointsToConsider: 'Consult your doctor to evaluate this result in the context of your overall clinical history.',
    };
  }

  private buildExplanation(
    name: string,
    value: number,
    unit: string,
    status: ParameterStatus,
    range: ParsedRange,
    percentageDiff?: number
  ): string {
    const unitStr = unit ? ` ${unit}` : '';
    const diffStr = percentageDiff ? ` (${percentageDiff.toFixed(1)}% variance)` : '';

    if (status === 'Critical') {
      return `CRITICAL ALERT: ${name} reading of ${value}${unitStr} is significantly outside safe reference boundaries${diffStr}. Prompt medical attention is advised.`;
    }
    if (status === 'High') {
      return `${name} reading of ${value}${unitStr} is elevated above standard reference limits${diffStr}.`;
    }
    if (status === 'Low') {
      return `${name} reading of ${value}${unitStr} is below the expected reference threshold${diffStr}.`;
    }
    return `${name} reading of ${value}${unitStr} is within healthy reference limits.`;
  }
}

export const clinicalEvaluator = new ClinicalEvaluator();
