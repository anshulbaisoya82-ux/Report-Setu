import { Report, IReport } from '../repositories';
export type TrendDirection = 'up' | 'down' | 'stable' | 'neutral';
import { PatientProfile, IPatientProfile } from '../repositories';
import { DoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import { mlClient, MlMeasurement, MlForecast, MlInsight } from './mlClient';
import { NotFoundError, ForbiddenError } from '../utils/errors';
type UserRoleType = 'patient' | 'doctor' | 'admin';

export interface HistoricalTrendPoint {
  date: string;
  rawDate: string;
  platelets?: number;
  hemoglobin?: number;
  wbc?: number;
  rbc?: number;
  hba1c?: number;
  [key: string]: any;
}

export interface ParameterTrajectory {
  testCode: string;
  testName: string;
  unit: string;
  currentValue: number;
  previousValue?: number;
  delta?: number;
  percentageChange?: number;
  trendDirection: TrendDirection;
  unusualChange: boolean;
  unusualChangeReason?: string;
  history: { date: string; value: number }[];
}

export interface PatientTrendsResult {
  patientId: string;
  patientName: string;
  historicalTrends: HistoricalTrendPoint[];
  trajectories: Record<string, ParameterTrajectory>;
  forecast: {
    hba1c: MlForecast;
  };
  insights: MlInsight[];
}

/**
 * Maps varying parameter names to standard frontend keys.
 */
export const normalizeParamKey = (
  name: string
): 'platelets' | 'hemoglobin' | 'wbc' | 'rbc' | 'hba1c' | null => {
  const n = name.trim().toLowerCase();
  if (n.includes('hba1c') || n.includes('glycated')) return 'hba1c';
  if (n.includes('platelet') || n === 'plt') return 'platelets';
  if (n.includes('hemoglobin') || n === 'hb') return 'hemoglobin';
  if (n.includes('wbc') || n.includes('leukocyte') || n.includes('white blood')) return 'wbc';
  if (n.includes('rbc') || n.includes('red blood')) return 'rbc';
  return null;
};

/**
 * Formats a Date object to standard frontend string: "22 Oct 2026"
 */
export const formatTrendDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Calculates trend direction and percentage change between previous and current values.
 */
export const calculateTrendDelta = (
  current: number,
  previous?: number
): {
  delta?: number;
  percentageChange?: number;
  trendDirection: TrendDirection;
} => {
  if (previous === undefined || previous === null || isNaN(previous)) {
    return { trendDirection: 'neutral' };
  }

  const delta = parseFloat((current - previous).toFixed(2));
  const percentageChange =
    previous !== 0 ? parseFloat((((current - previous) / Math.abs(previous)) * 100).toFixed(1)) : 0;

  let trendDirection: TrendDirection = 'neutral';
  // If shifted by more than 2% of previous value, classify as up or down
  const threshold = Math.abs(previous) * 0.02;
  if (current > previous + threshold) {
    trendDirection = 'up';
  } else if (current < previous - threshold) {
    trendDirection = 'down';
  }

  return { delta, percentageChange, trendDirection };
};

/**
 * Detects whether a parameter shift is clinically unusual or acute
 * aligned with Machine learning/ml/analysis/unusual_change.py
 */
export const detectUnusualChange = (
  paramKey: string,
  current: number,
  previous: number,
  unit = ''
): { unusual: boolean; reason?: string } => {
  const delta = current - previous;
  const pct = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;

  if (paramKey === 'hba1c') {
    if (Math.abs(delta) >= 1.0) {
      return {
        unusual: true,
        reason: `Significant HbA1c shift of ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% in short interval.`,
      };
    }
  }

  if (paramKey === 'platelets') {
    // Acute drop >= 30%
    if (pct <= -30) {
      return {
        unusual: true,
        reason: `Rapid platelet drop of ${Math.abs(pct).toFixed(1)}% (from ${previous} to ${current} ${unit}).`,
      };
    }
    // Absolute drop >= 50,000 (if absolute count) or >= 0.5 (if lakh)
    if (previous > 1000 && previous - current >= 50000) {
      return {
        unusual: true,
        reason: `Acute platelet drop of ${(previous - current).toLocaleString()} ${unit}.`,
      };
    }
  }

  if (paramKey === 'hemoglobin') {
    if (delta <= -2.0 || pct <= -18.0) {
      return {
        unusual: true,
        reason: `Acute hemoglobin decline of ${Math.abs(delta).toFixed(1)} g/dL (${Math.abs(pct).toFixed(1)}%).`,
      };
    }
  }

  if (paramKey === 'wbc') {
    if (pct >= 50.0 || pct <= -40.0) {
      return {
        unusual: true,
        reason: `Sharp leukocytosis/leukopenia shift of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%.`,
      };
    }
  }

  return { unusual: false };
};

/**
 * Service: Retrieves longitudinal trend time series, parameter trajectories with deltas,
 * unusual change flags, and 90-day HbA1c trajectory forecast for a patient.
 */
export async function getPatientHistoricalTrends(
  targetPatientId: string,
  userId: string,
  userRole: UserRoleType
): Promise<PatientTrendsResult> {
  const patient = await PatientProfile.findById(targetPatientId);
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  // Access validation:
  if (userRole === 'patient') {
    if (patient.userId.toString() !== userId) {
      throw new ForbiddenError('Access denied: You can only view your own trends');
    }
  } else if (userRole === 'doctor') {
    const doctorProfile = await DoctorProfile.findOne({ userId });
    if (!doctorProfile) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const hasConnection = await Connection.findOne({
      doctorId: doctorProfile._id,
      patientId: patient._id,
      status: 'active',
    });
    if (!hasConnection) {
      throw new ForbiddenError('Access denied: Active connection required to view patient trends');
    }
  }

  // Fetch all reports for this patient sorted chronologically (oldest to newest)
  const reports = await Report.find({ patientId: patient._id })
    .sort({ collectionDate: 1 })
    .lean();

  const trendPointsMap: Map<string, HistoricalTrendPoint> = new Map();
  const trajectoryMap: Record<
    string,
    {
      testCode: string;
      testName: string;
      unit: string;
      readings: { date: string; value: number }[];
    }
  > = {};

  const mlMeasurements: MlMeasurement[] = [];

  for (const report of reports) {
    const collectionDate = new Date(report.collectionDate || (report as any).createdAt);
    const dateFormatted = formatTrendDate(collectionDate);
    const isoDate = collectionDate.toISOString();

    if (!trendPointsMap.has(dateFormatted)) {
      trendPointsMap.set(dateFormatted, {
        date: dateFormatted,
        rawDate: isoDate,
      });
    }

    const point = trendPointsMap.get(dateFormatted)!;

    for (const param of report.parameters || []) {
      const val = Number(param.value);
      if (isNaN(val)) continue;

      const normKey = normalizeParamKey(param.name);
      if (normKey) {
        point[normKey] = val;

        if (!trajectoryMap[normKey]) {
          trajectoryMap[normKey] = {
            testCode: normKey.toUpperCase(),
            testName: param.name,
            unit: param.unit || '',
            readings: [],
          };
        }
        trajectoryMap[normKey].readings.push({
          date: dateFormatted,
          value: val,
        });

        mlMeasurements.push({
          test_name: param.name,
          test_code: normKey.toUpperCase(),
          value: val,
          unit: param.unit || '',
          date: isoDate.split('T')[0],
          flag: 'normal',
        });
      }
    }
  }

  const historicalTrends: HistoricalTrendPoint[] = Array.from(trendPointsMap.values());

  // Calculate trajectories with deltas and unusual change detection
  const trajectories: Record<string, ParameterTrajectory> = {};

  for (const [key, data] of Object.entries(trajectoryMap)) {
    const readings = data.readings;
    const current = readings.length > 0 ? readings[readings.length - 1].value : 0;
    const previous = readings.length > 1 ? readings[readings.length - 2].value : undefined;

    const { delta, percentageChange, trendDirection } = calculateTrendDelta(current, previous);

    let unusualChange = false;
    let unusualChangeReason: string | undefined;

    if (previous !== undefined) {
      const anomaly = detectUnusualChange(key, current, previous, data.unit);
      unusualChange = anomaly.unusual;
      unusualChangeReason = anomaly.reason;
    }

    trajectories[key] = {
      testCode: data.testCode,
      testName: data.testName,
      unit: data.unit,
      currentValue: current,
      previousValue: previous,
      delta,
      percentageChange,
      trendDirection,
      unusualChange,
      unusualChangeReason,
      history: readings,
    };
  }

  // HbA1c 90-day trajectory forecast via ML Client
  const hba1cMeasurements = mlMeasurements.filter((m) => m.test_code === 'HBA1C');
  const hba1cForecast = await mlClient.forecastHbA1c(hba1cMeasurements);

  // Cross-reference trends and unusual shifts with ML analyzePatient insights
  let insights: MlInsight[] = [];
  try {
    insights = await mlClient.analyzePatient(mlMeasurements);
  } catch {
    insights = [];
  }

  return {
    patientId: patient._id.toString(),
    patientName: patient.name,
    historicalTrends,
    trajectories,
    forecast: {
      hba1c: hba1cForecast,
    },
    insights,
  };
}
