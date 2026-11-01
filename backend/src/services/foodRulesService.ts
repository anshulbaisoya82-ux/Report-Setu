import { z } from 'zod';
import { Connection, DoctorProfile, PatientProfile } from '../repositories';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

/**
 * Food rules a doctor sets for one patient. The app checks packaged-food labels against
 * these rules; it never decides on its own what a patient may eat.
 * Limits are grams per 100 g of the food, exactly as the doctor enters them.
 */
const term = z.string().trim().min(2, 'Each item needs at least 2 letters').max(40);
const limit = z.number().min(0).max(100).nullable();

export const foodRulesInputSchema = z.object({
  limits: z.object({
    sugar: limit.default(null),
    salt: limit.default(null),
    saturatedFat: limit.default(null),
  }),
  allergies: z.array(term).max(20).default([]),
  avoid: z.array(term).max(30).default([]),
  note: z.string().trim().max(300).default(''),
});

export type FoodRulesInput = z.infer<typeof foodRulesInputSchema>;

export interface FoodRules extends FoodRulesInput {
  updatedAt: string;
  updatedBy: string;
}

const dedupe = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Returns stored rules in a clean shape, or null when none were set. */
export function readStoredRules(raw: unknown): FoodRules | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = foodRulesInputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = raw as Partial<FoodRules>;
  return { ...parsed.data, updatedAt: String(r.updatedAt || ''), updatedBy: String(r.updatedBy || '') };
}

async function doctorWithConnection(doctorUserId: string, patientId: string) {
  const doctor = await DoctorProfile.findOne({ userId: doctorUserId });
  if (!doctor) throw new ForbiddenError('Only registered doctors can manage food rules');
  const patient = await PatientProfile.findById(patientId);
  if (!patient) throw new NotFoundError('Patient profile not found');
  const connection = await Connection.findOne({ doctorId: doctor._id, patientId: patient._id, status: 'active' });
  if (!connection) throw new ForbiddenError('Active connection with patient is required');
  return { doctor, patient };
}

const conditionsOf = (patient: any): string[] =>
  Array.isArray(patient?.conditions) ? patient.conditions.filter((c: unknown) => typeof c === 'string' && c.trim()).map((c: string) => c.trim()) : [];

/** Patient: their doctor's food rules plus the conditions recorded in their profile. */
export async function getOwnFoodRules(patientUserId: string): Promise<{ rules: FoodRules | null; conditions: string[] }> {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) throw new NotFoundError('Patient profile not found');
  return { rules: readStoredRules((patient as any).foodRules), conditions: conditionsOf(patient) };
}

export async function getPatientFoodRules(doctorUserId: string, patientId: string): Promise<{ rules: FoodRules | null; conditions: string[] }> {
  const { patient } = await doctorWithConnection(doctorUserId, patientId);
  return { rules: readStoredRules((patient as any).foodRules), conditions: conditionsOf(patient) };
}

export async function setPatientFoodRules(doctorUserId: string, patientId: string, body: unknown): Promise<FoodRules> {
  const parsed = foodRulesInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Food rules are not valid', parsed.error.flatten());
  }
  const { doctor, patient } = await doctorWithConnection(doctorUserId, patientId);
  const rules: FoodRules = {
    ...parsed.data,
    allergies: dedupe(parsed.data.allergies),
    avoid: dedupe(parsed.data.avoid),
    updatedAt: new Date().toISOString(),
    updatedBy: (doctor as any).name || 'Your doctor',
  };
  await PatientProfile.findByIdAndUpdate(patient._id, { foodRules: rules });
  return rules;
}
