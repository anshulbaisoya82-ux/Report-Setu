import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { initSocketServer, broadcastCriticalAlert } from '../services/socketService';
import { stopReminderScheduler } from '../services/reminderScheduler';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { revokeDoctorConnectionByPatient } from '../services/connectionService';

describe('Phase 7: Real-Time Engine (Socket.IO) & Clinical Events', () => {
  let httpServer: http.Server;
  let serverPort: number;

  let doctorUser: any;
  let doctorProfile: any;
  let doctorToken: string;

  let patientUser: any;
  let patientProfile: any;
  let patientToken: string;

  let strangerUser: any;
  let strangerProfile: any;
  let strangerToken: string;

  beforeAll(async () => {
    await connectTestDb();

    const app = createApp();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    stopReminderScheduler();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Doctor
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

    // 2. Patient
    patientUser = await User.create({
      phone: '+919876500002',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });
    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      age: 52,
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

    // 3. Stranger (Unconnected Doctor)
    strangerUser = await User.create({
      phone: '+919876500003',
      role: 'doctor',
      isVerified: true,
      isActive: true,
    });
    strangerProfile = await DoctorProfile.create({
      userId: strangerUser._id,
      name: 'Dr. Rahul Bose',
      email: 'dr.rahul@fortis.com',
      phone: '+919876500003',
      specialty: 'Cardiology',
      medicalCouncil: 'Delhi Medical Council',
      registrationNumber: 'MCI-554433',
      verificationStatus: 'verified',
    });
    strangerToken = signAccessToken({
      userId: strangerUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // Create active connection between Doctor and Patient
    await Connection.create({
      doctorId: doctorProfile._id,
      patientId: patientProfile._id,
      status: 'active',
      initiatedBy: 'patient',
    });
  });

  const connectClient = (token?: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });
  };

  describe('Task 7.1: Authenticated Socket.IO Server & Room Authorization', () => {
    it('should authenticate socket with valid JWT and reject invalid/missing tokens', async () => {
      // Valid connection
      const client = await connectClient(patientToken);
      expect(client.connected).toBe(true);
      client.disconnect();

      // Missing token rejected
      await expect(connectClient()).rejects.toThrow(/Authentication error/i);

      // Invalid token rejected
      await expect(connectClient('invalid.malformed.token')).rejects.toThrow(/Authentication error/i);
    });

    it('should allow patient to join their own patient room and reject unauthorized join', async () => {
      const patientClient = await connectClient(patientToken);

      // Patient joins their own room
      const ack1 = await new Promise<any>((resolve) => {
        patientClient.emit('join_room', { room: `patient:${patientProfile._id}` }, resolve);
      });
      expect(ack1.success).toBe(true);
      expect(ack1.room).toBe(`patient:${patientProfile._id}`);

      patientClient.disconnect();

      // Stranger doctor attempts to join patient's room
      const strangerClient = await connectClient(strangerToken);
      const ack2 = await new Promise<any>((resolve) => {
        strangerClient.emit('join_room', { room: `patient:${patientProfile._id}` }, resolve);
      });
      expect(ack2.success).toBe(false);
      expect(ack2.error).toMatch(/Unauthorized/i);

      strangerClient.disconnect();
    });

    it('should allow connected doctor to join patient room', async () => {
      const doctorClient = await connectClient(doctorToken);

      const ack = await new Promise<any>((resolve) => {
        doctorClient.emit('join_room', { room: `patient:${patientProfile._id}` }, resolve);
      });

      expect(ack.success).toBe(true);
      expect(ack.room).toBe(`patient:${patientProfile._id}`);

      doctorClient.disconnect();
    });
  });

  describe('Task 7.2: Real-Time Clinical Events & Revocation Kick', () => {
    it('should broadcast critical alert to patient and connected doctor rooms', async () => {
      const patientClient = await connectClient(patientToken);
      const doctorClient = await connectClient(doctorToken);

      await new Promise<any>((resolve) => {
        patientClient.emit('join_room', { room: `patient:${patientProfile._id}` }, resolve);
      });

      const patientPromise = new Promise<any>((resolve) => {
        patientClient.on('critical:alert', resolve);
      });
      const doctorPromise = new Promise<any>((resolve) => {
        doctorClient.on('critical:alert', resolve);
      });

      // Trigger critical alert broadcast
      await broadcastCriticalAlert(patientProfile._id.toString(), 'rep-123', [
        { name: 'Platelet Count', value: 25000, unit: '/µL', status: 'Critical' },
      ]);

      const [patientAlert, doctorAlert] = await Promise.all([patientPromise, doctorPromise]);

      expect(patientAlert.patientId).toBe(patientProfile._id.toString());
      expect(patientAlert.criticalParameters[0].name).toBe('Platelet Count');
      expect(doctorAlert.patientId).toBe(patientProfile._id.toString());

      patientClient.disconnect();
      doctorClient.disconnect();
    });

    it('should immediately expel doctor from patient room and notify with access:revoked upon patient revocation', async () => {
      const doctorClient = await connectClient(doctorToken);

      // Doctor joins patient room
      await new Promise<any>((resolve) => {
        doctorClient.emit('join_room', { room: `patient:${patientProfile._id}` }, resolve);
      });

      const revokePromise = new Promise<any>((resolve) => {
        doctorClient.on('access:revoked', resolve);
      });

      // Patient revokes connection with doctor
      await revokeDoctorConnectionByPatient(patientUser._id.toString(), doctorProfile._id.toString());

      const revocationData = await revokePromise;
      expect(revocationData.patientId).toBe(patientProfile._id.toString());
      expect(revocationData.doctorId).toBe(doctorProfile._id.toString());
      expect(revocationData.message).toMatch(/revoked/i);

      doctorClient.disconnect();
    });
  });
});
