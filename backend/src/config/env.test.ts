import { describe, it, expect } from 'vitest';
import { validateEnv, envSchema } from './env';

describe('Environment Configuration & Validation (Task 1.2)', () => {
  const validMockEnv = {
    PORT: '5000',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://localhost/reportsetu_test',
    JWT_ACCESS_SECRET: 'super_secret_access_token_key_at_least_32_chars',
    JWT_REFRESH_SECRET: 'super_secret_refresh_token_key_at_least_32_chars',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ORIGIN: 'http://localhost:5173',
    AI_PROVIDER: 'mock',
    LOG_LEVEL: 'info',
    SMS_DEV_CODE: '123456',
  };

  it('should parse and validate valid environment configuration', () => {
    const parsed = validateEnv(validMockEnv);
    expect(parsed.PORT).toBe(5000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.AI_PROVIDER).toBe('mock');
    expect(parsed.SMS_DEV_CODE).toBe('123456');
  });

  it('should apply defaults for optional variables', () => {
    const minimalEnv = {
      JWT_ACCESS_SECRET: 'super_secret_access_token_key_at_least_32_chars',
      JWT_REFRESH_SECRET: 'super_secret_refresh_token_key_at_least_32_chars',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const parsed = validateEnv(minimalEnv);
    expect(parsed.PORT).toBe(5000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:5173');
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.ML_SERVICE_URL).toBe('http://127.0.0.1:8001');
  });

  it('should throw an informative error if JWT_ACCESS_SECRET is under 32 characters', () => {
    const invalidEnv = {
      ...validMockEnv,
      JWT_ACCESS_SECRET: 'short_secret',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(
      /JWT_ACCESS_SECRET must be at least 32 characters/
    );
  });

  it('should throw an informative error if ENCRYPTION_KEY is not a 64-char hex string', () => {
    const invalidKeyLength = {
      ...validMockEnv,
      ENCRYPTION_KEY: 'abc123',
    };
    expect(() => validateEnv(invalidKeyLength)).toThrowError(
      /ENCRYPTION_KEY must be 64-character hex/
    );

    const invalidKeyChars = {
      ...validMockEnv,
      ENCRYPTION_KEY: 'z'.repeat(64), // 'z' is not hex
    };
    expect(() => validateEnv(invalidKeyChars)).toThrowError(
      /ENCRYPTION_KEY must contain valid hexadecimal characters/
    );
  });

  it('should reject invalid NODE_ENV value', () => {
    const invalidNodeEnv = {
      ...validMockEnv,
      NODE_ENV: 'staging', // only 'development' | 'test' | 'production' allowed
    };
    expect(() => validateEnv(invalidNodeEnv)).toThrowError(/Invalid enum value/);
  });
});
