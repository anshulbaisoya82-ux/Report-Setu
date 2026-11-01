import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } }, default: {} }));
import { handleAdminLogin, adminKeyMatches } from './adminAuthController';
import { verifyAccessToken } from '../utils/jwt';
import { authenticate, requireAdmin } from '../middlewares/auth';

const run = async (body: unknown) => {
  const res: any = {};
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  const next = vi.fn();
  await handleAdminLogin({ body, ip: '127.0.0.1' } as any, res, next);
  return { res, next };
};

afterEach(() => { delete process.env.ADMIN_KEY; });

describe('admin login (ADMIN_KEY from environment, no key in code)', () => {
  it('is disabled (503) when ADMIN_KEY is not set', async () => {
    const { next } = await run({ adminKey: 'anything' });
    expect(next.mock.calls[0][0].statusCode).toBe(503);
  });

  it('rejects a wrong key (401) and an empty key (422)', async () => {
    process.env.ADMIN_KEY = 'correct-admin-key-0123456789abcdef';
    expect((await run({ adminKey: 'wrong-key' })).next.mock.calls[0][0].statusCode).toBe(401);
    expect((await run({})).next.mock.calls[0][0].statusCode).toBe(422);
  });

  it('issues an admin access token for the right key', async () => {
    process.env.ADMIN_KEY = 'correct-admin-key-0123456789abcdef';
    const { res, next } = await run({ adminKey: 'correct-admin-key-0123456789abcdef' });
    expect(next).not.toHaveBeenCalled();
    expect(verifyAccessToken(res.body.data.accessToken).role).toBe('admin');
  });

  it('compares keys correctly', () => {
    expect(adminKeyMatches('abc', 'abc')).toBe(true);
    expect(adminKeyMatches('abc', 'abd')).toBe(false);
  });

  it('the old hard-coded key no longer grants admin access', async () => {
    const req: any = { headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' }, query: { adminKey: 'reportsetu_admin_secret_key_12345' } };
    const next = vi.fn();
    await authenticate(req, {} as any, next);
    expect(next.mock.calls[0][0]?.statusCode).toBe(401);
    const next2 = vi.fn();
    requireAdmin(req, {} as any, next2);
    expect(next2.mock.calls[0][0]?.statusCode).toBe(403);
  });
});
