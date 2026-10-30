import React from 'react';
import { ClinicalDataPoint, BiomarkerDefinition, CLINICAL_CHART_THEME } from './chartTypes';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Calendar,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface TrendSummaryProps {
  points: ClinicalDataPoint[];
  definition: BiomarkerDefinition;
  refLow: number;
  refHigh: number;
  unit: string;
}

export const TrendSummary: React.FC<TrendSummaryProps> = ({
  points,
  definition,
  refLow,
  refHigh,
  unit,
}) => {
  if (points.length === 0) return null;

  const currentPoint = points[points.length - 1];
  const priorPoint = points.length > 1 ? points[points.length - 2] : null;

  const isCritical = currentPoint.status === 'Critical';
  const isAbnormal = currentPoint.status === 'Low' || currentPoint.status === 'High';
  const isNormal = currentPoint.status === 'Normal';

  // Clinical trajectory determination
  let trendDirection: 'rising' | 'falling' | 'stable' = 'stable';
  let trendPct = 0;
  if (priorPoint && currentPoint.delta !== undefined && currentPoint.pctChange !== undefined) {
    trendPct = currentPoint.pctChange;
    if (Math.abs(trendPct) < 2.5) {
      trendDirection = 'stable';
    } else if (trendPct > 0) {
      trendDirection = 'rising';
    } else {
      trendDirection = 'falling';
    }
  }

  // Interpret trajectory clinically (do NOT infer improvement simply because line is rising)
  let trajectoryComment = 'Baseline test record recorded.';
  let trajectoryTone: 'positive' | 'warning' | 'neutral' = 'neutral';

  if (priorPoint && currentPoint.delta !== undefined) {
    const wasNormal = priorPoint.status === 'Normal';
    const isNowNormal = currentPoint.status === 'Normal';

    if (!wasNormal && isNowNormal) {
      trajectoryComment = `Normalized back into target interval (${refLow} – ${refHigh} ${unit}).`;
      trajectoryTone = 'positive';
    } else if (wasNormal && !isNowNormal) {
      trajectoryComment = `Shifted out of biological reference range (${currentPoint.status.toLowerCase()} reading).`;
      trajectoryTone = 'warning';
    } else if (isCritical) {
      trajectoryComment = 'Reading remains in critical range requiring clinical correlation.';
      trajectoryTone = 'warning';
    } else if (Math.abs(trendPct) >= 20) {
      trajectoryComment = `Significant velocity: ${Math.abs(trendPct)}% ${trendDirection} shift since ${priorPoint.date}.`;
      trajectoryTone = isNowNormal ? 'neutral' : 'warning';
    } else if (trendDirection === 'stable') {
      trajectoryComment = 'Stable concentration across consecutive laboratory checkpoints.';
      trajectoryTone = isNormal ? 'positive' : 'neutral';
    } else {
      trajectoryComment = `${trendDirection === 'rising' ? 'Increased' : 'Decreased'} by ${Math.abs(currentPoint.delta).toLocaleString('en-IN')} ${unit} vs ${priorPoint.date}.`;
      trajectoryTone = isNormal ? 'neutral' : 'warning';
    }
  }

  // Clinical status badge styling
  const statusColor = isCritical
    ? CLINICAL_CHART_THEME.pointCritical
    : isAbnormal
    ? CLINICAL_CHART_THEME.pointLowHigh
    : CLINICAL_CHART_THEME.pointNormal;

  const statusBg = isCritical
    ? 'bg-red-50 text-red-700 border-red-200'
    : isAbnormal
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-[#EAF5EF] text-[#1E3F35] border-[#CAD8CF]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-stone-50/70 border border-stone-200/80 rounded-2xl">
      {/* 1. Latest Reading Card */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200/60 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#219E91]" />
            <span>Latest Reading</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <Calendar className="w-3 h-3" />
            <span>{currentPoint.date}</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xl md:text-3xl font-extrabold font-serif tracking-tight"
              style={{ color: statusColor }}
            >
              {currentPoint.displayValue}
            </span>
            <span className="text-xs font-semibold text-stone-500">{unit}</span>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${statusBg}`}>
            {isCritical ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            ) : isNormal ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#219E91]" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{currentPoint.status}</span>
          </span>
        </div>

        <div className="text-[11px] text-stone-400 pt-1 border-t border-stone-100 flex items-center justify-between">
          <span>Target Interval:</span>
          <span className="font-semibold text-stone-700">
            {refLow.toLocaleString('en-IN')} – {refHigh.toLocaleString('en-IN')} {unit}
          </span>
        </div>
      </div>

      {/* 2. Trajectory / Progression Card */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200/60 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
          <span>Consecutive Shift</span>
          <span className="text-[11px] text-stone-400">
            {priorPoint ? `vs ${priorPoint.date}` : 'Baseline Report'}
          </span>
        </div>

        {priorPoint && currentPoint.delta !== undefined ? (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold font-mono text-stone-800">
                {currentPoint.delta > 0 ? '+' : ''}
                {currentPoint.delta.toLocaleString('en-IN')} {unit}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  trendDirection === 'rising'
                    ? 'bg-stone-100 text-stone-800'
                    : trendDirection === 'falling'
                    ? 'bg-stone-100 text-stone-800'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {trendDirection === 'rising' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#219E91]" />
                ) : trendDirection === 'falling' ? (
                  <TrendingDown className="w-3.5 h-3.5 text-stone-600" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-stone-400" />
                )}
                <span>{trendPct > 0 ? `+${trendPct}%` : `${trendPct}%`}</span>
              </span>
            </div>

            <p className="text-[11px] text-stone-500 leading-snug">
              Prior recorded level was {priorPoint.displayValue} {unit} ({priorPoint.status}).
            </p>
          </div>
        ) : (
          <div className="pt-2 text-stone-500 text-xs">
            <p className="font-medium text-stone-700">Initial Baseline Record</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Subsequent laboratory reports will compute automated velocity & delta tracking.
            </p>
          </div>
        )}
      </div>

      {/* 3. Clinical Observation Card */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200/60 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#219E91]" />
            <span>Clinical Observation</span>
          </span>
          <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
            {definition.category}
          </span>
        </div>

        <p className="text-xs text-stone-700 font-medium leading-relaxed pt-0.5">
          {trajectoryComment}
        </p>

        <p className="text-[11px] text-stone-400 leading-snug pt-1 border-t border-stone-100">
          {definition.clinicalMeaning}
        </p>
      </div>
    </div>
  );
};
