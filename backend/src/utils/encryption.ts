import crypto from 'crypto';
import { config } from '../config/env';
import { DecryptionError } from './errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTED_REGEX = /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

/**
 * Validates a 64-character hex key (32 bytes)
 */
const parseKey = (keyHex?: string): Buffer => {
  const key = keyHex || config.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Checks whether a given value is already an encrypted string in iv:authTag:ciphertext format
 */
export const isEncrypted = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return ENCRYPTED_REGEX.test(value);
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` (all hex encoded)
 */
export const encrypt = (plaintext: string, customKeyHex?: string): string => {
  if (plaintext === '' || plaintext === null || plaintext === undefined) {
    return plaintext;
  }

  // Prevent double-encryption
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const key = parseKey(customKeyHex);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypts an AES-256-GCM encrypted string in `iv:authTag:ciphertext` format.
 * Throws DecryptionError if authentication tag fails or format is corrupted.
 */
export const decrypt = (encryptedText: string, customKeyHex?: string): string => {
  if (encryptedText === '' || encryptedText === null || encryptedText === undefined) {
    return encryptedText;
  }

  if (typeof encryptedText !== 'string' || !isEncrypted(encryptedText)) {
    throw new DecryptionError('Malformed encrypted text format. Expected iv:authTag:ciphertext');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new DecryptionError('Malformed encrypted text format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = parseKey(customKeyHex);

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new DecryptionError('Invalid IV or AuthTag length in encrypted payload');
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new DecryptionError('Failed to decrypt data: authentication tag mismatch or corrupted ciphertext', err);
  }
};

/**
 * Schema getter for transparent decryption on document property access.
 */
export const encryptedFieldGetter = (value: unknown): unknown => {
  if (typeof value === 'string' && isEncrypted(value)) {
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }
  return value;
};

/**
 * Schema setter for transparent encryption on assignment.
 */
export const encryptedFieldSetter = (value: unknown): unknown => {
  if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
    return encrypt(value);
  }
  return value;
};
