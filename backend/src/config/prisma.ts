import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './env';
import { logger } from '../utils/logger';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const connectPrisma = async (): Promise<void> => {
  await prisma.$connect();
  logger.info({ message: 'PostgreSQL connection established successfully' });
};

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info({ message: 'PostgreSQL Prisma connection closed cleanly' });
};
