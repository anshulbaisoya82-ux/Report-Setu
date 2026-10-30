import React from 'react';
import { CLINICAL_CHART_THEME } from './chartTypes';
import { AlertTriangle } from 'lucide-react';

interface ChartLegendProps {
  refLow?: number;
  refHigh?: number;
  unit?: string;
  hasAbnormalPoints?: boolean;
  hasCriticalPoints?: boolean;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  refLow,
  refHigh,
  unit,
  hasAbnormalPoints = true,
  hasCriticalPoints = true,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-3 border-t border-stone-100 font-sans">
      {/* Legend items */}
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        {/* Measured Trend */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-1 rounded-full inline-block"
            style={{ backgroundColor: CLINICAL_CHART_THEME.primaryLine }}
          />
          <span className="w-2.5 h-2.5 rounded-full border-2 border-white inline-block shadow-2xs"
            style={{ backgroundColor: CLINICAL_CHART_THEME.pointNormal }}
          />
          <span className="text-stone-700 font-medium">Report Reading (Normal)</span>
        </div>

        {/* Shaded Reference Range */}
        {refLow !== undefined && refHigh !== undefined && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-4 h-3 rounded-sm border inline-block"
              style={{
                backgroundColor: CLINICAL_CHART_THEME.referenceRangeBand,
                borderColor: CLINICAL_CHART_THEME.referenceLineBorder,
              }}
            />
            <span className="text-stone-600">
              Reference Interval ({refLow.toLocaleString('en-IN')} – {refHigh.toLocaleString('en-IN')} {unit})
            </span>
          </div>
        )}

        {/* Below / Above Normal Warning */}
        {hasAbnormalPoints && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full border border-white inline-block shadow-2xs"
              style={{ backgroundColor: CLINICAL_CHART_THEME.pointLowHigh }}
            />
            <span className="text-stone-600">Out of Range (Low / High)</span>
          </div>
        )}

        {/* Critical Range */}
        {hasCriticalPoints && (
          <div className="flex items-center gap-1.5 text-[#B53629]">
            <AlertTriangle className="w-3.5 h-3.5 inline-block text-[#DC5555]" />
            <span className="font-semibold text-[#DC5555]">Critical Value</span>
          </div>
        )}
      </div>

      <div className="text-[10px] text-stone-400">
        Clinical Reference: Standard Laboratory Biological Intervals
      </div>
    </div>
  );
};
