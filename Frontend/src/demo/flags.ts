/** True only in demo builds (VITE_DEMO_MODE=true). Kept tiny so production bundles don't pull in demo data. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
