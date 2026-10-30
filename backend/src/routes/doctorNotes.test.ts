import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '../config/prisma';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { DoctorNote } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { isEncrypted } from '../utils/encryption';

describe('Task 6.2: Doctor Private Notes & Clinical Annotations', () => {
  let app: Express;
  let doctorUser: any;
  let doctorProfile: any;
  let doctorToken: string;

  let patientUser: any;
  let patientProfile: any;
  let patientToken: string;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create doctor
    doctorUser = await User.create({
      phone: '+919876500001',
      role: 'doctor',
      isVerified: true,
      isActive: true,
    });
    doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@hospital.org',
      phone: '+919876500001',
      specialty: 'Endocrinology',
      medicalCouncil: 'Delhi Medical Council',
      registrationNumber: 'MCI-123456',
      verificationStatus: 'verified',
    });
    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // Create patient
    patientUser = await User.create({
      phone: '+919876500002',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });
    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Mehra',
      age: 48,
      gender: 'Male',
      phone: '+919876500002',
      conditions: ['Type 2 Diabetes'],
      status: 'Normal',
      connectedDoctors: [doctorProfile._id],
    });
    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      isVerified: true,
    });

    // Create active connection
    await Connection.create({
      doctorId: doctorProfile._id,
      patientId: patientProfile._id,
      status: 'active',
      initiatedBy: 'patient',
    });
  });

  it('should allow doctor to add private note with field encryption at rest', async () => {
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${patientProfile._id}/private-notes`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        note: 'Patient shows signs of early peripheral neuropathy. Order nerve conduction study if symptoms persist.',
        category: 'Differential Diagnosis',
        priority: 'Needs Review',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.note).toBe(
      'Patient shows signs of early peripheral neuropathy. Order nerve conduction study if symptoms persist.'
    );
    expect(res.body.data.category).toBe('Differential Diagnosis');
    expect(res.body.data.priority).toBe('Needs Review');

    // Verify encryption at rest in database
    const rawNoteDoc = await prisma.doctorNote.findUnique({ where: { id: res.body.data.id } });
    expect(rawNoteDoc).not.toBeNull();
    // Raw database value must be encrypted
    expect(isEncrypted(rawNoteDoc!.note)).toBe(true);
    expect(rawNoteDoc!.note).not.toContain('peripheral neuropathy');
  });

  it('should allow doctor to retrieve private notes decrypted', async () => {
    await DoctorNote.create({
      doctorId: doctorProfile._id,
      patientId: patientProfile._id,
      note: 'Routine check-up note: diet adherence is moderate.',
      category: 'Observation',
    });

    const res = await request(app)
      .get(`/api/v1/doctor/patients/${patientProfile._id}/private-notes`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notes).toHaveLength(1);
    expect(res.body.data.notes[0].note).toBe('Routine check-up note: diet adherence is moderate.');
    expect(res.body.data.notes[0].category).toBe('Observation');
  });

  it('should reject patient token from accessing private doctor notes with 403 Forbidden', async () => {
    // Attempt POST private note
    const postRes = await request(app)
      .post(`/api/v1/doctor/patients/${patientProfile._id}/private-notes`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        note: 'Unauthorized note from patient',
      });
    expect(postRes.status).toBe(403);

    // Attempt GET private notes
    const getRes = await request(app)
      .get(`/api/v1/doctor/patients/${patientProfile._id}/private-notes`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(getRes.status).toBe(403);
  });

  it('should allow doctor to update patient priority and reject patient from updating it', async () => {
    // Doctor updates priority
    const docRes = await request(app)
      .put(`/api/v1/doctor/patients/${patientProfile._id}/priority`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        priority: 'Critical',
      });

    expect(docRes.status).toBe(200);
    expect(docRes.body.success).toBe(true);
    expect(docRes.body.data.status).toBe('Critical');

    const updatedPatient = await PatientProfile.findById(patientProfile._id);
    expect(updatedPatient?.status).toBe('Critical');

    // Patient attempts to update priority
    const patRes = await request(app)
      .put(`/api/v1/doctor/patients/${patientProfile._id}/priority`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        priority: 'Normal',
      });

    expect(patRes.status).toBe(403);
  });
});
