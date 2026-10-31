import crypto from 'crypto';
import { Connection, IConnection } from '../repositories';
import { PatientProfile, IPatientProfile } from '../repositories';
import { DoctorProfile, IDoctorProfile } from '../repositories';
import { Notification } from '../repositories';
import { ConnectCode } from '../repositories';
import { config } from '../config/env';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors';
import { isValidRsId } from '../utils/rsId';
import { recordAudit } from './auditService';
import { logger } from '../utils/logger';

/**
 * Computes constant-time HMAC-SHA256 hash of a connection code
 */
export const hashConnectionCode = (code: string, salt: string): string => {
  return crypto
    .createHmac('sha256', config.ENCRYPTION_KEY)
    .update(`${salt.trim().toUpperCase()}:${code.trim().toUpperCase()}`)
    .digest('hex');
};

/**
 * Generates a random 6-character uppercase alphanumeric code
 */
export const generateSixCharCode = (): string => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

// ─── STEP 1: Doctor sends connection request ───────────────────────────────

export interface SendConnectionRequestResult {
  vcode?: string;
  expiresAt?: Date;
  connectionId: string;
  patient: { id: string; name: string; rsId: string };
  doctor: { id: string; name: string; specialty: string };
  status: string;
  message: string;
}

/**
 * Doctor enters patient RS ID → creates a "pending" connection request.
 * Patient receives an in-app notification and can accept/reject in "My Doctor" screen.
 */
export const sendConnectionRequest = async (
  doctorUserId: string,
  rawRsId: string,
  ipAddress = '127.0.0.1'
): Promise<SendConnectionRequestResult> => {
  if (!rawRsId || typeof rawRsId !== 'string') {
    throw new BadRequestError('Patient RS ID is required');
  }

  const rsId = rawRsId.trim().toUpperCase();
  if (!isValidRsId(rsId)) {
    throw new BadRequestError('Invalid RS ID format. Expected format: RS-XXXXX');
  }

  // 1. Locate Doctor
  const doctor = await DoctorProfile.findOne({ userId: doctorUserId });
  if (!doctor) {
    throw new NotFoundError('Doctor profile not found');
  }

  if (doctor.verificationStatus !== 'verified') {
    throw new ForbiddenError(
      'Your doctor account is pending medical council verification. You cannot connect to patients.'
    );
  }

  // 2. Locate Patient
  const patient = await PatientProfile.findOne({ rsId });
  if (!patient) {
    throw new NotFoundError(`No patient found with RS ID ${rsId}`);
  }

  // 3. Check for existing active connection
  const activeConnection = await Connection.findOne({
    patientId: patient._id,
    doctorId: doctor._id,
    status: 'active',
  });

  if (activeConnection) {
    throw new ConflictError('You are already actively connected to this patient');
  }

  // 4. Check for existing pending request
  const pendingConnection = await Connection.findOne({
    patientId: patient._id,
    doctorId: doctor._id,
    status: 'pending',
  });

  if (pendingConnection) {
    throw new ConflictError('A connection request is already pending for this patient');
  }

  // 5. Generate request vcode
  const vcode = generateSixCharCode();
  const vcodeHash = hashConnectionCode(vcode, rsId);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // 6. Create pending connection record
  const connection = await Connection.findOneAndUpdate(
    { patientId: patient._id, doctorId: doctor._id },
    {
      status: 'pending',
      vcodeHash,
      connectCodeHash: null,
      codeExpiresAt: expiresAt,
      attempts: 0,
      maxAttempts: 5,
      connectedAt: null,
      revokedAt: null,
      revokedBy: null,
    },
    { upsert: true, new: true }
  );

  // 7. Create In-App Notification for Patient
  await Notification.create({
    userId: patient.userId,
    type: 'connection_request',
    title: 'New Doctor Connection Request',
    message: `${doctor.name} (${doctor.specialty}) wants to connect and view your medical records.`,
    data: {
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      specialty: doctor.specialty,
      clinic: doctor.clinic,
      rsId: patient.rsId,
      connectionId: connection._id.toString(),
    },
  });

  // 8. Audit log
  recordAudit({
    userId: doctorUserId,
    userRole: 'doctor',
    action: 'DOCTOR_CONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: patient._id,
    purpose: 'DOCTOR_SEND_CONNECTION_REQUEST',
    ipAddress,
  });

  logger.info({
    type: 'connection_request_sent',
    doctorId: doctor._id,
    patientRsId: rsId,
  });

  return {
    vcode,
    expiresAt,
    connectionId: connection._id.toString(),
    patient: {
      id: patient._id.toString(),
      name: patient.name,
      rsId: patient.rsId,
    },
    doctor: {
      id: doctor._id.toString(),
      name: doctor.name,
      specialty: doctor.specialty,
    },
    status: 'pending',
    message: 'Connection request sent to patient. Waiting for their approval.',
  };
};

// ─── STEP 2: Patient views pending requests ────────────────────────────────

export interface PendingConnectionRequest {
  connectionId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  clinic: any;
  requestedAt: string;
}

/**
 * Patient fetches all pending connection requests from doctors.
 */
export const getPendingConnectionRequests = async (
  patientUserId: string
): Promise<PendingConnectionRequest[]> => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const pendingConnections = await Connection.find({
    patientId: patient._id,
    status: 'pending',
  });

  return Promise.all(
    pendingConnections.map(async (conn: any) => {
      const doctor = (await DoctorProfile.findById(conn.doctorId)) as unknown as IDoctorProfile;
      return {
        connectionId: conn._id.toString(),
        doctorId: doctor?._id?.toString() || conn.doctorId,
        doctorName: doctor?.name || 'Unknown Doctor',
        specialty: doctor?.specialty || 'General',
        clinic: doctor?.clinic || '',
        requestedAt: (conn.createdAt || conn.updatedAt || new Date()).toISOString
          ? (conn.createdAt || conn.updatedAt || new Date()).toISOString()
          : new Date().toISOString(),
      };
    })
  );
};

// ─── STEP 3: Patient approves → generates 2-min code ───────────────────────

export interface ApproveConnectionResult {
  code: string;
  expiresAt: Date;
  connectionId: string;
  doctorName: string;
}

/**
 * Patient approves a pending connection request.
 * Generates a temporary 6-digit code valid for 2 minutes.
 * Patient reads this code to the doctor (in-clinic or by phone).
 */
export const approveConnectionRequest = async (
  patientUserId: string,
  connectionId: string,
  ipAddress = '127.0.0.1'
): Promise<ApproveConnectionResult> => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    _id: connectionId,
    patientId: patient._id,
    status: 'pending',
  });

  if (!connection) {
    throw new NotFoundError('Pending connection request not found');
  }

  // Generate 6-digit code valid for 2 minutes
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashConnectionCode(code, patient.rsId);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

  // Store code in ConnectCode table for verification
  await ConnectCode.deleteMany({ patientId: patient._id });
  await ConnectCode.create({
    patientId: patient._id,
    rsId: patient.rsId,
    codeHash,
    attempts: 0,
    maxAttempts: 5,
    expiresAt,
  });

  // Also store code hash on the connection record for cross-reference
  connection.connectCodeHash = codeHash;
  connection.codeExpiresAt = expiresAt;
  connection.attempts = 0;
  await connection.save();

  // Get doctor name for display
  const doctor = (await DoctorProfile.findById(connection.doctorId)) as unknown as IDoctorProfile;

  // Notify doctor that patient approved and code is ready
  if (doctor) {
    await Notification.create({
      userId: doctor.userId,
      type: 'connection_approved',
      title: 'Patient Approved Connection',
      message: `${patient.name} (${patient.rsId}) approved your connection request. Ask them for the verification code.`,
      data: {
        patientId: patient._id.toString(),
        patientName: patient.name,
        rsId: patient.rsId,
        connectionId: connection._id.toString(),
      },
    });
  }

  recordAudit({
    userId: patientUserId,
    userRole: 'patient',
    action: 'DOCTOR_CONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: patient._id,
    purpose: 'PATIENT_APPROVE_REQUEST',
    ipAddress,
  });

  return {
    code,
    expiresAt,
    connectionId: connection._id.toString(),
    doctorName: doctor?.name || 'Doctor',
  };
};

// ─── STEP 3b: Patient rejects request ──────────────────────────────────────

/**
 * Patient rejects a pending connection request.
 */
export const rejectConnectionRequest = async (
  patientUserId: string,
  connectionId: string,
  ipAddress = '127.0.0.1'
): Promise<{ message: string }> => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    _id: connectionId,
    patientId: patient._id,
    status: 'pending',
  });

  if (!connection) {
    throw new NotFoundError('Pending connection request not found');
  }

  connection.status = 'rejected';
  connection.revokedAt = new Date();
  connection.revokedBy = 'patient';
  await connection.save();

  // Get doctor for notification
  const doctor = (await DoctorProfile.findById(connection.doctorId)) as unknown as IDoctorProfile;
  if (doctor) {
    await Notification.create({
      userId: doctor.userId,
      type: 'connection_rejected',
      title: 'Connection Request Declined',
      message: `Patient ${patient.name} (${patient.rsId}) has declined your connection request.`,
      data: {
        patientId: patient._id.toString(),
        rsId: patient.rsId,
      },
    });
  }

  recordAudit({
    userId: patientUserId,
    userRole: 'patient',
    action: 'DOCTOR_DISCONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: patient._id,
    purpose: 'PATIENT_REJECT_REQUEST',
    ipAddress,
  });

  return { message: 'Connection request rejected.' };
};

// ─── STEP 4: Doctor enters code to complete connection ─────────────────────

export interface VerifyConnectCodeResult {
  connection: IConnection;
  patient: { id: string; name: string; rsId: string };
  doctor: { id: string; name: string; specialty: string };
}

/**
 * Doctor enters patient's RS ID and 6-digit connect code to establish active connection.
 */
export const verifyDoctorConnectCode = async (
  doctorUserId: string,
  rawPatientRsId: string,
  codeInput: string,
  ipAddress = '127.0.0.1'
): Promise<VerifyConnectCodeResult> => {
  if (!rawPatientRsId || !codeInput) {
    throw new BadRequestError('Patient RS ID and 6-digit connect code are required');
  }

  const patientRsId = rawPatientRsId.trim().toUpperCase();
  const cleanCode = codeInput.trim().toUpperCase();

  // 1. Verify doctor
  const doctor = await DoctorProfile.findOne({ userId: doctorUserId });
  if (!doctor) {
    throw new NotFoundError('Doctor profile not found');
  }

  if (doctor.verificationStatus !== 'verified') {
    throw new ForbiddenError(
      'Your doctor account is pending medical council verification. You cannot connect to patients.'
    );
  }

  // 2. Locate Patient
  const patient = await PatientProfile.findOne({ rsId: patientRsId });
  if (!patient) {
    throw new NotFoundError(`No patient found with RS ID ${patientRsId}`);
  }

  // 3. Locate active ConnectCode
  const connectCodeRecord = await ConnectCode.findOne({
    patientId: patient._id,
    expiresAt: { $gt: new Date() },
  });

  if (!connectCodeRecord) {
    throw new BadRequestError(
      'Connect code has expired or was not requested. Please ask patient to approve the request again.'
    );
  }

  // 4. Check lockout attempts
  if (connectCodeRecord.attempts >= connectCodeRecord.maxAttempts) {
    await ConnectCode.deleteOne({ _id: connectCodeRecord._id });
    throw new BadRequestError(
      'Maximum code verification attempts exceeded. Please ask patient to generate a new code.'
    );
  }

  // 5. Compare using constant-time comparison
  const calculatedHash = hashConnectionCode(cleanCode, patientRsId);
  const hashBuffer = Buffer.from(calculatedHash);
  const storedBuffer = Buffer.from(connectCodeRecord.codeHash);

  const isMatch =
    hashBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, storedBuffer);

  if (!isMatch) {
    connectCodeRecord.attempts += 1;
    await connectCodeRecord.save();
    const remaining = connectCodeRecord.maxAttempts - connectCodeRecord.attempts;

    if (remaining <= 0) {
      await ConnectCode.deleteOne({ _id: connectCodeRecord._id });
      throw new BadRequestError(
        'Maximum verification attempts exceeded. Code has been invalidated.'
      );
    }

    throw new BadRequestError(
      `Invalid connect code. ${remaining} attempt(s) remaining before lockout.`
    );
  }

  // 6. Valid code: delete single-use connect code immediately
  await ConnectCode.deleteOne({ _id: connectCodeRecord._id });

  // 7. Establish active connection
  const connection = await Connection.findOneAndUpdate(
    { patientId: patient._id, doctorId: doctor._id },
    {
      status: 'active',
      connectedAt: new Date(),
      revokedAt: undefined,
      revokedBy: undefined,
    },
    { upsert: true, new: true }
  );

  // 8. Notify Patient
  await Notification.create({
    userId: patient.userId,
    type: 'connection_approved',
    title: 'Doctor Connected Successfully',
    message: `You are now connected with ${doctor.name} (${doctor.specialty}). They can now review your lab reports.`,
    data: {
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      clinic: doctor.clinic,
    },
  });

  // 9. Audit log
  recordAudit({
    userId: doctorUserId,
    userRole: 'doctor',
    action: 'DOCTOR_CONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: patient._id,
    purpose: 'DOCTOR_VERIFY_CONNECT_CODE_SUCCESS',
    ipAddress,
  });

  return {
    connection,
    patient: {
      id: patient._id.toString(),
      name: patient.name,
      rsId: patient.rsId,
    },
    doctor: {
      id: doctor._id.toString(),
      name: doctor.name,
      specialty: doctor.specialty,
    },
  };
};

// ─── LEGACY: Keep for backward compat (used by old generate code flow) ─────

/**
 * @deprecated Use sendConnectionRequest + approveConnectionRequest flow instead
 */
export const requestDoctorVCode = async (
  doctorUserId: string,
  rawRsId: string,
  ipAddress = '127.0.0.1'
) => {
  return sendConnectionRequest(doctorUserId, rawRsId, ipAddress);
};

/**
 * @deprecated Use approveConnectionRequest flow instead
 */
export const generatePatientConnectCode = async (
  patientUserId: string,
  ipAddress = '127.0.0.1'
): Promise<{ code: string; expiresAt: Date; rsId: string }> => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashConnectionCode(code, patient.rsId);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

  await ConnectCode.deleteMany({ patientId: patient._id });
  await ConnectCode.create({
    patientId: patient._id,
    rsId: patient.rsId,
    codeHash,
    attempts: 0,
    maxAttempts: 5,
    expiresAt,
  });

  return { code, expiresAt, rsId: patient.rsId };
};

// ─── Revoke connections (unchanged) ────────────────────────────────────────

/**
 * Patient revokes connection with a doctor.
 */
export const revokeDoctorConnectionByPatient = async (
  patientUserId: string,
  doctorIdInput: string,
  ipAddress = '127.0.0.1'
): Promise<IConnection> => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const orConditions: any[] = [{ _id: doctorIdInput }, { userId: doctorIdInput }];
  const doctor = await DoctorProfile.findOne({ $or: orConditions });

  if (!doctor) {
    throw new NotFoundError('Doctor profile not found');
  }

  const connection = await Connection.findOne({
    patientId: patient._id,
    doctorId: doctor._id,
  });

  if (!connection) {
    throw new NotFoundError('No connection found with this doctor');
  }

  connection.status = 'revoked';
  connection.revokedAt = new Date();
  connection.revokedBy = 'patient';
  await connection.save();

  // Evict doctor from live rooms
  const { revokeDoctorAccessFromRooms } = await import('./socketService');
  await revokeDoctorAccessFromRooms(doctor._id.toString(), patient._id.toString());

  await Notification.create({
    userId: doctor.userId,
    type: 'connection_request',
    title: 'Patient Connection Revoked',
    message: `${patient.name} (${patient.rsId}) has revoked your clinical connection.`,
    data: {
      patientId: patient._id.toString(),
      rsId: patient.rsId,
    },
  });

  recordAudit({
    userId: patientUserId,
    userRole: 'patient',
    action: 'DOCTOR_DISCONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: patient._id,
    purpose: 'PATIENT_REVOKE_DOCTOR',
    ipAddress,
  });

  return connection;
};

/**
 * Doctor revokes or cancels a connection.
 */
export const revokeConnectionByDoctor = async (
  doctorUserId: string,
  connectionIdInput: string,
  ipAddress = '127.0.0.1'
): Promise<IConnection> => {
  const doctor = await DoctorProfile.findOne({ userId: doctorUserId });
  if (!doctor) {
    throw new NotFoundError('Doctor profile not found');
  }

  const connection = await Connection.findOne({
    _id: connectionIdInput,
    doctorId: doctor._id,
  });

  if (!connection) {
    throw new NotFoundError('Connection not found or not owned by you');
  }

  connection.status = 'revoked';
  connection.revokedAt = new Date();
  connection.revokedBy = 'doctor';
  await connection.save();

  recordAudit({
    userId: doctorUserId,
    userRole: 'doctor',
    action: 'DOCTOR_DISCONNECT',
    resourceType: 'Connection',
    resourceId: connection._id.toString(),
    patientId: connection.patientId,
    purpose: 'DOCTOR_REVOKE_CONNECTION',
    ipAddress,
  });

  return connection;
};

// ─── Get connections list ──────────────────────────────────────────────────

export const getPatientConnections = async (patientUserId: string) => {
  const patient = await PatientProfile.findOne({ userId: patientUserId });
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connections = await Connection.find({
    patientId: patient._id,
    status: 'active',
  });

  return Promise.all(
    connections.map(async (connection: any) => {
      const doctor = (await DoctorProfile.findById(connection.doctorId)) as unknown as IDoctorProfile;
      const docName = doctor?.name || 'Doctor';
      const docSpecialty = doctor?.specialty || 'General Practitioner';
      const docId = doctor?._id?.toString() || connection.doctorId?.toString();
      return {
        id: connection._id.toString(),
        doctorId: docId,
        name: docName,
        doctorName: docName,
        specialty: docSpecialty,
        clinic: doctor?.clinic || {},
        doctor: {
          id: docId,
          name: docName,
          specialty: docSpecialty,
          clinic: doctor?.clinic || {},
        },
        connectedAt: connection.connectedAt || connection.createdAt,
        status: connection.status,
      };
    })
  );
};

/**
 * Doctor checks the status of a pending connection request.
 */
export const getDoctorPendingRequests = async (doctorUserId: string) => {
  const doctor = await DoctorProfile.findOne({ userId: doctorUserId });
  if (!doctor) {
    throw new NotFoundError('Doctor profile not found');
  }

  const pendingConnections = await Connection.find({
    doctorId: doctor._id,
    status: 'pending',
  });

  return Promise.all(
    pendingConnections.map(async (conn: any) => {
      const patient = (await PatientProfile.findById(conn.patientId)) as unknown as IPatientProfile;
      return {
        connectionId: conn._id.toString(),
        patientId: patient?._id?.toString() || conn.patientId,
        patientName: patient?.name || 'Unknown',
        patientRsId: patient?.rsId || '',
        status: 'pending',
        requestedAt: (conn.createdAt || new Date()).toISOString
          ? (conn.createdAt || new Date()).toISOString()
          : new Date().toISOString(),
      };
    })
  );
};
