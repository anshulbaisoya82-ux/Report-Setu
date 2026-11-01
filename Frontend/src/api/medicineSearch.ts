/**
 * Medicine-name suggestions while the doctor types in the prescription form.
 *
 * 1. Primary: our backend, GET /prescriptions/medicine-suggestions?q=&limit=&offset=
 *    It searches the bundled Indian medicine catalogue (~250,000 brands with composition,
 *    pack and maker), or the ML service's /drug/suggest if configured that way.
 * 2. Fallback, only if the backend is unreachable: NLM Clinical Tables RxTerms
 *    (U.S. generic names only). Turn it off with VITE_MEDICINE_SEARCH_FALLBACK=off.
 *
 * Only the typed text is sent, never patient data. Suggestions are optional: when nothing
 * answers the list is empty and the doctor keeps typing. VITE_MEDICINE_SEARCH=off disables all.
 */
import { apiFetch } from './client';

export type SuggestionSource = 'Indian medicine database' | 'ReportSetu ML service' | 'NLM RxTerms' | 'built-in demo list';

export interface MedicineOption {
  name: string;
  composition?: string;
  pack?: string;
  manufacturer?: string;
  discontinued?: boolean;
  /** Matched through the brand name, or through the ingredients. */
  match?: 'name' | 'composition';
}

export interface MedicineSuggestions {
  items: MedicineOption[];
  total: number;
  hasMore: boolean;
  source: SuggestionSource | null;
}

export const PAGE_SIZE = 30;

const DISABLED = import.meta.env.VITE_MEDICINE_SEARCH === 'off';
const FALLBACK_OFF = import.meta.env.VITE_MEDICINE_SEARCH_FALLBACK === 'off';
const NLM_ENDPOINT = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search';

const EMPTY: MedicineSuggestions = { items: [], total: 0, hasMore: false, source: null };
const cache = new Map<string, MedicineSuggestions>();

const tidy = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

const SOURCE_LABEL: Record<string, SuggestionSource> = {
  'india-medicine-db': 'Indian medicine database',
  'ml-service': 'ReportSetu ML service',
  demo: 'built-in demo list',
};

async function fromBackend(q: string, offset: number, signal?: AbortSignal): Promise<MedicineSuggestions> {
  const res = await apiFetch<any>(
    `/prescriptions/medicine-suggestions?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`,
    { signal }
  );
  const raw: any[] = Array.isArray(res?.items) && res.items.length ? res.items : (res?.suggestions || []).map((name: string) => ({ name }));
  const items: MedicineOption[] = raw
    .map((r) => ({
      name: tidy(r?.name),
      composition: tidy(r?.composition) || undefined,
      pack: tidy(r?.pack) || undefined,
      manufacturer: tidy(r?.manufacturer) || undefined,
      discontinued: r?.discontinued === true,
      match: r?.match === 'composition' ? 'composition' : 'name',
    } as MedicineOption))
    .filter((r) => r.name);
  const total = Number.isFinite(res?.total) ? Number(res.total) : offset + items.length;
  return { items, total, hasMore: offset + items.length < total, source: SOURCE_LABEL[res?.source] || 'Indian medicine database' };
}

async function fromNlm(q: string, signal?: AbortSignal): Promise<MedicineSuggestions> {
  const url = `${NLM_ENDPOINT}?terms=${encodeURIComponent(q)}&ef=STRENGTHS_AND_FORMS&maxList=${PAGE_SIZE}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxTerms ${res.status}`);
  // Response: [total, names[], { STRENGTHS_AND_FORMS: string[][] }, display[][]]
  const [, names = [], extra = {}] = (await res.json()) as [number, string[], { STRENGTHS_AND_FORMS?: string[][] }];
  const strengths = extra.STRENGTHS_AND_FORMS || [];
  const out: string[] = [];
  names.forEach((raw, i) => {
    const name = raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const forms = (strengths[i] || []).map((s) => s.trim()).filter(Boolean);
    if (forms.length === 0) out.push(name);
    forms.slice(0, 3).forEach((f) => out.push(`${name} ${f}`));
  });
  const items = [...new Set(out)].map((name) => ({ name, match: 'name' as const }));
  return { items, total: items.length, hasMore: false, source: 'NLM RxTerms' };
}

/**
 * One page of suggestions (PAGE_SIZE at a time; pass offset for "show more").
 * Never throws: on failure it resolves to an empty list.
 */
export async function searchMedicines(query: string, opts: { offset?: number; signal?: AbortSignal } = {}): Promise<MedicineSuggestions> {
  const q = query.trim().toLowerCase();
  const offset = opts.offset ?? 0;
  if (DISABLED || q.length < 2) return EMPTY;
  const key = `${q}|${offset}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let result: MedicineSuggestions | null = null;
  try {
    result = await fromBackend(q, offset, opts.signal);
  } catch {
    if (opts.signal?.aborted) return EMPTY;
    if (!FALLBACK_OFF && offset === 0) {
      try {
        result = await fromNlm(q, opts.signal);
      } catch {
        result = null;
      }
    }
  }
  if (!result) return EMPTY;
  if (cache.size > 200) cache.clear();
  cache.set(key, result);
  return result;
}
