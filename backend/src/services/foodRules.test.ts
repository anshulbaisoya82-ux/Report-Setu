import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories', () => ({
  DoctorProfile: { findOne: vi.fn() },
  PatientProfile: { findById: vi.fn(), findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  Connection: { findOne: vi.fn() },
}));

import { Connection, DoctorProfile, PatientProfile } from '../repositories';
import { getOwnFoodRules, readStoredRules, setPatientFoodRules } from './foodRulesService';
import { toLabelReading, readFoodLabel } from './foodLabelReader';

const valid = { limits: { sugar: 5, salt: 1.5, saturatedFat: null }, allergies: ['Peanut', 'peanut', 'Milk'], avoid: ['Palm oil'], note: 'Small portions' };

beforeEach(() => {
  vi.mocked(DoctorProfile.findOne).mockResolvedValue({ _id: 'doc1', name: 'Dr. Priya Mehta' } as any);
  vi.mocked(PatientProfile.findById).mockResolvedValue({ _id: 'pat1' } as any);
  vi.mocked(Connection.findOne).mockResolvedValue({ _id: 'c1' } as any);
  vi.mocked(PatientProfile.findByIdAndUpdate).mockResolvedValue({} as any);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('food rules (doctor sets, patient reads)', () => {
  it('saves validated rules with who set them, removing duplicate items', async () => {
    const rules = await setPatientFoodRules('doctor-user', 'pat1', valid);
    expect(rules.allergies).toEqual(['Peanut', 'Milk']);
    expect(rules.limits).toEqual({ sugar: 5, salt: 1.5, saturatedFat: null });
    expect(rules.updatedBy).toBe('Dr. Priya Mehta');
    expect(PatientProfile.findByIdAndUpdate).toHaveBeenCalledWith('pat1', { foodRules: rules });
  });

  it('refuses a doctor without an active connection', async () => {
    vi.mocked(Connection.findOne).mockResolvedValue(null as any);
    await expect(setPatientFoodRules('doctor-user', 'pat1', valid)).rejects.toMatchObject({ statusCode: 403 });
    expect(PatientProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects invalid input (negative limit, 1-letter item)', async () => {
    await expect(setPatientFoodRules('d', 'pat1', { ...valid, limits: { sugar: -1, salt: null, saturatedFat: null } })).rejects.toMatchObject({ statusCode: 422 });
    await expect(setPatientFoodRules('d', 'pat1', { ...valid, allergies: ['x'] })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('patient gets null when no rules were set, and stored rules otherwise', async () => {
    vi.mocked(PatientProfile.findOne).mockResolvedValue({ _id: 'pat1', foodRules: null, conditions: ['Type 2 Diabetes', ' '] } as any);
    expect(await getOwnFoodRules('patient-user')).toEqual({ rules: null, conditions: ['Type 2 Diabetes'] });
    vi.mocked(PatientProfile.findOne).mockResolvedValue({ _id: 'pat1', foodRules: { ...valid, updatedAt: '2026-11-01', updatedBy: 'Dr. X' } } as any);
    const own = await getOwnFoodRules('patient-user');
    expect(own.rules?.updatedBy).toBe('Dr. X');
    expect(own.conditions).toEqual([]);
    expect(readStoredRules({ junk: true })).toBeNull();
    expect(readStoredRules('nope')).toBeNull();
  });
});

describe('food label reading (transcription only)', () => {
  it('keeps per-100 g values and derives salt from sodium when salt is missing', () => {
    const r = toLabelReading({ ingredientsText: ' Sugar, wheat flour ', nutrition: { basis: 'per100g', sugars_g: 22, sodium_mg: 400, salt_g: null, saturatedFat_g: '3.5' } });
    expect(r.ingredientsText).toBe('Sugar, wheat flour');
    expect(r.per100g).toEqual({ sugars: 22, salt: 1, sodium: 400, saturatedFat: 3.5 });
    expect(r.convertedFromServing).toBe(false);
  });

  it('converts per-serving values using the serving size, or leaves them empty with a warning', () => {
    const conv = toLabelReading({ ingredientsText: 'x', nutrition: { basis: 'perServing', servingSizeG: 25, sugars_g: 5 } });
    expect(conv.per100g.sugars).toBe(20);
    expect(conv.convertedFromServing).toBe(true);
    const none = toLabelReading({ ingredientsText: 'x', nutrition: { basis: 'perServing', servingSizeG: null, sugars_g: 5 } });
    expect(none.per100g.sugars).toBeNull();
    expect(none.warnings.length).toBe(1);
  });

  it('says photo reading is not set up when there is no API key (no made-up text)', async () => {
    await expect(readFoodLabel(Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('reads the model JSON when the API answers', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const answer = { ingredientsText: 'Groundnut, salt', nutrition: { basis: 'per100g', salt_g: 1.2 }, unreadable: [] };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }))));
    const r = await readFoodLabel(Buffer.from('x'), 'image/jpeg');
    expect(r.ingredientsText).toBe('Groundnut, salt');
    expect(r.per100g.salt).toBe(1.2);
  });
});
