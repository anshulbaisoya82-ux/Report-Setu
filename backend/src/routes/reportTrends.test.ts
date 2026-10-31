import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Report } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Task 5.6: Historical Trends, Unusual Changes & HbA1c Forecasting API', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  const setupFixtures = async () => {
    // 1. Doctor (Connected to Patient 1)
    const doctorUser = await User.create({
      role: 'doctor',
      email: 'dr.mehta@apollo.com',
      phone: '+919876543210',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'DMC-12345',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Internal Medicine',
      clinic: { name: 'Apollo Clinic', city: 'New Delhi' },
      verificationStatus: 'verified',
    });

    const doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 2. Doctor 2 (Unconnected)
    const otherDocUser = await User.create({
      role: 'doctor',
      email: 'dr.other@clinic.com',
      phone: '+919876543299',
      isActive: true,
      isVerified: true,
    });

    const otherDocProfile = await DoctorProfile.create({
      userId: otherDocUser._id,
      name: 'Dr. Other',
      email: otherDocUser.email,
      phone: otherDocUser.phone,
      registrationNumber: 'DMC-99999',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'General',
      verificationStatus: 'verified',
    });

    const otherDoctorToken = signAccessToken({
      userId: otherDocUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 3. Patient 1
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919811111111',
      isActive: true,
      isVerified: true,
    });

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      phone: patientUser.phone,
      rsId: 'RS-10475',
      age: 32,
      gender: 'Male',
      bloodGroup: 'B+',
    });

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    // 4. Patient 2 (Unrelated)
    const otherPatientUser = await User.create({
      role: 'patient',
      phone: '+919822222222',
      isActive: true,
      isVerified: true,
    });

    const otherPatientProfile = await PatientProfile.create({
      userId: otherPatientUser._id,
      name: 'Other Patient',
      phone: otherPatientUser.phone,
      rsId: 'RS-99999',
      age: 40,
      gender: 'Female',
      bloodGroup: 'A+',
    });

    const otherPatientToken = signAccessToken({
      userId: otherPatientUser._id.toString(),
      role: 'patient',
    });

    // Active connection between Doctor 1 and Patient 1
    await Connection.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      status: 'active',
      connectedAt: new Date(),
    });

    return {
      doctorToken,
      otherDoctorToken,
      patientToken,
      otherPatientToken,
      patientProfile,
      otherPatientProfile,
    };
  };

  it('should return longitudinal trend time series matching frontend historicalTrends structure', async () => {
    const { patientToken, patientProfile } = await setupFixtures();

    // Create 3 historical reports for Patient 1 over time
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2025-10-03'),
      reportedDate: new Date('2025-10-04'),
      status: 'Normal',
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 12.1, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Low' },
        { id: 'p-2', name: 'Platelet Count', value: 210000, unit: '/uL', referenceRange: '150000 - 450000', status: 'Normal' },
        { id: 'p-3', name: 'Total WBC Count', value: 8200, unit: '/uL', referenceRange: '4000 - 11000', status: 'Normal' },
        { id: 'p-4', name: 'RBC Count', value: 4.3, unit: 'mill/uL', referenceRange: '4.5 - 5.9', status: 'Low' },
      ],
    });

    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2026-03-12'),
      reportedDate: new Date('2026-03-13'),
      status: 'Normal',
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 12.4, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Low' },
        { id: 'p-2', name: 'Platelet Count', value: 180000, unit: '/uL', referenceRange: '150000 - 450000', status: 'Normal' },
        { id: 'p-3', name: 'Total WBC Count', value: 8600, unit: '/uL', referenceRange: '4000 - 11000', status: 'Normal' },
        { id: 'p-4', name: 'RBC Count', value: 4.4, unit: 'mill/uL', referenceRange: '4.5 - 5.9', status: 'Low' },
      ],
    });

    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2026-10-22'),
      reportedDate: new Date('2026-10-23'),
      status: 'Unbalanced',
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 13.2, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
        { id: 'p-2', name: 'Platelet Count', value: 110000, unit: '/uL', referenceRange: '150000 - 450000', status: 'Low' },
        { id: 'p-3', name: 'Total WBC Count', value: 9800, unit: '/uL', referenceRange: '4000 - 11000', status: 'Normal' },
        { id: 'p-4', name: 'RBC Count', value: 4.2, unit: 'mill/uL', referenceRange: '4.5 - 5.9', status: 'Low' },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/reports/patient/${patientProfile._id}/trends`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { historicalTrends, trajectories } = res.body.data;
    expect(historicalTrends).toBeDefined();
    expect(historicalTrends.length).toBe(3);

    // Each point should have date and numeric parameters matching frontend contract
    const latestPoint = historicalTrends[2];
    expect(latestPoint.date).toBeDefined();
    expect(latestPoint.hemoglobin).toBe(13.2);
    expect(latestPoint.platelets).toBe(110000);
    expect(latestPoint.wbc).toBe(9800);
    expect(latestPoint.rbc).toBe(4.2);

    // Verify trajectories with deltas
    expect(trajectories.hemoglobin).toBeDefined();
    expect(trajectories.hemoglobin.trendDirection).toBe('up'); // 12.4 -> 13.2 is up
    expect(trajectories.hemoglobin.delta).toBe(0.8);
    expect(trajectories.hemoglobin.percentageChange).toBeGreaterThan(0);

    expect(trajectories.platelets).toBeDefined();
    expect(trajectories.platelets.trendDirection).toBe('down'); // 180000 -> 110000 is down
    expect(trajectories.platelets.delta).toBe(-70000);

    // Verify acute unusual change flag for platelets (drop of 70,000 / > 30%)
    expect(trajectories.platelets.unusualChange).toBe(true);
    expect(trajectories.platelets.unusualChangeReason).toMatch(/platelet drop/i);
  });

  it('should return 90-day trajectory forecast for HbA1c with confidence intervals', async () => {
    const { doctorToken, patientProfile } = await setupFixtures();

    // Create 3 historical HbA1c reports
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'HbA1c',
      category: 'HbA1c',
      labName: 'Thyrocare',
      collectionDate: new Date('2025-06-10'),
      reportedDate: new Date('2025-06-11'),
      status: 'Normal',
      parameters: [{ id: 'h-1', name: 'HbA1c Glycated Hemoglobin', value: 5.9, unit: '%', referenceRange: '< 5.7', status: 'High' }],
    });

    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'HbA1c',
      category: 'HbA1c',
      labName: 'Thyrocare',
      collectionDate: new Date('2025-12-10'),
      reportedDate: new Date('2025-12-11'),
      status: 'Unbalanced',
      parameters: [{ id: 'h-2', name: 'HbA1c Glycated Hemoglobin', value: 6.4, unit: '%', referenceRange: '< 5.7', status: 'High' }],
    });

    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'HbA1c',
      category: 'HbA1c',
      labName: 'Thyrocare',
      collectionDate: new Date('2026-06-10'),
      reportedDate: new Date('2026-06-11'),
      status: 'Unbalanced',
      parameters: [{ id: 'h-3', name: 'HbA1c Glycated Hemoglobin', value: 7.1, unit: '%', referenceRange: '< 5.7', status: 'High' }],
    });

    const res = await request(app)
      .get(`/api/v1/reports/patient/${patientProfile._id}/trends`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    const forecast = res.body.data.forecast.hba1c;
    expect(forecast).toBeDefined();
    expect(forecast.test_code).toBe('HBA1C');
    expect(forecast.horizon_days).toBe(90);
    expect(forecast.n_points).toBe(3);
    expect(forecast.estimate).toBeDefined();
    expect(typeof forecast.estimate).toBe('number');
    expect(forecast.low).toBeDefined();
    expect(forecast.high).toBeDefined();
    expect(forecast.high).toBeGreaterThanOrEqual(forecast.low);
  });

  it('should enforce access control: block unconnected doctor (403) and unrelated patient (403)', async () => {
    const { otherDoctorToken, otherPatientToken, patientProfile } = await setupFixtures();

    // Unconnected doctor attempt
    const docRes = await request(app)
      .get(`/api/v1/reports/patient/${patientProfile._id}/trends`)
      .set('Authorization', `Bearer ${otherDoctorToken}`);

    expect(docRes.status).toBe(403);
    expect(docRes.body.error?.message).toMatch(/Active connection required/i);

    // Unrelated patient attempt
    const patRes = await request(app)
      .get(`/api/v1/reports/patient/${patientProfile._id}/trends`)
      .set('Authorization', `Bearer ${otherPatientToken}`);

    expect(patRes.status).toBe(403);
    expect(patRes.body.error?.message).toMatch(/Access denied/i);
  });
});
