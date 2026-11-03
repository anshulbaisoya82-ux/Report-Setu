import { apiFetch } from './client';
import type { FoodRules, Per100g } from '../features/foodCheck/checkLabel';

export interface LabelReading {
  ingredientsText: string;
  per100g: Per100g & { sodium?: number | null };
  convertedFromServing: boolean;
  warnings: string[];
}

export interface RulesAndConditions {
  rules: FoodRules | null;
  conditions: string[];
}

export type FoodRulesInput = Pick<FoodRules, 'limits' | 'allergies' | 'avoid' | 'note'>;

export const foodRulesApi = {
  /** Patient: rules their doctor set (or null) and the conditions in their health record. */
  getMine: async (): Promise<RulesAndConditions> => {
    const r = await apiFetch<Partial<RulesAndConditions>>('/food-rules/me');
    return { rules: r?.rules ?? null, conditions: Array.isArray(r?.conditions) ? r!.conditions! : [] };
  },

  /** Doctor: a connected patient's rules (or null) and recorded conditions. */
  getForPatient: async (patientId: string): Promise<RulesAndConditions> => {
    const r = await apiFetch<Partial<RulesAndConditions>>(`/food-rules/patient/${encodeURIComponent(patientId)}`);
    return { rules: r?.rules ?? null, conditions: Array.isArray(r?.conditions) ? r!.conditions! : [] };
  },

  /** Doctor: replace a connected patient's rules. */
  setForPatient: async (patientId: string, rules: FoodRulesInput): Promise<FoodRules> =>
    (await apiFetch<{ rules: FoodRules }>(`/food-rules/patient/${encodeURIComponent(patientId)}`, { method: 'PUT', body: JSON.stringify(rules) })).rules,

  /** Patient: read the text and numbers on a label photo. The photo is not stored. */
  readLabel: async (file: File): Promise<LabelReading> => {
    const form = new FormData();
    form.append('file', file);
    return (await apiFetch<{ reading: LabelReading }>('/food-rules/read-label', { method: 'POST', body: form })).reading;
  },
};

