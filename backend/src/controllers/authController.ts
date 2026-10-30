import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  sendPatientOtp,
  verifyPatientOtp,
  registerDoctor,
  loginDoctor,
  DoctorSignupInput,
} from '../services/authService';
import {
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
} from '../services/tokenService';
import { UnauthorizedError } from '../utils/errors';
import { sendSuccess } from '../utils/apiResponse';
import { config } from '../config/env';

const sendOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number must have at least 10 digits'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number must have at least 10 digits'),
  otp: z.string().length(6, 'Verification code must be exactly 6 digits'),
  name: z.string().min(2, 'Name must have at least 2 characters').optional(),
});

const doctorLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const doctorSignupSchema = z
  .object({
    name: z.string().min(2, 'Name must have at least 2 characters').optional(),
    fullName: z.string().min(2).optional(),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone must have at least 10 digits').optional(),
    mobile: z.string().min(10).optional(),
    registrationNumber: z.string().min(2, 'Registration number is required').optional(),
    regNumber: z.string().min(2).optional(),
    medicalCouncil: z.string().min(2, 'Medical council is required').optional(),
    regCouncil: z.string().min(2).optional(),
    specialty: z.string().optional(),
    clinic: z
      .union([
        z.string(),
        z.object({
          name: z.string(),
          address: z.string().optional(),
          city: z.string().optional(),
        }),
      ])
      .optional(),
    clinicName: z.string().optional(),
    password: z.string().min(6, 'Password must have at least 6 characters'),
  })
  .transform((data): DoctorSignupInput => ({
    name: (data.name || data.fullName || 'Doctor').trim(),
    email: data.email.trim().toLowerCase(),
    phone: (data.phone || data.mobile || '').trim(),
    registrationNumber: (data.registrationNumber || data.regNumber || '').trim().toUpperCase(),
    medicalCouncil: (data.medicalCouncil || data.regCouncil || 'Medical Council of India').trim(),
    specialty: data.specialty?.trim() || 'General Physician',
    clinic: data.clinic || data.clinicName || 'Private Clinic',
    password: data.password,
  }));

/**
 * Controller: Request 6-digit OTP for patient phone authentication
 */
export const handleSendPatientOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone } = sendOtpSchema.parse(req.body);
    const result = await sendPatientOtp(phone);

    sendSuccess(res, {
      phone: result.phone,
      expiresAt: result.expiresAt,
      devCode: result.devCode,
      message: 'Verification code sent successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Verify 6-digit OTP, authenticate patient, set refresh cookie
 */
export const handleVerifyPatientOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone, otp, name } = verifyOtpSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await verifyPatientOtp(phone, otp, ip, name);

    // Set secure HTTP-only refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });

    sendSuccess(res, {
      user: result.user,
      patient: result.patient,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
      isProfileComplete: result.isProfileComplete,
      message: result.isNewUser
        ? 'Patient account created and logged in successfully'
        : 'Logged in successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Register new doctor account awaiting verification
 */
export const handleDoctorSignup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedInput = doctorSignupSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await registerDoctor(validatedInput, ip);

    sendSuccess(
      res,
      {
        user: {
          id: result.user.id,
          role: result.user.role,
          email: result.user.email,
          phone: result.user.phone,
          isVerified: result.user.isVerified,
        },
        doctor: result.doctor ? { ...result.doctor, _id: result.doctor.id } : result.doctor,
        message: result.message,
      },
      undefined,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Authenticate doctor via email and password, set refresh cookie
 */
export const handleDoctorLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = doctorLoginSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await loginDoctor(email, password, ip);

    // Set secure HTTP-only refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });

    sendSuccess(res, {
      user: result.user,
      doctor: result.doctor,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Logged in successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Rotate refresh token, issue new access token and rotated refresh token
 */
export const handleRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await rotateRefreshToken(rawToken, ip);

    // Set rotated secure HTTP-only refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });

    sendSuccess(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Tokens rotated successfully',
    });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    next(err);
  }
};

/**
 * Controller: Revoke current refresh token session and clear cookie
 */
export const handleLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    await revokeRefreshToken(rawToken, ip);

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    sendSuccess(res, {
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Revoke all sessions across all devices for the authenticated user
 */
export const handleLogoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required to logout of all sessions');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const count = await revokeAllUserSessions(userId, ip);

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    sendSuccess(res, {
      revokedSessions: count,
      message: 'All active sessions have been revoked',
    });
  } catch (err) {
    next(err);
  }
};
