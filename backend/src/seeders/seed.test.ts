import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Report } from '../utils/testModels';
import { Prescription } from '../utils/testModels';
import { Appointment } from '../utils/testModels';
import { ChatMessage } from '../utils/testModels';
import { runSeeder } from './seed';

describe('Task 11.3: Comprehensive Database Seeder (Frontend Mock Data Alignment)', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('should seed Dr. Priya Mehta, 8 patients, reports, prescriptions, appointments, and chats', async () => {
    await runSeeder();

    // 1. Verify Doctor
    const doctor = await DoctorProfile.findOne({ name: 'Dr. Priya Mehta' });
    expect(doctor).not.toBeNull();
    expect(doctor?.specialty).toBe('Internal Medicine');
    expect(doctor?.verificationStatus).toBe('verified');

    // 2. Verify 8 Patients
    const patients = await PatientProfile.find({});
    expect(patients.length).toBe(8);

    const rohan = patients.find((p) => p.name === 'Rohan Verma');
    expect(rohan).toBeDefined();
    expect(rohan?.rsId).toBe('RS-10475');
    expect(rohan?.status).toBe('Critical');

    const meera = patients.find((p) => p.name === 'Meera Iyer');
    expect(meera).toBeDefined();
    expect(meera?.rsId).toBe('RS-10482');

    // 3. Verify Reports
    const reports = await Report.find({});
    expect(reports.length).toBeGreaterThanOrEqual(2);

    const rohanCbc = reports.find((r) => r.patientName === 'Rohan Verma');
    expect(rohanCbc).toBeDefined();
    expect(rohanCbc?.reviewed).toBe(true);
    expect(rohanCbc?.doctorSummary?.doctorName).toBe('Dr. Priya Mehta');
    expect(rohanCbc?.aiOverview?.keyFindings.length).toBeGreaterThan(0);

    // 4. Verify Prescriptions
    const prescriptions = await Prescription.find({});
    expect(prescriptions.length).toBeGreaterThanOrEqual(1);

    // 5. Verify Appointments
    const appointments = await Appointment.find({});
    expect(appointments.length).toBe(2);

    // 6. Verify Chat Messages
    const chats = await ChatMessage.find({});
    expect(chats.length).toBeGreaterThanOrEqual(3);
  });

  it('should execute idempotently without duplicating documents when run multiple times', async () => {
    // Run once
    await runSeeder();
    const countFirstRun = await PatientProfile.countDocuments({});
    expect(countFirstRun).toBe(8);

    // Run again
    await runSeeder();
    const countSecondRun = await PatientProfile.countDocuments({});
    expect(countSecondRun).toBe(8);

    const doctorCount = await DoctorProfile.countDocuments({});
    expect(doctorCount).toBe(1);
  });
});
