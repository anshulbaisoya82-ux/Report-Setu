import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL connection URL')
    .default('postgresql://reportsetu:reportsetu@127.0.0.1:5432/reportsetu?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // 32-byte AES-256-GCM key encoded as 64-char hex
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be 64-character hex (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must contain valid hexadecimal characters'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['gemini', 'claude', 'openai', 'ml-service', 'mock']).default('mock'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SMS_DEV_CODE: z.string().default('123456'),
  ML_SERVICE_URL: z.string().default('http://127.0.0.1:8001'),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates provided environment variables against envSchema.
 * Throws a formatted descriptive error if validation fails.
 */
export const validateEnv = (customEnv: Record<string, unknown> = process.env): Env => {
  const result = envSchema.safeParse(customEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(`[Config Error] Environment validation failed:\n${errorDetails}`);
  }

  return result.data;
};

// Singleton config loaded for the app process
export const config: Env = (() => {
  // If running in test mode without pre-set secrets, supply valid defaults for unit tests
  if (process.env.NODE_ENV === 'test') {
    const testEnv = {
      PORT: '5001',
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://reportsetu:reportsetu@127.0.0.1:5432/reportsetu_test?schema=public',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_at_least_32_characters_long_12345',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_at_least_32_characters_long_12345',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CORS_ORIGIN: 'http://localhost:5173',
      AI_PROVIDER: 'mock',
      LOG_LEVEL: 'info',
      SMS_DEV_CODE: '123456',
      ...process.env,
    };
    return validateEnv(testEnv);
  }

  return validateEnv(process.env);
})();
