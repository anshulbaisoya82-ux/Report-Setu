import crypto from 'crypto';

export const RS_ID_REGEX = /^RS-[A-Z0-9]{5}$/;

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates a non-guessable, cryptographically secure 5-character alphanumeric RS ID
 * format: /^RS-[A-Z0-9]{5}$/ (e.g. RS-10475, RS-A9K82)
 */
export const generateRsId = (): string => {
  const bytes = crypto.randomBytes(5);
  let result = '';

  for (let i = 0; i < 5; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }

  return `RS-${result}`;
};

/**
 * Checks if a string conforms to the standardized RS-ID format
 */
export const isValidRsId = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return RS_ID_REGEX.test(id.trim().toUpperCase());
};

/**
 * Helper to generate a collision-free RS ID given an asynchronous collision-check function
 */
export const generateUniqueRsId = async (
  isAvailable: (candidate: string) => Promise<boolean>,
  maxRetries = 10
): Promise<string> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateRsId();
    const available = await isAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  throw new Error('Collision exhaustion: Failed to generate a unique RS ID after maximum retries');
};
