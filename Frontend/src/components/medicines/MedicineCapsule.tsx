import React, { useId } from 'react';

export interface MedicineCapsuleProps {
  dosesTaken: number;
  totalDoses: number;
  remainingDoses?: number;
  className?: string;
}

/**
 * Reusable two-tone SVG Capsule component for ReportSetu Patient Medicine Tracker.
 * 
 * Strict specifications from design mockup:
 * - Single continuous capsule silhouette with fully rounded semicircular ends.
 * - Left section: muted coral (#CE7058) with bold white number.
 * - Right section: warm off-white (#F8F7F0) with bold forest green number (#0E382F).
 * - Diagonal divider (slanted / with top-right to bottom-left cut) with zero gaps.
 * - Large centered dose numbers with high legibility.
 * - Realistic soft ambient drop shadow underneath.
 * - Scales responsively without distortion.
 * - Dynamic React props for dosesTaken, totalDoses, and remainingDoses.
 */
export const MedicineCapsule: React.FC<MedicineCapsuleProps> = ({
  dosesTaken,
  totalDoses,
  className = '',
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const filterId = `capsule-shadow-${uniqueId}`;
  const clipId = `capsule-clip-${uniqueId}`;

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 250 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[260px] sm:max-w-[280px] h-auto overflow-visible select-none drop-shadow-xs"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Medicine Tracker Capsule: ${dosesTaken} doses taken out of ${totalDoses} planned`}
      >
        <defs>
          {/* Subtle realistic dual-stage drop shadow for authentic table-top depth */}
          <filter id={filterId} x="-30%" y="-20%" width="160%" height="180%" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0E382F" floodOpacity="0.16" />
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0E382F" floodOpacity="0.08" />
          </filter>

          {/* Precision capsule clipping path with fully rounded ends (rx = height / 2 = 38) */}
          <clipPath id={clipId}>
            <rect x="17" y="10" width="216" height="76" rx="38" ry="38" />
          </clipPath>
        </defs>

        {/* Capsule silhouette with realistic shadow and clipped two-tone halves */}
        <g filter={`url(#${filterId})`}>
          <g clipPath={`url(#${clipId})`}>
            {/* Right section: warm off-white (#F8F7F0) */}
            <rect x="17" y="10" width="216" height="76" fill="#F8F7F0" />

            {/* Left section: muted coral (#CE7058) with angled diagonal divider */}
            <polygon points="17,10 135,10 117,86 17,86" fill="#CE7058" />
          </g>
        </g>

        {/* Large centered dose numbers */}
        {/* Left dose number: dosesTaken (white) */}
        <text
          x="72"
          y="49"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontFamily="Plus Jakarta Sans, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontWeight="800"
          fontSize="37"
          letterSpacing="-0.03em"
        >
          {dosesTaken}
        </text>

        {/* Right dose number: totalDoses (dark brand forest #0E382F) */}
        <text
          x="178"
          y="49"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0E382F"
          fontFamily="Plus Jakarta Sans, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontWeight="800"
          fontSize="37"
          letterSpacing="-0.03em"
        >
          {totalDoses}
        </text>
      </svg>
    </div>
  );
};


