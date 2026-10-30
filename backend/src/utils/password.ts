import crypto from 'crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Hashes a plaintext password using crypto.scrypt with a unique cryptographically secure salt.
 * Returns salt:derivedKey formatted hex string.
 */
export const hashPassword = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};

/**
 * Compares a candidate password against stored salt:derivedKey using constant-time comparison.
 */
export const comparePassword = (
  password: string,
  storedHash: string
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!storedHash || !storedHash.includes(':')) {
      return resolve(false);
    }

    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');

    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      const isMatch =
        derivedKey.length === keyBuffer.length &&
        crypto.timingSafeEqual(derivedKey, keyBuffer);
      resolve(isMatch);
    });
  });
};
