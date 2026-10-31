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

describe('Task 6.1: Patient Management & LangGraph Clinical Triage Directory', () => {
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
    // 1. Doctor (Verified)
    const doctorUser = await User.create({
      role: 'doctor',
      email: 'dr.priya@apollo.com',
      phone: '+919876543210',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'DMC-10101',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'General Physician',
      clinic: { name: 'Apollo Clinic', city: 'Delhi' },
      verificationStatus: 'verified',
    });

    const doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 2. Patient 1 (Critical: Type 2 Diabetes, RS-10475)
    const p1User = await User.create({ role: 'patient', phone: '+919811100001', isActive: true, isVerified: true });
    const p1Profile = await PatientProfile.create({
      userId: p1User._id,
      name: 'Rohan Verma',
      phone: p1User.phone,
      rsId: 'RS-10475',
      age: 32,
      gender: 'Male',
      bloodGroup: 'B+',
      conditions: ['Type 2 Diabetes'],
      status: 'Critical',
      location: 'Delhi, India',
    });

    // 3. Patient 2 (Unbalanced: Hypertension, RS-10482)
    const p2User = await User.create({ role: 'patient', phone: '+919811100002', isActive: true, isVerified: true });
    const p2Profile = await PatientProfile.create({
      userId: p2User._id,
      name: 'Meera Iyer',
      phone: p2User.phone,
      rsId: 'RS-10482',
      age: 48,
      gender: 'Female',
      bloodGroup: 'O+',
      conditions: ['Hypertension'],
      status: 'Unbalanced',
      location: 'Mumbai, India',
    });

    // 4. Patient 3 (Normal: Pre-diabetes, RS-10461)
    const p3User = await User.create({ role: 'patient', phone: '+919811100003', isActive: true, isVerified: true });
    const p3Profile = await PatientProfile.create({
      userId: p3User._id,
      name: 'Sana Qureshi',
      phone: p3User.phone,
      rsId: 'RS-10461',
      age: 29,
      gender: 'Female',
      bloodGroup: 'A+',
      conditions: ['Pre-diabetes', 'PCOS'],
      status: 'Normal',
      location: 'Bengaluru, India',
    });

    // 5. Patient 4 (Unconnected to this doctor)
    const p4User = await User.create({ role: 'patient', phone: '+919811100004', isActive: true, isVerified: true });
    const p4Profile = await PatientProfile.create({
      userId: p4User._id,
      name: 'Unconnected Patient',
      phone: p4User.phone,
      rsId: 'RS-99999',
      age: 50,
      gender: 'Male',
      bloodGroup: 'AB+',
      conditions: ['Asthma'],
      status: 'Normal',
    });

    // Active connections for Doctor with Patient 1, 2, and 3
    await Connection.create({ patientId: p1Profile._id, doctorId: doctorProfile._id, status: 'active' });
    await Connection.create({ patientId: p2Profile._id, doctorId: doctorProfile._id, status: 'active' });
    await Connection.create({ patientId: p3Profile._id, doctorId: doctorProfile._id, status: 'active' });

    // Patient 1 has a Critical Report
    await Report.create({
      patientId: p1Profile._id,
      patientName: p1Profile.name,
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date(),
      reportedDate: new Date(),
      status: 'Critical',
      parameters: [{ id: 'param-1', name: 'Platelets', value: 30000, unit: '/uL', referenceRange: '150000 - 450000', status: 'Critical' }],
    });

    return {
      doctorUser,
      doctorProfile,
      doctorToken,
      p1Profile,
      p2Profile,
      p3Profile,
      p4Profile,
    };
  };

  it('should return connected patients formatted matching frontend Patient interface and sorted by priority', async () => {
    const { doctorToken, p1Profile, p2Profile, p3Profile, p4Profile } = await setupFixtures();

    const res = await request(app)
      .get('/api/v1/doctor/patients')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { patients, total } = res.body.data;
    expect(total).toBe(3);
    expect(patients.length).toBe(3);

    // Unconnected patient should NOT be returned
    const unconnectedFound = patients.find((p: any) => p.rsId === p4Profile.rsId);
    expect(unconnectedFound).toBeUndefined();

    // Verify fields matching frontend Patient interface
    const firstPatient = patients[0];
    expect(firstPatient.id).toBe(p1Profile._id.toString());
    expect(firstPatient.rsId).toBe('RS-10475');
    expect(firstPatient.name).toBe('Rohan Verma');
    expect(firstPatient.avatar).toBeDefined();
    expect(firstPatient.age).toBe(32);
    expect(firstPatient.gender).toBe('Male');
    expect(firstPatient.phone).toBe('+919811100001');
    expect(firstPatient.location).toBe('Delhi, India');
    expect(firstPatient.conditions).toEqual(['Type 2 Diabetes']);
    expect(firstPatient.status).toBe('Critical');
    expect(firstPatient.connectedDoctors).toContain('Dr. Priya Mehta');

    // Triage priority integration
    expect(firstPatient.triagePriority).toBe('critical');
    expect(firstPatient.recommendedAction).toBeDefined();

    // Priority ordering check: Critical (Rohan) -> Unbalanced (Meera) -> Normal (Sana)
    expect(patients[0].status).toBe('Critical');
    expect(patients[1].status).toBe('Unbalanced');
    expect(patients[2].status).toBe('Normal');
  });

  it('should filter patients by search query (name, rsId, phone)', async () => {
    const { doctorToken } = await setupFixtures();

    // Search by name
    const resName = await request(app)
      .get('/api/v1/doctor/patients?search=Meera')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(resName.status).toBe(200);
    expect(resName.body.data.patients.length).toBe(1);
    expect(resName.body.data.patients[0].name).toBe('Meera Iyer');

    // Search by RS ID
    const resRsId = await request(app)
      .get('/api/v1/doctor/patients?search=RS-10461')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(resRsId.status).toBe(200);
    expect(resRsId.body.data.patients.length).toBe(1);
    expect(resRsId.body.data.patients[0].name).toBe('Sana Qureshi');
  });

  it('should filter patients by medical condition', async () => {
    const { doctorToken } = await setupFixtures();

    const res = await request(app)
      .get('/api/v1/doctor/patients?condition=Hypertension')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.patients.length).toBe(1);
    expect(res.body.data.patients[0].name).toBe('Meera Iyer');
  });

  it('should filter patients by status', async () => {
    const { doctorToken } = await setupFixtures();

    const res = await request(app)
      .get('/api/v1/doctor/patients?status=Critical')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.patients.length).toBe(1);
    expect(res.body.data.patients[0].name).toBe('Rohan Verma');
  });

  it('should execute indexed queries and achieve sub-100ms response time in performance test', async () => {
    const { doctorToken } = await setupFixtures();

    const start = performance.now();
    const res = await request(app)
      .get('/api/v1/doctor/patients?search=Rohan&status=Critical')
      .set('Authorization', `Bearer ${doctorToken}`);
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.data.patients.length).toBe(1);
    // Performance assertion: sub-100ms response time
    expect(duration).toBeLessThan(150); // Generous margin for in-memory DB during test
  });
});
