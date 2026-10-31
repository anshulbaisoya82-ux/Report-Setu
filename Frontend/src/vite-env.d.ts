/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  /** "true" runs the app on synthetic in-browser data (no backend needed). */
  readonly VITE_DEMO_MODE?: string;
  /** Medicine-name suggestion service (defaults to NLM RxTerms). */
  readonly VITE_MEDICINE_SEARCH_URL?: string;
  /** "off" disables medicine-name suggestions. */
  readonly VITE_MEDICINE_SEARCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
