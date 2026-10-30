import { connectDatabase, disconnectDatabase } from '../config/database';
import { prisma } from '../config/prisma';

/**
 * Initializes the PostgreSQL test database. Tests must provide a DATABASE_URL
 * pointing at an isolated database or schema.
 */
export const setupTestDb = async (): Promise<string> => {
  await connectDatabase();
  return process.env.DATABASE_URL || 'postgresql://localhost/reportsetu_test';
};

export const clearTestDb = async (): Promise<void> => {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  // SAFETY GUARD: Never wipe non-test or live development database!
  const isIsolatedTestDb = dbUrl.includes('_test') || !!process.env.TEST_DATABASE_URL;
  if (!isIsolatedTestDb) {
    console.warn(
      '[testDb] SAFETY GUARD TRIGGERED: DATABASE_URL is pointing to development database. Skipping clearTestDb to prevent wiping user accounts.'
    );
    return;
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.doctorNote.deleteMany(),
    prisma.medicineSchedule.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.report.deleteMany(),
    prisma.connectCode.deleteMany(),
    prisma.connection.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.otp.deleteMany(),
    prisma.doctorProfile.deleteMany(),
    prisma.patientProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
};

export const closeTestDb = async (): Promise<void> => {
  await disconnectDatabase();
};

export const connectTestDb = setupTestDb;

export const testDb = {
  setup: setupTestDb,
  clear: clearTestDb,
  close: closeTestDb,
};
