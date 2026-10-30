import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Appointment } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Task 6.6: Appointment Lifecycle & Anti-Double-Booking Engine', () => {
  let app: Express;
  let doctorUser: any;
  let doctorProfile: any;
  let doctorToken: string;

  let patient1User: any;
  let patient1Profile: any;
  let patient1Token: string;

  let patient2User: any;
  let patient2Profile: any;
  let patient2Token: string;

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
      name: 'Dr. Priya Mehta',
      email: 'dr.priya@apollo.com',
      phone: '+919876500001',
      specialty: 'Endocrinologist',
      medicalCouncil: 'Delhi Medical Council',
      registrationNumber: 'MCI-998877',
      verificationStatus: 'verified',
    });
    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // Create patient 1
    patient1User = await User.create({
      phone: '+919876500002',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });
    patient1Profile = await PatientProfile.create({
      userId: patient1User._id,
      name: 'Rohan Verma',
      age: 52,
      gender: 'Male',
      phone: '+919876500002',
      conditions: ['Type 2 Diabetes'],
      status: 'Normal',
      connectedDoctors: [doctorProfile._id],
    });
    patient1Token = signAccessToken({
      userId: patient1User._id.toString(),
      role: 'patient',
      isVerified: true,
    });

    // Create patient 2
    patient2User = await User.create({
      phone: '+919876500003',
      role: 'patient',
      isActive: true,
      isVerified: true,
    });
    patient2Profile = await PatientProfile.create({
      userId: patient2User._id,
      name: 'Anita Desai',
      age: 44,
      gender: 'Female',
      phone: '+919876500003',
      conditions: ['Hypertension'],
      status: 'Normal',
      connectedDoctors: [doctorProfile._id],
    });
    patient2Token = signAccessToken({
      userId: patient2User._id.toString(),
      role: 'patient',
      isVerified: true,
    });

    // Create active connections
    await Connection.create({
      doctorId: doctorProfile._id,
      patientId: patient1Profile._id,
      status: 'active',
      initiatedBy: 'patient',
    });
    await Connection.create({
      doctorId: doctorProfile._id,
      patientId: patient2Profile._id,
      status: 'active',
      initiatedBy: 'patient',
    });
  });

  it('should allow patient to request an appointment matching frontend Appointment interface', async () => {
    const res = await request(app)
      .post('/api/v1/appointments/request')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({
        doctorId: doctorProfile._id.toString(),
        reason: 'CBC report discussion and HbA1c trajectory review',
        date: 'Fri, 23 Oct 2026',
        time: '12:15 PM',
        type: 'In-person',
        notes: 'Discuss platelet count result and repeat test timing',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const apt = res.body.data;
    expect(apt.patientId).toBe(patient1Profile._id.toString());
    expect(apt.patientName).toBe('Rohan Verma');
    expect(apt.patientRsId).toBe(patient1Profile.rsId);
    expect(apt.doctorName).toBe('Dr. Priya Mehta');
    expect(apt.reason).toBe('CBC report discussion and HbA1c trajectory review');
    expect(apt.date).toBe('Fri, 23 Oct 2026');
    expect(apt.time).toBe('12:15 PM');
    expect(apt.type).toBe('In-person');
    expect(apt.status).toBe('Pending');
    expect(apt.requestedAt).toMatch(/^Sent today/);
    expect(apt.notes).toBe('Discuss platelet count result and repeat test timing');
  });

  it('should allow doctor to confirm appointment and prevent patient from confirming directly', async () => {
    // 1. Create pending appointment
    const apt = await Appointment.create({
      patientId: patient1Profile._id,
      patientName: patient1Profile.name,
      patientRsId: patient1Profile.rsId,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      reason: 'Regular consultation',
      date: '2026-10-25',
      slotDate: '2026-10-25',
      time: '10:00 AM',
      type: 'Video call',
      status: 'Pending',
    });

    // 2. Patient cannot confirm (403 Forbidden)
    const patRes = await request(app)
      .put(`/api/v1/appointments/${apt._id}/status`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ status: 'Confirmed' });
    expect(patRes.status).toBe(403);

    // 3. Doctor confirms (200 OK)
    const docRes = await request(app)
      .put(`/api/v1/appointments/${apt._id}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'Confirmed', notes: 'Confirmed video link sent' });

    expect(docRes.status).toBe(200);
    expect(docRes.body.data.status).toBe('Confirmed');
    expect(docRes.body.data.notes).toBe('Confirmed video link sent');
  });

  it('should prevent double-booking: reject second confirmed appointment for same doctor and slot', async () => {
    // 1. Confirmed appointment for Patient 1 on 2026-10-25 at 11:00 AM
    await Appointment.create({
      patientId: patient1Profile._id,
      patientName: patient1Profile.name,
      patientRsId: patient1Profile.rsId,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      reason: 'First appointment',
      date: '2026-10-25',
      slotDate: '2026-10-25',
      time: '11:00 AM',
      type: 'In-person',
      status: 'Confirmed',
    });

    // 2. Pending appointment for Patient 2 on same date and time
    const apt2 = await Appointment.create({
      patientId: patient2Profile._id,
      patientName: patient2Profile.name,
      patientRsId: patient2Profile.rsId,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      reason: 'Second conflicting appointment',
      date: '2026-10-25',
      slotDate: '2026-10-25',
      time: '11:00 AM',
      type: 'In-person',
      status: 'Pending',
    });

    // 3. Attempting to confirm apt2 must be rejected with 409 Conflict
    const conflictRes = await request(app)
      .put(`/api/v1/appointments/${apt2._id}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'Confirmed' });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.message).toMatch(/conflict|already (has a confirmed|booked)/i);

    // 4. Also attempting to directly request a Confirmed appointment on the same slot must fail
    const directRes = await request(app)
      .post('/api/v1/appointments/request')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: patient2Profile._id.toString(),
        reason: 'Direct confirmed booking collision',
        date: '2026-10-25',
        time: '11:00 AM',
        status: 'Confirmed',
      });

    expect(directRes.status).toBe(409);
  });

  it('should allow patient to cancel their own appointment', async () => {
    const apt = await Appointment.create({
      patientId: patient1Profile._id,
      patientName: patient1Profile.name,
      patientRsId: patient1Profile.rsId,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      reason: 'Consultation',
      date: '2026-10-26',
      slotDate: '2026-10-26',
      time: '02:00 PM',
      type: 'In-person',
      status: 'Pending',
    });

    const res = await request(app)
      .put(`/api/v1/appointments/${apt._id}/status`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Cancelled');
  });
});
