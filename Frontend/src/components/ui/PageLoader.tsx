import React from 'react';

/** Skeleton shown while a page's code is loading. */
export const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] w-full p-6 sm:p-10" role="status" aria-live="polite">
    <span className="sr-only">Loading…</span>
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-sage-200" />
      <div className="h-4 w-80 max-w-full rounded bg-sage-200/70" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/70" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/70" />
    </div>
  </div>
);
