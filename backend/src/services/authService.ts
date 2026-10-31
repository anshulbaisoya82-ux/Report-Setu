import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { UserRole } from '../generated/prisma/client';
export interface IDoctorClinic {
  name: string;
  address?: string;
  city?: string;
}
import { config } from '../config/env';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { createRefreshTokenSession } from './tokenService';
import { recordAudit } from './auditService';
import { logger } from '../utils/logger';
import { generateUniqueRsId } from '../utils/rsId';

export const normalizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') throw new BadRequestError('Phone number is required');
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  throw new BadRequestError('Invalid Indian mobile phone number. Must be 10 digits starting with 6-9.');
};

export const hashOtp = (phone: string, otp: string): string =>
  crypto.createHmac('sha256', config.ENCRYPTION_KEY).update(`${phone}:${otp}`).digest('hex');

export interface SendOtpResult { phone: string; expiresAt: Date; devCode?: string }

export const sendPatientOtp = async (rawPhone: string): Promise<SendOtpResult> => {
  const phone = normalizePhone(rawPhone);
  const otpCode = config.NODE_ENV !== 'production' && config.SMS_DEV_CODE
    ? config.SMS_DEV_CODE : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.otp.deleteMany({ where: { phone } });
  await prisma.otp.create({ data: { phone, otpHash: hashOtp(phone, otpCode), expiresAt, maxAttempts: 5 } });
  logger.info({ type: 'otp_dispatched', phone, expiresAt, isDev: config.NODE_ENV !== 'production' });
  return { phone, expiresAt, devCode: config.NODE_ENV !== 'production' ? otpCode : undefined };
};

export interface VerifyOtpResult {
  user: { id: string; role: string; phone?: string };
  patient: any; accessToken: string; refreshToken: string; isNewUser: boolean; isProfileComplete: boolean;
}

export const verifyPatientOtp = async (
  rawPhone: string, otpCode: string, ipAddress = '127.0.0.1', patientName?: string
): Promise<VerifyOtpResult> => {
  const phone = normalizePhone(rawPhone);
  if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode.trim()))
    throw new BadRequestError('Invalid OTP format. Must be a 6-digit code.');
  const record = await prisma.otp.findFirst({
    where: { phone, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' },
  });
  if (!record) throw new BadRequestError('Verification code has expired or was not requested. Please request a new code.');
  if (record.attempts >= record.maxAttempts) {
    await prisma.otp.delete({ where: { id: record.id } });
    throw new BadRequestError('Maximum verification attempts exceeded. Please request a new code.');
  }
  const cleanOtp = otpCode.trim();
  const expected = Buffer.from(hashOtp(phone, cleanOtp));
  const actual = Buffer.from(record.otpHash);
  const isDevBypass = config.NODE_ENV !== 'production' && config.SMS_DEV_CODE === cleanOtp;
  const isMatch = isDevBypass || (expected.length === actual.length && crypto.timingSafeEqual(expected, actual));
  if (!isMatch) {
    const attempts = record.attempts + 1;
    await prisma.otp.update({ where: { id: record.id }, data: { attempts } });
    throw new BadRequestError(`Invalid verification code. ${record.maxAttempts - attempts} attempt(s) remaining.`);
  }
  await prisma.otp.delete({ where: { id: record.id } });

  let user = await prisma.user.findFirst({
    where: { phone },
    include: { patientProfile: true, doctorProfile: true },
  });
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const rsId = await generateUniqueRsId(async candidate =>
      !(await prisma.patientProfile.findUnique({ where: { rsId: candidate } })));
    user = await prisma.user.create({
      data: {
        role: UserRole.patient,
        phone,
        isActive: true,
        isVerified: true,
        lastLoginAt: new Date(),
        patientProfile: {
          create: {
            rsId,
            name: patientName?.trim() || '',
            phone,
            age: 0,
            gender: '',
            bloodGroup: '',
            conditions: [],
            location: '',
            status: 'Normal',
          },
        },
      },
      include: { patientProfile: true, doctorProfile: true },
    });
  } else if (!user.patientProfile) {
    // Existing user (e.g. doctor) now activating/creating their patient profile
    isNewUser = true;
    const rsId = await generateUniqueRsId(async candidate =>
      !(await prisma.patientProfile.findUnique({ where: { rsId: candidate } })));
    const patientProfile = await prisma.patientProfile.create({
      data: {
        userId: user.id,
        rsId,
        name: patientName?.trim() || user.doctorProfile?.name || '',
        phone,
        age: 0,
        gender: '',
        bloodGroup: '',
        conditions: [],
        location: '',
        status: 'Normal',
      },
    });
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), isVerified: true },
      include: { patientProfile: true, doctorProfile: true },
    });
    user.patientProfile = patientProfile;
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), isVerified: true },
      include: { patientProfile: true, doctorProfile: true },
    });
  }
  const session = await createRefreshTokenSession(user.id, 'patient', true);
  recordAudit({
    userId: user.id,
    userRole: 'patient',
    action: 'AUTH_LOGIN',
    resourceType: 'User',
    resourceId: user.id,
    patientId: user.patientProfile?.id,
    purpose: 'PATIENT_AUTHENTICATION',
    ipAddress,
  });
  return {
    user: { id: user.id, role: 'patient', phone: user.phone || undefined },
    patient: user.patientProfile,
    ...session,
    isNewUser,
    isProfileComplete: Boolean(
      user.patientProfile?.name &&
      user.patientProfile.age > 0 &&
      user.patientProfile.gender &&
      user.patientProfile.bloodGroup &&
      user.patientProfile.location
    ),
  };
};

export interface DoctorSignupInput {
  name: string; email: string; phone: string; registrationNumber: string;
  medicalCouncil: string; specialty?: string; clinic?: IDoctorClinic | string; password: string;
}

export const registerDoctor = async (input: DoctorSignupInput, ipAddress = '127.0.0.1'): Promise<{
  user: any; doctor: any; message: string;
}> => {
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const registrationNumber = input.registrationNumber.trim().toUpperCase();
  if (await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } }))
    throw new ConflictError('An account with this email or mobile phone is already registered');
  if (await prisma.doctorProfile.findFirst({ where: { OR: [{ email }, { registrationNumber }] } }))
    throw new ConflictError('A doctor profile with this email or registration number is already registered');
  const clinic = typeof input.clinic === 'string'
    ? { name: input.clinic, city: 'New Delhi' }
    : { name: input.clinic?.name || 'Private Clinic', address: input.clinic?.address || '', city: input.clinic?.city || 'New Delhi' };
  const user = await prisma.user.create({
    data: {
      role: UserRole.doctor, email, phone, passwordHash: await hashPassword(input.password),
      doctorProfile: { create: {
        name: input.name.trim(), email, phone, registrationNumber,
        medicalCouncil: input.medicalCouncil.trim(), specialty: input.specialty?.trim() || 'General Physician',
        clinic, verificationStatus: 'pending',
      } },
    }, include: { doctorProfile: true },
  });
  recordAudit({ userId: user.id, userRole: 'doctor', action: 'AUTH_LOGIN', resourceType: 'DoctorProfile',
    resourceId: user.doctorProfile?.id, purpose: 'DOCTOR_REGISTRATION', ipAddress });
  return { user, doctor: user.doctorProfile, message: 'Registration submitted successfully. Your account is pending medical council verification.' };
};

export const loginDoctor = async (emailInput: string, passwordInput: string, ipAddress = '127.0.0.1'): Promise<any> => {
  const email = emailInput.trim().toLowerCase();
  let user = await prisma.user.findFirst({ where: { email, role: UserRole.doctor }, include: { doctorProfile: true } });
  if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid email or password');
  if (user.lockUntil && user.lockUntil > new Date()) {
    const seconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    throw new UnauthorizedError(`Account is temporarily locked due to 3 consecutive failed login attempts. Please try again after ${seconds} second(s).`);
  }
  if (!await comparePassword(passwordInput, user.passwordHash)) {
    const failed = user.failedLoginAttempts + 1;
    if (failed >= 3) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: failed, lockUntil: new Date(Date.now() + 15 * 1000) } });
      recordAudit({ userId: user.id, userRole: 'doctor', action: 'AUTH_FAILED', resourceType: 'User', resourceId: user.id, purpose: 'ACCOUNT_LOCKOUT_EXCEEDED_ATTEMPTS', ipAddress });
      throw new UnauthorizedError('Account locked due to 3 consecutive failed login attempts. Please try again after 15 seconds.');
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: failed } });
    recordAudit({ userId: user.id, userRole: 'doctor', action: 'AUTH_FAILED', resourceType: 'User', resourceId: user.id, purpose: 'FAILED_PASSWORD_ATTEMPT', ipAddress });
    throw new UnauthorizedError(`Invalid email or password. ${3 - failed} attempt(s) remaining before account lockout.`);
  }
  if (!user.doctorProfile) throw new NotFoundError('Doctor profile record not found');
  user = await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() }, include: { doctorProfile: true } });
  const doctorProfile = user.doctorProfile;
  if (!doctorProfile) throw new NotFoundError('Doctor profile record not found');
  const session = await createRefreshTokenSession(user.id, 'doctor', doctorProfile.verificationStatus === 'verified');
  recordAudit({ userId: user.id, userRole: 'doctor', action: 'AUTH_LOGIN', resourceType: 'User', resourceId: user.id, purpose: 'DOCTOR_AUTHENTICATION', ipAddress });
  return { user: { id: user.id, role: user.role, email: user.email || undefined }, doctor: doctorProfile, ...session };
};

export const verifyDoctorByAdmin = async (doctorIdOrUserId: string, adminUserId = 'admin', ipAddress = '127.0.0.1'): Promise<any> => {
  const doctor = await prisma.doctorProfile.findFirst({ where: { OR: [{ id: doctorIdOrUserId }, { userId: doctorIdOrUserId }] } });
  if (!doctor) throw new NotFoundError('Doctor profile not found');
  const verified = await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { verificationStatus: 'verified', verifiedAt: new Date() } });
  await prisma.user.update({ where: { id: doctor.userId }, data: { isVerified: true } });
  recordAudit({ userId: adminUserId, userRole: 'admin', action: 'TRIAGE_STATUS_CHANGE', resourceType: 'DoctorProfile', resourceId: doctor.id, purpose: 'ADMIN_DOCTOR_VERIFICATION', ipAddress });
  return verified;
};

export const rejectDoctorByAdmin = async (doctorIdOrUserId: string, reason?: string, adminUserId = 'admin', ipAddress = '127.0.0.1'): Promise<any> => {
  const doctor = await prisma.doctorProfile.findFirst({ where: { OR: [{ id: doctorIdOrUserId }, { userId: doctorIdOrUserId }] } });
  if (!doctor) throw new NotFoundError('Doctor profile not found');
  const rejected = await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: {
      verificationStatus: 'rejected',
      rejectionReason: reason || 'Credentials could not be verified with State Medical Council.',
    },
  });
  await prisma.user.update({ where: { id: doctor.userId }, data: { isVerified: false } });
  recordAudit({ userId: adminUserId, userRole: 'admin', action: 'TRIAGE_STATUS_CHANGE', resourceType: 'DoctorProfile', resourceId: doctor.id, purpose: 'ADMIN_DOCTOR_REJECTION', ipAddress });
  return rejected;
};

export const getAdminStats = async () => {
  const [totalDoctors, pendingDoctors, verifiedDoctors, rejectedDoctors, totalPatients, totalReports] = await Promise.all([
    prisma.doctorProfile.count(),
    prisma.doctorProfile.count({ where: { verificationStatus: 'pending' } }),
    prisma.doctorProfile.count({ where: { verificationStatus: 'verified' } }),
    prisma.doctorProfile.count({ where: { verificationStatus: 'rejected' } }),
    prisma.patientProfile.count(),
    prisma.report.count(),
  ]);
  return {
    totalDoctors,
    pendingDoctors,
    verifiedDoctors,
    rejectedDoctors,
    totalPatients,
    totalReports,
  };
};

export const getDoctorsForAdmin = async (filters: { status?: string; search?: string } = {}) => {
  const where: any = {};
  if (filters.status && filters.status !== 'all') {
    where.verificationStatus = filters.status;
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { registrationNumber: { contains: q, mode: 'insensitive' } },
      { specialty: { contains: q, mode: 'insensitive' } },
      { medicalCouncil: { contains: q, mode: 'insensitive' } },
    ];
  }
  return await prisma.doctorProfile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, email: true, phone: true, isVerified: true, createdAt: true, lastLoginAt: true },
      },
    },
  });
};

export const verifyAllPendingDoctors = async (adminUserId = 'admin', ipAddress = '127.0.0.1'): Promise<{ count: number }> => {
  const pendingDoctors = await prisma.doctorProfile.findMany({ where: { verificationStatus: 'pending' } });
  for (const doc of pendingDoctors) {
    await prisma.doctorProfile.update({ where: { id: doc.id }, data: { verificationStatus: 'verified', verifiedAt: new Date() } });
    await prisma.user.update({ where: { id: doc.userId }, data: { isVerified: true } });
  }
  recordAudit({ userId: adminUserId, userRole: 'admin', action: 'TRIAGE_STATUS_CHANGE', resourceType: 'DoctorProfile', purpose: 'ADMIN_DOCTOR_VERIFY_ALL', ipAddress });
  return { count: pendingDoctors.length };
};
