/**
 * Medicine-name suggestions while the doctor types.
 *
 * Source: NLM Clinical Tables RxTerms API (free, no key):
 *   https://clinicaltables.nlm.nih.gov/apidoc/rxterms/v3/doc.html
 * Only the typed text is sent — never patient data. Suggestions are optional:
 * if the service is slow, offline or disabled, the doctor simply keeps typing.
 *
 * Note: RxTerms is a U.S. database, so it suggests generic names (Metformin, Atorvastatin)
 * and U.S. brands, not Indian brand names. Set VITE_MEDICINE_SEARCH_URL to swap in another
 * provider with the same response shape, or VITE_MEDICINE_SEARCH=off to turn suggestions off.
 */
import { isDemoMode } from '../demo/flags';

const ENDPOINT = import.meta.env.VITE_MEDICINE_SEARCH_URL || 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search';
const DISABLED = import.meta.env.VITE_MEDICINE_SEARCH === 'off';

// Demo builds run in a sandbox that blocks outside requests, so they use a small built-in list.
const DEMO_LIST = [
  'Metformin 500 mg Tab', 'Metformin 1000 mg Tab', 'Glimepiride 1 mg Tab', 'Glimepiride 2 mg Tab', 'Telmisartan 40 mg Tab',
  'Amlodipine 5 mg Tab', 'Atorvastatin 10 mg Tab', 'Atorvastatin 20 mg Tab', 'Rosuvastatin 10 mg Tab', 'Pantoprazole 40 mg Tab',
  'Paracetamol 500 mg Tab', 'Paracetamol 650 mg Tab', 'Amoxicillin 500 mg Cap', 'Azithromycin 500 mg Tab', 'Cetirizine 10 mg Tab',
  'Losartan 50 mg Tab', 'Metoprolol 50 mg Tab', 'Levothyroxine 50 mcg Tab', 'Vitamin D3 60,000 IU Cap', 'Folic acid 5 mg Tab',
];

const cache = new Map<string, string[]>();

/** Up to 8 suggestions like "Metformin 500 mg Tab". Resolves to [] on any failure. */
export async function searchMedicines(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (DISABLED || q.length < 2) return [];

  if (isDemoMode) return DEMO_LIST.filter((m) => m.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || m.toLowerCase().startsWith(q)).slice(0, 8);

  if (cache.has(q)) return cache.get(q)!;
  try {
    const url = `${ENDPOINT}?terms=${encodeURIComponent(q)}&ef=STRENGTHS_AND_FORMS&maxList=8`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
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
    const unique = [...new Set(out)].slice(0, 8);
    cache.set(q, unique);
    return unique;
  } catch {
    return [];
  }
}

export const medicineSearchSource = isDemoMode ? 'built-in demo list' : 'NLM RxTerms';
