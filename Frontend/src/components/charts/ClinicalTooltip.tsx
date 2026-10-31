import React from 'react';
import { ClinicalDataPoint, CLINICAL_CHART_THEME } from './chartTypes';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

interface ClinicalTooltipProps {
  active?: boolean;
  payload?: any[];
  onClickReport?: (reportId: string) => void;
}

export const ClinicalTooltip: React.FC<ClinicalTooltipProps> = ({
  active,
  payload,
  onClickReport,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Find the clinical data point from the payload
  const point: ClinicalDataPoint = payload[0]?.payload;
  if (!point) return null;

  const isCritical = point.status === 'Critical';
  const isAbnormal = point.status === 'Low' || point.status === 'High';
  const isNormal = point.status === 'Normal';

  const statusColor = isCritical
    ? CLINICAL_CHART_THEME.pointCritical
    : isAbnormal
    ? CLINICAL_CHART_THEME.pointLowHigh
    : CLINICAL_CHART_THEME.pointNormal;

  const statusBg = isCritical
    ? 'bg-red-50 text-red-600 border-red-200'
    : isAbnormal
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-forest-50 text-forest-800 border-stone-300';

  // Relative position calculation within reference limits
  const refSpan = point.refHigh - point.refLow;
  const pctPosition = refSpan > 0 
    ? Math.min(100, Math.max(0, ((point.value - point.refLow) / refSpan) * 100))
    : 50;

  return (
    <div className="bg-white/95 rounded-2xl shadow-sm border border-stone-200/90 p-4 max-w-xs text-xs space-y-3 z-50 pointer-events-auto transition-all">
      {/* Header: Date & Status */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-2 gap-2">
        <div>
          <span className="font-bold text-stone-900 block text-xs">{point.date}</span>
          {point.labName && (
            <span className="text-xs text-stone-400 block truncate max-w-[170px]">
              {point.labName}
            </span>
          )}
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${statusBg}`}
        >
          {isCritical ? (
            <AlertTriangle className="w-3 h-3 text-red-600" />
          ) : isNormal ? (
            <CheckCircle2 className="w-3 h-3 text-forest-800" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
          <span>{point.status}</span>
        </span>
      </div>

      {/* Main Reading & Value */}
      <div className="space-y-1">
        <span className="text-xs text-stone-500 font-medium">Result value</span>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-2xl font-semibold font-serif tracking-tight"
            style={{ color: statusColor }}
          >
            {point.displayValue}
          </span>
          <span className="text-xs font-semibold text-stone-500">{point.unit}</span>
        </div>
      </div>

      {/* Reference Interval Position Visualizer */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
          <span>Ref: {point.refLow.toLocaleString('en-IN')}</span>
          <span className="text-stone-400">Normal Range</span>
          <span>{point.refHigh.toLocaleString('en-IN')} {point.unit}</span>
        </div>

        {/* Clinical Bar */}
        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden relative border border-stone-200/60">
          {/* Normal Band */}
          <div className="absolute inset-y-0 left-[20%] right-[20%] bg-forest-50" />
          {/* Active Reading Pin */}
          <div
            className="absolute top-0 bottom-0 w-2.5 -ml-1 rounded-full shadow-xs transition-all"
            style={{
              left: `${pctPosition}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </div>

      {/* Delta vs Previous Checkpoint (if available) */}
      {point.delta !== undefined && point.pctChange !== undefined && (
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-stone-100">
          <span className="text-stone-400">Change vs prior:</span>
          <span
            className={`font-bold flex items-center gap-0.5 ${
              point.delta > 0
                ? 'text-forest-800'
                : point.delta < 0
                ? 'text-red-600'
                : 'text-stone-600'
            }`}
          >
            {point.delta > 0 ? (
              <ArrowUp className="w-3 h-3" />
            ) : point.delta < 0 ? (
              <ArrowDown className="w-3 h-3" />
            ) : null}
            <span>
              {point.delta > 0 ? '+' : ''}
              {point.delta.toLocaleString('en-IN')} {point.unit} ({point.pctChange > 0 ? '+' : ''}
              {point.pctChange}%)
            </span>
          </span>
        </div>
      )}

      {/* Report deep-link prompt */}
      {point.reportId && onClickReport && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickReport(point.reportId!);
          }}
          className="w-full mt-2 pt-2 border-t border-stone-100 text-xs font-semibold text-forest-900 hover:text-teal-500 flex items-center justify-between group transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-stone-400 group-hover:text-teal-500" />
            <span>Open verified report</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
};
