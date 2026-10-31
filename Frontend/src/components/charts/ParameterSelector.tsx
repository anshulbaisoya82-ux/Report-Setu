import React from 'react';
import { BIOMARKER_CATALOG } from './clinicalDataTransformer';
import { LabReport } from '../../types';

interface ParameterSelectorProps {
  activeKey: string;
  onSelectKey: (key: string) => void;
  reports?: LabReport[];
  allowedKeys?: string[]; // optional restriction e.g. ['platelets', 'hemoglobin', 'rbc', 'wbc']
}

export const ParameterSelector: React.FC<ParameterSelectorProps> = ({
  activeKey,
  onSelectKey,
  reports = [],
  allowedKeys,
}) => {
  // Discover available biomarkers from the reports or catalog
  const availableBiomarkers = BIOMARKER_CATALOG.filter((bio) => {
    if (allowedKeys && allowedKeys.length > 0) {
      return allowedKeys.includes(bio.key);
    }
    // Check if at least one report has a parameter matching this biomarker
    if (reports.length === 0) return true;
    return reports.some((rep) =>
      rep.parameters?.some((p) => {
        const name = (p.name || '').toLowerCase();
        return bio.aliases.some((alias) => name.includes(alias) || alias.includes(name));
      })
    );
  });

  // If no reports have specific keys, fall back to core 4 CBC biomarkers
  const listToRender = availableBiomarkers.length > 0 
    ? availableBiomarkers 
    : BIOMARKER_CATALOG.slice(0, 4);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
      {listToRender.map((bio) => {
        const isActive = activeKey === bio.key;

        // Find latest value if available
        let latestValue: string | undefined = undefined;
        let latestStatus: string | undefined = undefined;

        for (let i = reports.length - 1; i >= 0; i--) {
          const p = reports[i].parameters?.find((param) => {
            const name = (param.name || '').toLowerCase();
            return bio.aliases.some((alias) => name.includes(alias) || alias.includes(name));
          });
          if (p) {
            latestValue = typeof p.value === 'number' && p.value > 1000 
              ? p.value.toLocaleString('en-IN') 
              : String(p.value);
            latestStatus = p.status;
            break;
          }
        }

        const isCritical = latestStatus === 'Critical';
        const isAbnormal = latestStatus === 'Low' || latestStatus === 'High';

        return (
          <button
            key={bio.key}
            type="button"
            onClick={() => onSelectKey(bio.key)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-[#1E3F35] text-white shadow-sm ring-2 ring-[#1E3F35]/20'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
            }`}
          >
            <span>{bio.name.split(' (')[0]}</span>

            {/* Value preview tag */}
            {latestValue && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  isActive
                    ? isCritical
                      ? 'bg-red-500 text-white'
                      : isAbnormal
                      ? 'bg-amber-400 text-stone-900'
                      : 'bg-white/20 text-white'
                    : isCritical
                    ? 'bg-red-100 text-red-800'
                    : isAbnormal
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-200/80 text-stone-700'
                }`}
              >
                {latestValue}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
