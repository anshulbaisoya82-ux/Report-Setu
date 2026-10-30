import { BiomarkerDefinition, ClinicalDataPoint, ClinicalStatus } from './chartTypes';
import { LabReport, LabParameter } from '../../types';

export const BIOMARKER_CATALOG: BiomarkerDefinition[] = [
  {
    key: 'platelets',
    name: 'Platelet Count',
    aliases: ['platelet', 'platelets', 'plt', 'total platelet count', 'platelet count (cbc)'],
    category: 'CBC',
    defaultUnit: '/µL',
    defaultRefLow: 150000,
    defaultRefHigh: 450000,
    precision: 0,
    description: 'Thrombocytes essential for blood clotting and hemostasis.',
    clinicalMeaning: 'Low levels increase risk of bleeding; very high levels indicate reactive inflammation or thrombocytosis.',
  },
  {
    key: 'hemoglobin',
    name: 'Hemoglobin',
    aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'],
    category: 'CBC',
    defaultUnit: 'g/dL',
    defaultRefLow: 13.0,
    defaultRefHigh: 17.0,
    precision: 1,
    description: 'Oxygen-carrying protein in red blood cells.',
    clinicalMeaning: 'Low values denote anemia; high values can signify polycythemia, dehydration, or hypoxemia.',
  },
  {
    key: 'wbc',
    name: 'Total Leukocyte Count (WBC)',
    aliases: ['wbc', 'leukocyte', 'white blood cell', 'tlc', 'total wbc count'],
    category: 'CBC',
    defaultUnit: '/µL',
    defaultRefLow: 4000,
    defaultRefHigh: 11000,
    precision: 0,
    description: 'Key cellular markers of the immune system.',
    clinicalMeaning: 'Elevation indicates infection or systemic inflammation; low counts suggest marrow suppression or viral illness.',
  },
  {
    key: 'rbc',
    name: 'Red Blood Cells (RBC)',
    aliases: ['rbc', 'red blood cell', 'total rbc', 'erythrocyte count'],
    category: 'CBC',
    defaultUnit: 'mil/µL',
    defaultRefLow: 4.5,
    defaultRefHigh: 5.9,
    precision: 2,
    description: 'Erythrocyte concentration per volume of blood.',
    clinicalMeaning: 'Evaluated with hemoglobin to assess oxygen transport capacity and erythropoiesis.',
  },
  {
    key: 'hba1c',
    name: 'Glycated Hemoglobin (HbA1c)',
    aliases: ['hba1c', 'glycated hemoglobin', 'glycohemoglobin', 'a1c'],
    category: 'Diabetes',
    defaultUnit: '%',
    defaultRefLow: 4.0,
    defaultRefHigh: 5.6,
    precision: 1,
    description: 'Average blood glucose level over the preceding 2–3 months.',
    clinicalMeaning: '<5.7% Normal, 5.7–6.4% Prediabetes, >=6.5% Diabetes threshold.',
  },
  {
    key: 'glucose',
    name: 'Fasting Blood Sugar (FBS)',
    aliases: ['glucose', 'blood sugar', 'fasting blood sugar', 'fbs', 'plasma glucose'],
    category: 'Diabetes',
    defaultUnit: 'mg/dL',
    defaultRefLow: 70,
    defaultRefHigh: 99,
    precision: 0,
    description: 'Blood sugar measured after an overnight fast.',
    clinicalMeaning: '70–99 mg/dL is standard normal; 100–125 mg/dL indicates impaired fasting glucose.',
  },
  {
    key: 'cholesterol',
    name: 'Total Cholesterol',
    aliases: ['total cholesterol', 'cholesterol', 'serum cholesterol'],
    category: 'Lipid',
    defaultUnit: 'mg/dL',
    defaultRefLow: 120,
    defaultRefHigh: 200,
    precision: 0,
    description: 'Overall circulating blood cholesterol levels.',
    clinicalMeaning: 'Desirable level is < 200 mg/dL. Elevated levels correlate with cardiovascular risk.',
  },
  {
    key: 'creatinine',
    name: 'Serum Creatinine',
    aliases: ['creatinine', 'serum creatinine', 'sr creatinine'],
    category: 'KFT',
    defaultUnit: 'mg/dL',
    defaultRefLow: 0.7,
    defaultRefHigh: 1.3,
    precision: 2,
    description: 'Metabolic waste product filtered exclusively by kidneys.',
    clinicalMeaning: 'Primary marker of glomerular filtration rate and renal clearance capacity.',
  },
];

/**
 * Parses a reference range string e.g. "150000 - 450000", "13.0 - 17.0 g/dL", "< 5.7", "> 60".
 */
export function parseReferenceRange(
  rawRange: string | undefined,
  fallbackLow: number,
  fallbackHigh: number
): { low: number; high: number } {
  if (!rawRange || typeof rawRange !== 'string') {
    return { low: fallbackLow, high: fallbackHigh };
  }

  const cleaned = rawRange.trim();

  // Pattern: "150000 - 450000" or "13.0 - 17.0" or "4.5 to 5.9"
  const rangeMatch = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:-|–|—|to)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && !isNaN(high) && low < high) {
      return { low, high };
    }
  }

  // Pattern: "< 5.7" or "<= 100"
  const lessMatch = cleaned.match(/(?:<|<=)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (lessMatch) {
    const high = parseFloat(lessMatch[1]);
    if (!isNaN(high)) {
      return { low: 0, high };
    }
  }

  // Pattern: "> 60"
  const greaterMatch = cleaned.match(/(?:>|>=)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (greaterMatch) {
    const low = parseFloat(greaterMatch[1]);
    if (!isNaN(low)) {
      return { low, high: low * 2 };
    }
  }

  return { low: fallbackLow, high: fallbackHigh };
}

/**
 * Determines clinical status for a numerical value against lower/upper limits.
 */
export function evaluateClinicalStatus(
  value: number,
  low: number,
  high: number,
  biomarkerKey: string
): ClinicalStatus {
  if (isNaN(value)) return 'Normal';

  // Critical bounds logic
  if (biomarkerKey === 'platelets') {
    if (value < 20000 || value > 1000000) return 'Critical';
    if (value < low) return 'Low';
    if (value > high) return 'High';
    return 'Normal';
  }

  if (biomarkerKey === 'hemoglobin') {
    if (value < 7.0 || value > 20.0) return 'Critical';
    if (value < low) return 'Low';
    if (value > high) return 'High';
    return 'Normal';
  }

  if (biomarkerKey === 'wbc') {
    if (value < 2000 || value > 30000) return 'Critical';
    if (value < low) return 'Low';
    if (value > high) return 'High';
    return 'Normal';
  }

  if (biomarkerKey === 'hba1c') {
    if (value >= 10.0) return 'Critical';
    if (value >= 6.5) return 'High';
    if (value >= 5.7) return 'High';
    return 'Normal';
  }

  // General threshold calculation
  const rangeSpan = Math.max(1, high - low);
  if (value < low - rangeSpan * 0.4 || value > high + rangeSpan * 0.8) {
    return 'Critical';
  }
  if (value < low) return 'Low';
  if (value > high) return 'High';
  return 'Normal';
}

/**
 * Normalizes parameter names to find a matching BiomarkerDefinition.
 */
export function findBiomarkerDefinition(paramName: string): BiomarkerDefinition {
  const normalized = paramName.trim().toLowerCase();
  for (const def of BIOMARKER_CATALOG) {
    if (def.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return def;
    }
  }

  // Dynamic fallback for any biomarker
  return {
    key: normalized.replace(/[^a-z0-9]/g, '_'),
    name: paramName,
    aliases: [normalized],
    category: 'General',
    defaultUnit: '',
    defaultRefLow: 0,
    defaultRefHigh: 100,
    precision: 1,
    description: `Clinical measurement of ${paramName}.`,
    clinicalMeaning: 'Interpreted relative to biological reference intervals.',
  };
}

/**
 * Normalizes numerical values across reports to prevent unit mismatch
 * (e.g., Platelets reported as 1.8 Lakh vs 180,000 /µL).
 */
export function normalizeBiomarkerValue(
  value: number,
  unit: string | undefined,
  def: BiomarkerDefinition
): { normalizedValue: number; normalizedUnit: string; displayValue: string } {
  if (def.key === 'platelets') {
    // If value is under 100, it was reported in Lakhs / 10^5 (e.g. 1.8)
    if (value > 0 && value < 50) {
      const converted = Math.round(value * 100000);
      return {
        normalizedValue: converted,
        normalizedUnit: '/µL',
        displayValue: converted.toLocaleString('en-IN'),
      };
    }
    return {
      normalizedValue: value,
      normalizedUnit: '/µL',
      displayValue: value.toLocaleString('en-IN'),
    };
  }

  if (def.key === 'wbc') {
    return {
      normalizedValue: value,
      normalizedUnit: '/µL',
      displayValue: value.toLocaleString('en-IN'),
    };
  }

  return {
    normalizedValue: value,
    normalizedUnit: unit || def.defaultUnit,
    displayValue: def.precision > 0 ? value.toFixed(def.precision) : String(Math.round(value)),
  };
}

/**
 * Extracts and compiles an array of chronological ClinicalDataPoints for a specific biomarker
 * across all available patient reports.
 */
export function extractBiomarkerTrend(
  reports: LabReport[],
  biomarkerKey: string
): {
  points: ClinicalDataPoint[];
  definition: BiomarkerDefinition;
  refRange: { low: number; high: number };
  unit: string;
} {
  const definition = BIOMARKER_CATALOG.find((b) => b.key === biomarkerKey) || findBiomarkerDefinition(biomarkerKey);

  // 1. Sort reports chronologically (oldest to newest)
  const sortedReports = [...reports].sort((a, b) => {
    const da = new Date(a.collectionDate || a.reportedDate || (a as any).createdAt || 0).getTime();
    const db = new Date(b.collectionDate || b.reportedDate || (b as any).createdAt || 0).getTime();
    return da - db;
  });

  const extractedPoints: ClinicalDataPoint[] = [];

  for (const report of sortedReports) {
    if (!report.parameters || !Array.isArray(report.parameters)) continue;

    // Find parameter matching the definition aliases
    const matchedParam = report.parameters.find((p: LabParameter) => {
      const pName = (p.name || '').toLowerCase().trim();
      return definition.aliases.some((alias) => pName.includes(alias) || alias.includes(pName));
    });

    if (!matchedParam) continue;

    const rawNum = typeof matchedParam.value === 'number' 
      ? matchedParam.value 
      : parseFloat(String(matchedParam.value).replace(/,/g, ''));

    if (isNaN(rawNum)) continue;

    const { normalizedValue, normalizedUnit, displayValue } = normalizeBiomarkerValue(
      rawNum,
      matchedParam.unit,
      definition
    );

    const ref = parseReferenceRange(
      matchedParam.referenceRange,
      definition.defaultRefLow,
      definition.defaultRefHigh
    );

    const status = (matchedParam.status as ClinicalStatus) || evaluateClinicalStatus(
      normalizedValue,
      ref.low,
      ref.high,
      definition.key
    );

    const dateObj = new Date(report.collectionDate || report.reportedDate || (report as any).createdAt || Date.now());
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    extractedPoints.push({
      id: `${report.id || (report as any)._id || Math.random().toString(36)}-${definition.key}`,
      date: formattedDate,
      rawDate: dateObj.toISOString(),
      value: normalizedValue,
      displayValue,
      unit: normalizedUnit,
      status,
      referenceRange: matchedParam.referenceRange || `${ref.low} – ${ref.high} ${normalizedUnit}`,
      refLow: ref.low,
      refHigh: ref.high,
      reportId: report.id || (report as any)._id,
      reportName: report.name,
      labName: report.labName,
      isEdited: Boolean((matchedParam as any).isEdited),
      isCurrent: false,
    });
  }

  // 2. Compute deltas & percentage changes between consecutive points
  for (let i = 0; i < extractedPoints.length; i++) {
    if (i === 0) {
      extractedPoints[i].delta = undefined;
      extractedPoints[i].pctChange = undefined;
    } else {
      const prevVal = extractedPoints[i - 1].value;
      const curVal = extractedPoints[i].value;
      const delta = curVal - prevVal;
      const pct = prevVal !== 0 ? (delta / Math.abs(prevVal)) * 100 : 0;
      extractedPoints[i].delta = parseFloat(delta.toFixed(definition.precision));
      extractedPoints[i].pctChange = parseFloat(pct.toFixed(1));
    }
  }

  // Mark the most recent point as current
  if (extractedPoints.length > 0) {
    extractedPoints[extractedPoints.length - 1].isCurrent = true;
  }

  // Get active reference range from latest point or default
  const latestPoint = extractedPoints[extractedPoints.length - 1];
  const refRange = latestPoint 
    ? { low: latestPoint.refLow, high: latestPoint.refHigh }
    : { low: definition.defaultRefLow, high: definition.defaultRefHigh };

  const unit = latestPoint?.unit || definition.defaultUnit;

  return {
    points: extractedPoints,
    definition,
    refRange,
    unit,
  };
}

/**
 * Computes Y-axis scale domain boundaries [min, max] that smoothly enclose
 * both the measured data points and the clinical reference range band with elegant padding.
 */
export function computeYAxisDomain(
  points: ClinicalDataPoint[],
  refLow: number,
  refHigh: number
): [number, number] {
  const values = points.map((p) => p.value);
  const allMin = values.length > 0 ? Math.min(...values, refLow) : refLow;
  const allMax = values.length > 0 ? Math.max(...values, refHigh) : refHigh;

  const span = Math.max(1, allMax - allMin);
  const pad = span * 0.15; // 15% breathing room top and bottom

  const yMin = Math.max(0, Math.floor(allMin - pad));
  const yMax = Math.ceil(allMax + pad);

  return [yMin, yMax];
}
