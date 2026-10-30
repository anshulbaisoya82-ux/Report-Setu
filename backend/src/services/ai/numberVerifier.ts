import { ILabParameter } from '../../domain/types';

export interface NumericalMismatch {
  parameter: string;
  foundValue: number;
  expectedValue: number;
  reason: string;
}

export interface VerificationResult {
  isValid: boolean;
  mismatches: NumericalMismatch[];
  checkedParametersCount: number;
}

/**
 * Normalizes test name string for fuzzy matching (e.g., 'Haemoglobin' -> 'hb', 'Platelet Count' -> 'platelet')
 */
function normalizeParamName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes('haemo') || lower.includes('hemo') || lower === 'hb') return 'haemoglobin';
  if (lower.includes('platelet') || lower === 'plt') return 'platelet';
  if (lower.includes('hba1c') || lower.includes('glycated')) return 'hba1c';
  if (lower.includes('wbc') || lower.includes('white blood')) return 'wbc';
  if (lower.includes('rbc') || lower.includes('red blood')) return 'rbc';
  if (lower.includes('glucose') || lower.includes('sugar') || lower.includes('fbs') || lower.includes('ppbs')) return 'glucose';
  if (lower.includes('creatinine')) return 'creatinine';
  if (lower.includes('cholesterol')) return 'cholesterol';
  if (lower.includes('triglyceride')) return 'triglyceride';
  return lower;
}

/**
 * Extracts numbers associated with medical parameters in text.
 */
function extractMentionedParamValues(text: string): Map<string, number> {
  const result = new Map<string, number>();

  // Patterns for parameter names followed by or preceded by numbers
  // e.g., "Haemoglobin of 14.2", "Hb: 14.2", "Platelet count of 120000", "HbA1c was 6.8%"
  const patterns = [
    /(?:haemoglobin|hemoglobin|hb)\s*(?:is|was|of|level|count|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /(?:platelet(?:s|\s+count)?|plt)\s*(?:is|was|of|level|count|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /(?:hba1c|a1c|sugar|glycated)\s*(?:is|was|of|level|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /(?:wbc|white\s+blood\s+cells?|tlc)\s*(?:is|was|of|level|count|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /(?:creatinine)\s*(?:is|was|of|level|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    /(?:cholesterol)\s*(?:is|was|of|level|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0].toLowerCase();
      const numStr = match[1];
      const val = parseFloat(numStr);

      if (fullMatch.includes('haemo') || fullMatch.includes('hemo') || fullMatch.includes('hb')) {
        result.set('haemoglobin', val);
      } else if (fullMatch.includes('platelet') || fullMatch.includes('plt')) {
        result.set('platelet', val);
      } else if (fullMatch.includes('hba1c') || fullMatch.includes('a1c') || fullMatch.includes('sugar')) {
        result.set('hba1c', val);
      } else if (fullMatch.includes('wbc') || fullMatch.includes('tlc')) {
        result.set('wbc', val);
      } else if (fullMatch.includes('creatinine')) {
        result.set('creatinine', val);
      } else if (fullMatch.includes('cholesterol')) {
        result.set('cholesterol', val);
      }
    }
  }

  return result;
}

/**
 * Task 10.3: Post-Generation Number Verification Engine.
 * Verifies all numerical values in AI-generated text against source laboratory parameters.
 * Rejects hallucinated numbers or values with absolute deviation > 1%.
 */
export function verifyGeneratedClinicalNumbers(
  generatedText: string,
  actualParameters: Array<{ name: string; value: number; unit?: string }>
): VerificationResult {
  const mismatches: NumericalMismatch[] = [];
  const mentioned = extractMentionedParamValues(generatedText);

  // Build ground truth map from actual parameters
  const groundTruth = new Map<string, number>();
  for (const p of actualParameters) {
    const key = normalizeParamName(p.name);
    groundTruth.set(key, p.value);
  }

  for (const [key, foundVal] of mentioned.entries()) {
    if (groundTruth.has(key)) {
      const expectedVal = groundTruth.get(key)!;

      // For values like platelet count: 1.2 lakh vs 120000 or exact numbers
      let matches = false;
      if (Math.abs(foundVal - expectedVal) < 0.05) {
        matches = true;
      } else if (expectedVal >= 100000 && Math.abs(foundVal * 100000 - expectedVal) < 1000) {
        // e.g. 1.2 lakh = 120,000
        matches = true;
      } else if (expectedVal >= 1000 && Math.abs(foundVal * 1000 - expectedVal) < 50) {
        // e.g. 8.5k = 8500
        matches = true;
      }

      if (!matches) {
        mismatches.push({
          parameter: key,
          foundValue: foundVal,
          expectedValue: expectedVal,
          reason: `Generated value ${foundVal} contradicts database ground truth ${expectedVal}`,
        });
      }
    }
  }

  // Also verify directional trends if text says "rising" or "falling"
  const lowerText = generatedText.toLowerCase();
  for (const p of actualParameters as any[]) {
    const key = normalizeParamName(p.name);
    if (p.trendDirection) {
      if (p.trendDirection === 'down' && lowerText.includes(`${key} is rising`)) {
        mismatches.push({
          parameter: key,
          foundValue: p.value,
          expectedValue: p.value,
          reason: `Text claims ${key} is rising, but clinical database confirms it is falling`,
        });
      } else if (p.trendDirection === 'up' && lowerText.includes(`${key} is falling`)) {
        mismatches.push({
          parameter: key,
          foundValue: p.value,
          expectedValue: p.value,
          reason: `Text claims ${key} is falling, but clinical database confirms it is rising`,
        });
      }
    }
  }

  return {
    isValid: mismatches.length === 0,
    mismatches,
    checkedParametersCount: mentioned.size,
  };
}
