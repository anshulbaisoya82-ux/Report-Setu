import React from 'react';
import { FlaskConical } from 'lucide-react';

/** Always-visible marker so nobody mistakes the demo for real patient data. */
export const DemoBadge: React.FC = () => (
  <div className="fixed z-[90] right-3 top-[62px] sm:top-auto sm:bottom-4 sm:right-4 lg:bottom-auto lg:right-auto lg:top-0 lg:left-[calc(50%+128px)] lg:-translate-x-1/2 pointer-events-none">
    <div className="flex items-center gap-1.5 rounded-full lg:rounded-t-none bg-amberalert-100 border border-amberalert-200 px-3 py-1 text-[11px] font-semibold text-amberalert-700 shadow-card">
      <FlaskConical className="w-3.5 h-3.5" />
      Demo · synthetic data
    </div>
  </div>
);
