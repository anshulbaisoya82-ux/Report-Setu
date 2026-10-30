import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateRsId, isValidRsId, RS_ID_REGEX, generateUniqueRsId } from './rsId';
import { connectTestDb, closeTestDb, clearTestDb } from './testDb';
import { prisma } from '../config/prisma';

describe('Cryptographic RS ID generator and PostgreSQL uniqueness', () => {
  beforeAll(() => connectTestDb());
  afterAll(() => closeTestDb());
  beforeEach(() => clearTestDb());

  it('generates and validates RS IDs', () => {
    for (let i = 0; i < 50; i++) expect(generateRsId()).toMatch(RS_ID_REGEX);
    expect(isValidRsId('rs-10475')).toBe(true);
    expect(isValidRsId('RS-1234')).toBe(false);
  });

  it('maintains uniqueness across a batch', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateRsId));
    expect(ids.size).toBe(1000);
  });

  it('retries availability checks', async () => {
    let calls = 0;
    const id = await generateUniqueRsId(async () => ++calls >= 3);
    expect(isValidRsId(id)).toBe(true);
    expect(calls).toBe(3);
  });

  it('enforces RS-ID uniqueness in PostgreSQL', async () => {
    const phone = `+919${Date.now()}`;
    const user = await prisma.user.create({ data: { role: 'patient', phone } });
    const data = { name: 'Patient Alpha', phone, rsId: 'RS-TEST1', age: 30,
      gender: 'Female', bloodGroup: 'Unknown', location: '', status: 'Normal' };
    await prisma.patientProfile.create({ data: { ...data, userId: user.id } });
    const user2 = await prisma.user.create({ data: { role: 'patient', phone: `${phone}1` } });
    await expect(prisma.patientProfile.create({ data: { ...data, phone: `${phone}1`, userId: user2.id } })).rejects.toThrow();
  });
});
