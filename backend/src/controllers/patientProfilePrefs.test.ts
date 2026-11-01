import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  userUpdate: vi.fn(),
}));
vi.mock('../config/prisma', () => ({
  prisma: {
    patientProfile: { findUnique: db.findUnique, update: db.update },
    user: { update: db.userUpdate },
  },
  default: {},
}));
import { updatePatientProfile } from './patientProfileController';

const run = async (body: unknown) => {
  const res: any = {};
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  const next = vi.fn();
  await updatePatientProfile({ body, user: { userId: 'u1' } } as any, res, next);
  return { res, next };
};

beforeEach(() => {
  vi.clearAllMocks();
  db.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', notificationPreferences: { medicineReminders: true, doctorReplies: false } });
  db.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
});

describe('PUT /patient/profile notificationPreferences', () => {
  it('merges a partial change with the stored switches', async () => {
    const { res } = await run({ notificationPreferences: { medicineReminders: false, language: 'hi' } });
    expect(res.statusCode).toBe(200);
    expect(db.update.mock.calls[0][0].data.notificationPreferences).toEqual({ medicineReminders: false, doctorReplies: false, language: 'hi' });
  });

  it('leaves preferences untouched when not sent', async () => {
    await run({ name: 'Test Patient' });
    expect(db.update.mock.calls[0][0].data).not.toHaveProperty('notificationPreferences');
  });

  it('rejects unknown keys and non-boolean values', async () => {
    expect((await run({ notificationPreferences: { smsAlerts: true } })).next).toHaveBeenCalled();
    expect((await run({ notificationPreferences: { criticalAlerts: 'yes' } })).next).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
