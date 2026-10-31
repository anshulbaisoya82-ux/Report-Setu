import { prisma, connectPrisma, disconnectPrisma } from './prisma';

let connected = false;

/**
 * Connects the application to PostgreSQL through Prisma.
 * The schema is applied separately with `npm run db:migrate`.
 */
export const connectDatabase = async (): Promise<typeof prisma> => {
  if (!connected) {
    await connectPrisma();
    connected = true;
  }
  return prisma;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (connected) {
    await disconnectPrisma();
    connected = false;
  }
};

export const isDatabaseConnected = (): boolean => connected;
