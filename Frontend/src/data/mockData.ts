/**
 * Deprecated: Mock data removed in favor of live MongoDB REST endpoints.
 * All clinical data (patients, lab reports, appointments, medication schedules)
 * are now retrieved directly from the backend API.
 */
import {
  Patient,
  LabReport,
  MedicineScheduleItem,
  Prescription,
  Appointment,
  PatientQuestionThread,
} from '../types';

export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_REPORTS: LabReport[] = [];
export const INITIAL_MEDICINE_SCHEDULE: MedicineScheduleItem[] = [];
export const INITIAL_PRESCRIPTIONS: Prescription[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
export const INITIAL_QUESTION_THREADS: PatientQuestionThread[] = [];
