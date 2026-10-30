import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { LabReport } from '../../types';
import {
  ClinicalDataPoint,
  CLINICAL_CHART_THEME,
  MedicalChartDateRange,
} from './chartTypes';
import {
  extractBiomarkerTrend,
  computeYAxisDomain,
  BIOMARKER_CATALOG,
} from './clinicalDataTransformer';
import { ParameterSelector } from './ParameterSelector';
import { ClinicalTooltip } from './ClinicalTooltip';
import { ChartLegend } from './ChartLegend';
import { TrendSummary } from './TrendSummary';
import { 
  FileSpreadsheet, 
  Layers, 
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';

export interface MedicalTrendChartProps {
  reports: LabReport[];
  initialKey?: string;
  allowedKeys?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  showSelector?: boolean;
  showSummary?: boolean;
  showLegend?: boolean;
  showDateFilter?: boolean;
  compact?: boolean;
  onClickReport?: (reportId: string) => void;
  className?: string;
}

// Custom interactive data point dot
const ClinicalDataDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;

  const isCritical = payload.status === 'Critical';
  const isAbnormal = payload.status === 'Low' || payload.status === 'High';
  const isCurrent = payload.isCurrent;

  const dotColor = isCritical
    ? CLINICAL_CHART_THEME.pointCritical
    : isAbnormal
    ? CLINICAL_CHART_THEME.pointLowHigh
    : CLINICAL_CHART_THEME.pointNormal;

  return (
    <g className="cursor-pointer transition-transform duration-150">
      {/* Outer halo for the most recent reading */}
      {isCurrent && (
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={dotColor}
          fillOpacity={0.18}
          stroke={dotColor}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}

      {/* Main clinical marker */}
      <circle
        cx={cx}
        cy={cy}
        r={isCurrent ? 6 : 5}
        fill={dotColor}
        stroke="#FFFFFF"
        strokeWidth={2}
        className="filter drop-shadow-xs"
      />
    </g>
  );
};

export const MedicalTrendChart: React.FC<MedicalTrendChartProps> = ({
  reports = [],
  initialKey = 'platelets',
  allowedKeys,
  title,
  subtitle,
  height = 340,
  showSelector = true,
  showSummary = true,
  showLegend = true,
  showDateFilter = true,
  compact = false,
  onClickReport,
  className = '',
}) => {
  // 1. Parameter selection state
  const [activeKey, setActiveKey] = useState<string>(initialKey);
  const [dateRange, setDateRange] = useState<MedicalChartDateRange>('all');

  React.useEffect(() => {
    if (initialKey) {
      setActiveKey(initialKey);
    }
  }, [initialKey]);

  // 2. Extract trend data
  const { points: rawPoints, definition, refRange, unit } = useMemo(() => {
    return extractBiomarkerTrend(reports, activeKey);
  }, [reports, activeKey]);

  // 3. Filter by date range if applicable
  const points = useMemo(() => {
    if (rawPoints.length === 0 || dateRange === 'all') return rawPoints;

    const now = Date.now();
    let cutoff = 0;
    if (dateRange === '3m') cutoff = now - 90 * 24 * 60 * 60 * 1000;
    if (dateRange === '6m') cutoff = now - 180 * 24 * 60 * 60 * 1000;
    if (dateRange === '1y') cutoff = now - 365 * 24 * 60 * 60 * 1000;

    const filtered = rawPoints.filter((p) => new Date(p.rawDate).getTime() >= cutoff);
    // If filter left no points, fallback to all points
    return filtered.length > 0 ? filtered : rawPoints;
  }, [rawPoints, dateRange]);

  // 4. Compute Y-axis bounds
  const yDomain = useMemo(() => {
    return computeYAxisDomain(points, refRange.low, refRange.high);
  }, [points, refRange]);

  // Check abnormalities
  const hasAbnormalPoints = points.some((p) => p.status === 'Low' || p.status === 'High');
  const hasCriticalPoints = points.some((p) => p.status === 'Critical');

  // Formatting Y-axis tick values for cleanliness
  const formatYAxisTick = (val: number) => {
    if (val >= 100000) {
      return `${(val / 100000).toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(0)}k`;
    }
    return String(val);
  };

  return (
    <div className={`bg-white rounded-3xl p-5 md:p-6 border border-stone-200/80 shadow-xs space-y-5 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-lg md:text-xl text-stone-900 tracking-tight">
              {title || `${definition.name} Trend`}
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
              {unit}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {subtitle || definition.description}
          </p>
        </div>

        {/* Date Range Selector */}
        {showDateFilter && points.length > 1 && (
          <div className="flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl self-start md:self-auto">
            {(['all', '1y', '6m', '3m'] as MedicalChartDateRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  dateRange === range
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parameter Selector Pills */}
      {showSelector && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1">
            <span>Select Laboratory Parameter:</span>
            <span>{points.length} recorded checkpoints</span>
          </div>
          <ParameterSelector
            activeKey={activeKey}
            onSelectKey={(k) => setActiveKey(k)}
            reports={reports}
            allowedKeys={allowedKeys}
          />
        </div>
      )}

      {/* Main Chart Area or Empty State */}
      {points.length === 0 ? (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h4 className="font-serif font-bold text-stone-800 text-sm md:text-base">
            No Historical Data for {definition.name}
          </h4>
          <p className="text-xs text-stone-400 max-w-sm mt-1 leading-relaxed">
            Verified laboratory reports containing this parameter have not been uploaded yet. Upload CBC or related blood work to plot longitudinal trends.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Recharts Canvas */}
          <div style={{ width: '100%', height: compact ? 250 : height }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 20, right: 24, left: 0, bottom: 10 }}
              >
                {/* Background Grid Lines: horizontal only */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={CLINICAL_CHART_THEME.gridLine}
                />

                {/* X-Axis: Test Dates */}
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: CLINICAL_CHART_THEME.gridLine }}
                  tick={{
                    fontSize: 11,
                    fill: CLINICAL_CHART_THEME.axisText,
                    fontFamily: 'sans-serif',
                  }}
                  dy={8}
                />

                {/* Y-Axis: Scaled Values */}
                <YAxis
                  domain={yDomain}
                  tickLine={false}
                  axisLine={{ stroke: CLINICAL_CHART_THEME.gridLine }}
                  tick={{
                    fontSize: 11,
                    fill: CLINICAL_CHART_THEME.axisText,
                    fontFamily: 'monospace',
                  }}
                  tickFormatter={formatYAxisTick}
                  width={52}
                />

                {/* Shaded Reference Range Band (Normal Biological Interval) */}
                <ReferenceArea
                  y1={refRange.low}
                  y2={refRange.high}
                  fill={CLINICAL_CHART_THEME.referenceRangeBand}
                  fillOpacity={0.9}
                  stroke={CLINICAL_CHART_THEME.referenceLineBorder}
                  strokeDasharray="3 3"
                />

                {/* Upper Limit Reference Line */}
                <ReferenceLine
                  y={refRange.high}
                  stroke={CLINICAL_CHART_THEME.referenceLineBorder}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />

                {/* Lower Limit Reference Line */}
                <ReferenceLine
                  y={refRange.low}
                  stroke={CLINICAL_CHART_THEME.referenceLineBorder}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />

                {/* Interactive Tooltip */}
                <Tooltip
                  content={
                    <ClinicalTooltip
                      onClickReport={onClickReport}
                    />
                  }
                  cursor={{
                    stroke: '#219E91',
                    strokeWidth: 1.5,
                    strokeDasharray: '3 3',
                  }}
                />

                {/* Measured Clinical Trend Line */}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CLINICAL_CHART_THEME.primaryLine}
                  strokeWidth={2.5}
                  dot={<ClinicalDataDot />}
                  activeDot={{
                    r: 8,
                    fill: CLINICAL_CHART_THEME.primaryLine,
                    stroke: '#FFFFFF',
                    strokeWidth: 3,
                    className: 'filter drop-shadow-md',
                  }}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Single Point Info Banner */}
          {points.length === 1 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-800 text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Baseline checkpoint recorded on <strong>{points[0].date}</strong>. Upload your subsequent blood tests to observe trajectory progression.
              </span>
            </div>
          )}

          {/* Clinical Legend */}
          {showLegend && (
            <ChartLegend
              refLow={refRange.low}
              refHigh={refRange.high}
              unit={unit}
              hasAbnormalPoints={hasAbnormalPoints}
              hasCriticalPoints={hasCriticalPoints}
            />
          )}

          {/* Trend Summary & Clinical Interpretation Card */}
          {showSummary && points.length > 0 && (
            <TrendSummary
              points={points}
              definition={definition}
              refLow={refRange.low}
              refHigh={refRange.high}
              unit={unit}
            />
          )}
        </div>
      )}
    </div>
  );
};
