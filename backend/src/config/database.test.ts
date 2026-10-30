import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './database';
import { connectPrisma, disconnectPrisma } from './prisma';
import { clearTestDb, closeTestDb, setupTestDb } from '../utils/testDb';

vi.mock('./prisma', async () => {
  const actual = await vi.importActual<typeof import('./prisma')>('./prisma');
  return { ...actual, connectPrisma: vi.fn(), disconnectPrisma: vi.fn() };
});

describe('PostgreSQL Prisma database harness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('connects through Prisma and reports connection state', async () => {
    await connectDatabase();
    expect(connectPrisma).toHaveBeenCalledTimes(1);
    expect(isDatabaseConnected()).toBe(true);
    await disconnectDatabase();
    expect(disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(isDatabaseConnected()).toBe(false);
  });

  it('exposes an isolated PostgreSQL test URL and cleanup routines', async () => {
    expect(await setupTestDb()).toBe(process.env.DATABASE_URL || 'postgresql://localhost/reportsetu_test');
    await expect(clearTestDb()).resolves.not.toThrow();
    await expect(closeTestDb()).resolves.not.toThrow();
  });
});
