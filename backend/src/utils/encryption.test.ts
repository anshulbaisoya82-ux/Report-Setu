import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptedFieldGetter,
  encryptedFieldSetter,
} from './encryption';
import { DecryptionError } from './errors';

describe('AES-256-GCM Field-Level Encryption (Task 2.1)', () => {
  const TEST_KEY_1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const TEST_KEY_2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const plaintext = 'Hemoglobin: 14.2 g/dL (Patient: John Doe)';
    const encrypted = encrypt(plaintext, TEST_KEY_1);

    expect(isEncrypted(encrypted)).toBe(true);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    const [iv, authTag, ciphertext] = parts;
    expect(iv).toHaveLength(24); // 12 bytes in hex
    expect(authTag).toHaveLength(32); // 16 bytes in hex
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should successfully roundtrip encrypt and decrypt UTF-8 / medical data', () => {
    const sensitiveData = 'Blood Group: O+ | Aadhaar: 1234-5678-9012 | Notes: Dr. शर्मा';
    const encrypted = encrypt(sensitiveData, TEST_KEY_1);
    const decrypted = decrypt(encrypted, TEST_KEY_1);

    expect(decrypted).toBe(sensitiveData);
  });

  it('should produce distinct ciphertexts for identical plaintext due to random IVs', () => {
    const text = 'Identical Medical Record';
    const encrypted1 = encrypt(text, TEST_KEY_1);
    const encrypted2 = encrypt(text, TEST_KEY_1);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1, TEST_KEY_1)).toBe(text);
    expect(decrypt(encrypted2, TEST_KEY_1)).toBe(text);
  });

  it('should prevent double-encryption if text is already encrypted', () => {
    const text = 'Confidential Report';
    const encryptedOnce = encrypt(text, TEST_KEY_1);
    const encryptedTwice = encrypt(encryptedOnce, TEST_KEY_1);

    expect(encryptedTwice).toBe(encryptedOnce);
    expect(decrypt(encryptedTwice, TEST_KEY_1)).toBe(text);
  });

  it('should fail decryption if authTag is tampered', () => {
    const encrypted = encrypt('Secret Lab Values', TEST_KEY_1);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper the first character of the auth tag
    const tamperedTag = (authTag[0] === 'a' ? 'b' : 'a') + authTag.slice(1);
    const tamperedPayload = `${iv}:${tamperedTag}:${ciphertext}`;

    expect(() => decrypt(tamperedPayload, TEST_KEY_1)).toThrow(DecryptionError);
  });

  it('should fail decryption if ciphertext is tampered', () => {
    const encrypted = encrypt('Secret Lab Values', TEST_KEY_1);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper the ciphertext
    const tamperedCipher = (ciphertext[0] === '0' ? '1' : '0') + ciphertext.slice(1);
    const tamperedPayload = `${iv}:${authTag}:${tamperedCipher}`;

    expect(() => decrypt(tamperedPayload, TEST_KEY_1)).toThrow(DecryptionError);
  });

  it('should fail decryption if an incorrect key is provided', () => {
    const encrypted = encrypt('Doctor Private Notes', TEST_KEY_1);
    expect(() => decrypt(encrypted, TEST_KEY_2)).toThrow(DecryptionError);
  });

  it('should throw DecryptionError on malformed format', () => {
    expect(() => decrypt('not:a:valid:encrypted:string')).toThrow(DecryptionError);
    expect(() => decrypt('plain-text-data')).toThrow(DecryptionError);
  });

  it('should handle empty or null values gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  describe('Field access helpers', () => {
    it('should correctly set encrypted value and get decrypted value', () => {
      const plain = 'Patient mobile: +919876543210';
      const encrypted = encryptedFieldSetter(plain);

      expect(isEncrypted(encrypted)).toBe(true);
      expect(encrypted).not.toBe(plain);

      const decrypted = encryptedFieldGetter(encrypted);
      expect(decrypted).toBe(plain);
    });

    it('roundtrips encrypted fields without a Mongo document plugin', () => {
      const stored = { medicalHistory: encryptedFieldSetter('Type 2 Diabetes, Hypertension') };
      expect(isEncrypted(stored.medicalHistory)).toBe(true);
      expect(encryptedFieldGetter(stored.medicalHistory)).toBe('Type 2 Diabetes, Hypertension');
    });
  });
});
